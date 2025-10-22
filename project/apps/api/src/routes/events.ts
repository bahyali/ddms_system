import { FastifyPluginAsync, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { Client } from 'pg';

interface EventPayload {
  type: string;
  tenant_id: string;
  [key: string]: unknown;
}

const eventsPlugin: FastifyPluginAsync = async (fastify) => {
  const clientsByTenant = new Map<string, Set<FastifyReply>>();
  let listenerClient: Client | null = null;

  const connectListener = async () => {
    try {
      if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is not set');
      }
      listenerClient = new Client({
        connectionString: process.env.DATABASE_URL,
      });
      await listenerClient.connect();
      fastify.log.info('SSE broadcaster connected to database.');

      await listenerClient.query('LISTEN events');

      listenerClient.on('notification', (message) => {
        if (!message.payload) return;

        try {
          const payload: EventPayload = JSON.parse(message.payload);
          const { tenant_id } = payload;

          const clients = clientsByTenant.get(tenant_id);
          if (clients && clients.size > 0) {
            const sseMessage = `data: ${message.payload}\n\n`;
            fastify.log.info(
              `Broadcasting event to ${clients.size} clients for tenant ${tenant_id}`,
            );
            for (const reply of clients) {
              reply.raw.write(sseMessage);
            }
          }
        } catch (err) {
          fastify.log.error(err, 'Failed to parse or broadcast SSE event');
        }
      });

      listenerClient.on('error', (err) => {
        fastify.log.error(err, 'SSE listener client error');
        // The 'end' event will handle reconnection.
      });

      listenerClient.on('end', () => {
        fastify.log.warn(
          'SSE listener client disconnected. Attempting to reconnect in 5s...',
        );
        setTimeout(connectListener, 5000);
      });
    } catch (err) {
      fastify.log.error(
        err,
        'Failed to connect SSE listener client. Retrying in 5s...',
      );
      setTimeout(connectListener, 5000);
    }
  };

  connectListener();

  // Heartbeat to keep connections alive through proxies
  const heartbeatInterval = setInterval(() => {
    const heartbeatMessage = ':heartbeat\n\n';
    for (const clientSet of clientsByTenant.values()) {
      for (const reply of clientSet) {
        reply.raw.write(heartbeatMessage);
      }
    }
  }, 20000);

  fastify.get(
    '/events',
    {
      schema: {
        tags: ['Real-time'],
        summary: 'Subscribe to real-time events',
        description:
          'Establishes a Server-Sent Events (SSE) connection to receive real-time updates for the current tenant.',
        response: {
          200: {
            description: 'SSE connection established.',
            content: {
              'text/event-stream': {},
            },
          },
        },
      },
    },
    async (request, reply) => {
      // Set SSE headers
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.flushHeaders(); // Important to send headers immediately

      const { tenantId } = request;

      if (!clientsByTenant.has(tenantId)) {
        clientsByTenant.set(tenantId, new Set());
      }
      const tenantClients = clientsByTenant.get(tenantId)!;
      tenantClients.add(reply);
      fastify.log.info(
        `Client connected for tenant ${tenantId}. Total clients for tenant: ${tenantClients.size}`,
      );

      request.raw.on('close', () => {
        tenantClients.delete(reply);
        fastify.log.info(
          `Client disconnected for tenant ${tenantId}. Total clients for tenant: ${tenantClients.size}`,
        );
        if (tenantClients.size === 0) {
          clientsByTenant.delete(tenantId);
        }
      });
    },
  );

  fastify.addHook('onClose', async () => {
    fastify.log.info('Closing SSE broadcaster...');
    clearInterval(heartbeatInterval);
    for (const clientSet of clientsByTenant.values()) {
      for (const reply of clientSet) {
        reply.raw.end();
      }
    }
    clientsByTenant.clear();
    if (listenerClient) {
      await listenerClient.end();
      fastify.log.info('SSE listener client disconnected.');
    }
  });
};

export default fp(eventsPlugin, {
  name: 'sse-broadcaster',
  dependencies: ['tenantContext'],
});