import { FastifyPluginAsync } from 'fastify';
import {
  auditLog,
} from '@ddms/db';
import {
  and,
  desc,
  eq,
  inArray,
  lt,
  sql,
} from 'drizzle-orm';
import {
  getActivityLogQuerySchema,
  getActivityLogResponseSchema,
} from './schemas';

const SCHEMA_ACTIONS = [
  'entity_type.created',
  'entity_type.updated',
  'field_def.created',
  'field_def.updated',
  'field_def.deleted',
];

const RECORD_ACTIONS = [
  'record.created',
  'record.updated',
  'relation.created',
  'relation.deleted',
];

const IMPORT_ACTIONS: string[] = [];
const INTEGRATION_ACTIONS: string[] = [];
const GOVERNANCE_ACTIONS: string[] = [];

type ActivityCategory = 'schema' | 'record' | 'governance' | 'import' | 'integration';

const auditRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/activity-log',
    {
      schema: {
        tags: ['Audit'],
        summary: 'List Activity Events',
        description:
          'Returns recent audit log events for the tenant, ordered with the latest first.',
        querystring: getActivityLogQuerySchema,
        response: {
          200: getActivityLogResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const {
        limit: rawLimit,
        cursor,
        type,
        search,
      } = request.query;

      const limit = Math.min(rawLimit, 200);

      const conditions = [eq(auditLog.tenantId, request.tenantId)];

      if (cursor) {
        const numericCursor = Number(cursor);
        if (!Number.isFinite(numericCursor)) {
          return reply.code(400).send({
            code: 'BAD_REQUEST',
            message: 'Invalid cursor parameter.',
          });
        }
        conditions.push(lt(auditLog.id, numericCursor));
      }

      const whereClause =
        conditions.length === 1
          ? conditions[0]
          : and(...conditions);

      const fetchLimit = Math.min(limit * 3, 600);

      const rows = await request.db
        .select({
          id: auditLog.id,
          actorId: auditLog.actorId,
          action: auditLog.action,
          resourceType: auditLog.resourceType,
          resourceId: auditLog.resourceId,
          meta: auditLog.meta,
          occurredAt: auditLog.at,
        })
        .from(auditLog)
        .where(whereClause)
        .orderBy(desc(auditLog.at), desc(auditLog.id))
        .limit(fetchLimit);

      const lowerSearch = search?.trim().toLowerCase() ?? '';

      const mapped = rows
        .map((row) => {
          const category = mapActionToCategory(row.action);
          const meta =
            (row.meta ?? {}) as Record<string, unknown>;
          const actorLabel =
            typeof meta.actorName === 'string' ? meta.actorName : null;
          return {
            id: Number(row.id),
            occurredAt: row.occurredAt.toISOString(),
            action: row.action,
            category,
            actorId: row.actorId ?? null,
            actorLabel,
            resourceType: row.resourceType,
            resourceId: row.resourceId ?? null,
            meta,
          };
        })
        .filter((event) => {
          if (type && event.category !== type) {
            return false;
          }
          if (!lowerSearch) {
            return true;
          }
          const haystack = [
            event.action,
            event.resourceType,
            event.resourceId ?? '',
            event.actorId ?? '',
            event.actorLabel ?? '',
            JSON.stringify(event.meta ?? {}),
          ]
            .join(' ')
            .toLowerCase();
          return haystack.includes(lowerSearch);
        });

      const events = mapped.slice(0, limit);

      const [totalRow] = await request.db
        .select({ count: sql<number>`count(*)::int` })
        .from(auditLog)
        .where(eq(auditLog.tenantId, request.tenantId));

      const schemaCountPromise =
        SCHEMA_ACTIONS.length === 0
          ? Promise.resolve([{ count: 0 }])
          : request.db
              .select({ count: sql<number>`count(*)::int` })
              .from(auditLog)
              .where(
                and(
                  eq(auditLog.tenantId, request.tenantId),
                  inArray(auditLog.action, SCHEMA_ACTIONS),
                ),
              );

      const recordCountPromise =
        RECORD_ACTIONS.length === 0
          ? Promise.resolve([{ count: 0 }])
          : request.db
              .select({ count: sql<number>`count(*)::int` })
              .from(auditLog)
              .where(
                and(
                  eq(auditLog.tenantId, request.tenantId),
                  inArray(auditLog.action, RECORD_ACTIONS),
                ),
              );

      const uniqueActorsPromise = request.db
        .select({
          count: sql<number>`count(DISTINCT ${auditLog.actorId})::int`,
        })
        .from(auditLog)
        .where(eq(auditLog.tenantId, request.tenantId));

      const lastEventPromise = request.db
        .select({ occurredAt: auditLog.at })
        .from(auditLog)
        .where(eq(auditLog.tenantId, request.tenantId))
        .orderBy(desc(auditLog.at))
        .limit(1);

      const [[schemaCountRow], [recordCountRow], [uniqueActorsRow], lastEventRows] =
        await Promise.all([
          schemaCountPromise,
          recordCountPromise,
          uniqueActorsPromise,
          lastEventPromise,
        ]);

      const summary = {
        totalEvents: totalRow?.count ?? 0,
        schemaEdits: schemaCountRow?.count ?? 0,
        recordUpdates: recordCountRow?.count ?? 0,
        uniqueActors: uniqueActorsRow?.count ?? 0,
        lastEventAt:
          lastEventRows?.[0]?.occurredAt?.toISOString() ?? null,
      };

      const parsed = getActivityLogResponseSchema.parse({
        events,
        summary,
      });

      return parsed;
    },
  );
};

export default auditRoutes;

function mapActionToCategory(action: string): ActivityCategory {
  if (SCHEMA_ACTIONS.includes(action)) {
    return 'schema';
  }
  if (RECORD_ACTIONS.includes(action)) {
    return 'record';
  }
  if (
    IMPORT_ACTIONS.includes(action) ||
    action.startsWith('import.')
  ) {
    return 'import';
  }
  if (
    INTEGRATION_ACTIONS.includes(action) ||
    action.startsWith('integration.')
  ) {
    return 'integration';
  }
  if (
    GOVERNANCE_ACTIONS.includes(action) ||
    action.startsWith('permission.') ||
    action.startsWith('governance.')
  ) {
    return 'governance';
  }
  return 'governance';
}
