import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { sql } from 'drizzle-orm';
import { ZodError, z } from 'zod';

// Augment FastifyRequest with the tenantId property
declare module 'fastify' {
  interface FastifyRequest {
    tenantId: string;
  }
}

const tenantIdSchema = z.string().uuid({ message: 'Invalid tenant ID format.' });

const tenantContextPlugin: FastifyPluginAsync = async (fastify) => {
  // Decorate the request with a tenantId property
  fastify.decorateRequest('tenantId', '');

  fastify.addHook('preHandler', async (request, reply) => {
    // Bypass tenant check for health route
    if (request.url === '/health') {
      return;
    }

    const tenantId = request.headers['x-tenant-id'];

    if (!tenantId || typeof tenantId !== 'string') {
      return reply.status(400).send({
        code: 'BAD_REQUEST',
        message: 'x-tenant-id header is required.',
      });
    }

    try {
      const validatedTenantId = tenantIdSchema.parse(tenantId);

      // Attach the validated tenantId to the request object
      request.tenantId = validatedTenantId;

      // The third argument `true` makes the setting local to the current transaction.
      await request.server.db.execute(
        sql`SELECT set_config('app.tenant_id', ${validatedTenantId}, true)`,
      );
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: 'Invalid x-tenant-id header.',
          errors: err.errors,
        });
      }
      request.log.error(err, 'Failed to set tenant context');
      return reply.status(500).send({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred while setting tenant context.',
      });
    }
  });
};

export default fp(tenantContextPlugin, {
  name: 'tenantContext',
  dependencies: ['db'],
});