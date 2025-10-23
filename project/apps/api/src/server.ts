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
import authPlugin from './plugins/auth';
import eventsRoutes from './routes/events';
import indexerPlugin from './plugins/indexer';
import indexesRoutes from './routes/indexes';
import { tenants } from '@ddms/db';

const isMockAuthEnabled =
  process.env.MOCK_AUTH === 'true' ||
  (process.env.MOCK_AUTH !== 'false' && process.env.NODE_ENV !== 'production');
const mockTenantId =
  process.env.MOCK_TENANT_ID ?? '11111111-1111-1111-1111-111111111111';
const mockUserId = process.env.MOCK_USER_ID ?? 'dev-user';
const mockTenantName = process.env.MOCK_TENANT_NAME ?? 'Mock Tenant';
const rawMockRoles =
  process.env.MOCK_ROLES ?? 'admin';
const parsedMockRoles = rawMockRoles
  .split(',')
  .map((role) => role.trim())
  .filter((role) => role.length > 0);
const mockRoles = parsedMockRoles.length > 0 ? parsedMockRoles : ['admin'];

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
  await server.register(authPlugin);
  await server.register(indexerPlugin);

  if (isMockAuthEnabled) {
    try {
      await server.db
        .insert(tenants)
        .values({
          id: mockTenantId,
          name: mockTenantName,
        })
        .onConflictDoNothing({ target: tenants.id });
    } catch (err) {
      server.log.error(err, 'Failed to ensure mock tenant exists');
    }
  }

  // Global authentication hook
  server.addHook('preValidation', async (request, reply) => {
    // List of public routes that do not require authentication
    const publicRoutes = ['/health'];
    if (publicRoutes.includes(request.url)) {
      return;
    }

    if (isMockAuthEnabled) {
      const headerTenantId = request.headers['x-tenant-id'];
      const tenantId =
        typeof headerTenantId === 'string' && headerTenantId.length > 0
          ? headerTenantId
          : mockTenantId;

      request.user = {
        id: mockUserId,
        roles: mockRoles,
        tenantId,
      };
      request.tenantId = tenantId;
      return;
    }

    try {
      await request.jwtVerify();
      // The raw payload from jwtVerify is attached to request.user
      interface JwtPayload {
        sub: string;
        roles: string[];
        tenant_id: string;
      }
      const payload = request.user as JwtPayload;
      // We remap it to our desired structure
      request.user = {
        id: payload.sub,
        roles: payload.roles,
        tenantId: payload.tenant_id,
      };
      request.tenantId = payload.tenant_id;
    } catch (err) {
      reply
        .code(401)
        .send({ code: 'UNAUTHORIZED', message: 'Invalid or missing token.' });
    }
  });

  await server.register(healthRoutes);
  await server.register(metadataRoutes, { prefix: '/api/v1' });
  await server.register(entitiesRoutes, { prefix: '/api/v1/entities' });
  await server.register(relationsRoutes, { prefix: '/api/v1' });
  await server.register(eventsRoutes, { prefix: '/api/v1/events' });
  await server.register(indexesRoutes, { prefix: '/api/v1' });

  return server;
}
