import { FastifyInstance } from 'fastify';

/**
 * Registers a health check route.
 * @param fastify The Fastify instance.
 */
export default async function (fastify: FastifyInstance) {
  fastify.get('/health', async (_request, reply) => {
    // In a real application, you might also check database connectivity here.
    // For now, just returning a 200 OK is sufficient.
    return reply.code(200).send({ status: 'ok' });
  });
}