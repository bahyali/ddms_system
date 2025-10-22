import fastify from 'fastify';
import cors from '@fastify/cors';
import dbPlugin from './plugins/db';
import healthRoutes from './routes/health';

export async function buildServer() {
  const server = fastify({
    logger: {
      transport:
        process.env.NODE_ENV !== 'production'
          ? {
              target: 'pino-pretty',
            }
          : undefined,
    },
  });

  await server.register(cors);
  await server.register(dbPlugin);
  await server.register(healthRoutes);

  return server;
}