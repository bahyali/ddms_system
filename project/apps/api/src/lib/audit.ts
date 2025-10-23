import type { FastifyBaseLogger } from 'fastify';
import type { FastifyInstance } from 'fastify';
import { auditLog } from '@ddms/db';

type Db = FastifyInstance['db'];

export interface AuditEvent {
  tenantId: string;
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  meta?: Record<string, unknown>;
}

/**
 * Writes an entry to the audit log table. Errors are swallowed and logged so that
 * user-facing requests are not impacted by audit failures.
 */
export async function recordAuditEvent(
  db: Db,
  logger: FastifyBaseLogger,
  event: AuditEvent,
) {
  try {
    await db.insert(auditLog).values({
      tenantId: event.tenantId,
      actorId: event.actorId ?? null,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId ?? null,
      meta: event.meta ?? {},
    });
  } catch (err) {
    logger.error({ err, action: event.action }, 'Failed to record audit event');
  }
}
