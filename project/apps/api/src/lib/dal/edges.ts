import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import * as schema from '@ddms/db';

//
// Type Definitions
//

type Db = FastifyInstance['db'];
type NewEdge = typeof schema.edges.$inferInsert;

//
// Edge Functions
//

/**
 * Creates a new edge (relationship) between two records.
 * @param db The Drizzle database instance.
 * @param tenantId The ID of the tenant.
 * @param payload The data for the new edge.
 * @returns The newly created edge.
 */
export async function createEdge(
  db: Db,
  tenantId: string,
  payload: Omit<NewEdge, 'tenantId' | 'id'>,
) {
  const [result] = await db
    .insert(schema.edges)
    .values({
      ...payload,
      tenantId,
    })
    .returning();
  return result;
}

/**
 * Finds a single edge by its ID, ensuring it belongs to the correct tenant.
 * @param db The Drizzle database instance.
 * @param tenantId The ID of the tenant.
 * @param edgeId The ID of the edge to find.
 * @returns The edge, or undefined if not found or not owned by the tenant.
 */
export async function findEdgeById(db: Db, tenantId: string, edgeId: string) {
  return db.query.edges.findFirst({
    where: and(eq(schema.edges.id, edgeId), eq(schema.edges.tenantId, tenantId)),
  });
}

/**
 * Deletes an existing edge by its ID.
 * @param db The Drizzle database instance.
 * @param tenantId The ID of the tenant.
 * @param edgeId The ID of the edge to delete.
 * @returns The deleted edge, or undefined if not found.
 */
export async function deleteEdge(db: Db, tenantId: string, edgeId: string) {
  const [result] = await db
    .delete(schema.edges)
    .where(and(eq(schema.edges.id, edgeId), eq(schema.edges.tenantId, tenantId)))
    .returning();
  return result;
}

/**
 * Replaces all edges for a given record and field with the provided target IDs.
 * @param db The Drizzle database instance.
 * @param tenantId The tenant ID.
 * @param fieldId The relation field definition ID.
 * @param fromRecordId The source record ID.
 * @param toRecordIds A list of target record IDs.
 * @param actorId The user performing the operation.
 */
export async function replaceEdgesForField(
  db: Db,
  tenantId: string,
  fieldId: string,
  fromRecordId: string,
  toRecordIds: string[],
  actorId?: string,
) {
  await db
    .delete(schema.edges)
    .where(
      and(
        eq(schema.edges.tenantId, tenantId),
        eq(schema.edges.fieldId, fieldId),
        eq(schema.edges.fromRecordId, fromRecordId),
      ),
    );

  if (toRecordIds.length === 0) {
    return;
  }

  const uniqueIds = Array.from(new Set(toRecordIds));

  await db.insert(schema.edges).values(
    uniqueIds.map((toRecordId) => ({
      tenantId,
      fieldId,
      fromRecordId,
      toRecordId,
      createdBy: actorId ?? null,
    })),
  );
}
