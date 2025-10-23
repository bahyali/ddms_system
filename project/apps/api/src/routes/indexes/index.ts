import { FastifyPluginAsync } from 'fastify';
import { desc, eq } from 'drizzle-orm';
import { fieldIndexes, fieldDefs } from '@ddms/db';
import { hasPermission } from '../../lib/authz';
import { fieldIndexSchema } from './schemas';

const indexesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/indexes',
    {
      schema: {
        tags: ['Operations'],
        summary: 'List Field Index Jobs',
        description:
          'Returns the indexing status for all fields that have indexing enabled for the current tenant.',
        response: {
          200: fieldIndexSchema.array(),
        },
      },
      preHandler: async (request, reply) => {
        if (!hasPermission(request.user, 'index:read')) {
          return reply.code(403).send({
            code: 'FORBIDDEN',
            message: 'You do not have permission to view index jobs.',
          });
        }
      },
    },
    async (request) => {
      const rows = await request.db
        .select({
          id: fieldIndexes.id,
          fieldId: fieldIndexes.fieldId,
          entityTypeId: fieldIndexes.entityTypeId,
          indexName: fieldIndexes.indexName,
          status: fieldIndexes.status,
          attempts: fieldIndexes.attempts,
          lastError: fieldIndexes.lastError,
          startedAt: fieldIndexes.startedAt,
          completedAt: fieldIndexes.completedAt,
          createdAt: fieldIndexes.createdAt,
          updatedAt: fieldIndexes.updatedAt,
          fieldKey: fieldDefs.key,
          fieldLabel: fieldDefs.label,
        })
        .from(fieldIndexes)
        .innerJoin(fieldDefs, eq(fieldDefs.id, fieldIndexes.fieldId))
        .where(eq(fieldIndexes.tenantId, request.tenantId))
        .orderBy(desc(fieldIndexes.updatedAt));

      return rows.map((row) => ({
        ...row,
        lastError: row.lastError ?? null,
        startedAt: row.startedAt ? row.startedAt.toISOString() : null,
        completedAt: row.completedAt ? row.completedAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));
    },
  );
};

export default indexesRoutes;
