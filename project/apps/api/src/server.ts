import fastify from 'fastify';
import cors from '@fastify/cors';
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from 'fastify-type-provider-zod';
import dbPlugin from './plugins/db';
import healthRoutes from './routes/health';
import metadataRoutes from './routes/metadata';
import entitiesRoutes from './routes/entities';
import relationsRoutes from './routes/relations';
import tenantContextPlugin from './plugins/tenant_context';
import eventsRoutes from './routes/events';

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
  }).withTypeProvider<ZodTypeProvider>();

  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);

  await server.register(cors);
  await server.register(dbPlugin);
  await server.register(tenantContextPlugin);
  await server.register(healthRoutes);
  await server.register(metadataRoutes, { prefix: '/api/v1' });
  await server.register(entitiesRoutes, { prefix: '/api/v1/entities' });
  await server.register(relationsRoutes, { prefix: '/api/v1' });
  await server.register(eventsRoutes, { prefix: '/api/v1' });

  return server;
}