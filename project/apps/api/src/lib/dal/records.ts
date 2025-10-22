import { and, asc, desc, eq, sql, SQL } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import * as schema from '@ddms/db';

//
// Type Definitions
//

type Db = FastifyInstance['db'];
type Record = typeof schema.records.$inferSelect;
type RecordData = Record<string, unknown>;

/**
 * Options for the searchRecords function.
 */
export interface SearchOptions {
  /** The compiled WHERE clause from the Filter DSL Compiler */
  filter: SQL;
  /** Sorting options */
  sort?: { field: keyof Record; direction: 'asc' | 'desc' };
  /** Pagination options */
  pagination: { limit: number; offset: number };
}

//
// Record Functions
//

/**
 * Creates a new record for a specific entity type and tenant.
 * @param db The Drizzle database instance.
 * @param tenantId The ID of the tenant.
 * @param entityTypeId The ID of the entity type.
 * @param payload The data for the new record.
 * @returns The newly created record.
 */
export async function createRecord(
  db: Db,
  tenantId: string,
  entityTypeId: string,
  payload: { data: RecordData; createdBy?: string },
) {
  const [result] = await db
    .insert(schema.records)
    .values({
      tenantId,
      entityTypeId,
      data: payload.data,
      createdBy: payload.createdBy,
    })
    .returning();
  return result;
}

/**
 * Finds a single record by its ID, ensuring it belongs to the correct tenant.
 * @param db The Drizzle database instance.
 * @param tenantId The ID of the tenant.
 * @param recordId The ID of the record to find.
 * @returns The record, or undefined if not found or not owned by the tenant.
 */
export async function findRecordById(
  db: Db,
  tenantId: string,
  recordId: string,
) {
  return db.query.records.findFirst({
    where: and(
      eq(schema.records.id, recordId),
      eq(schema.records.tenantId, tenantId),
    ),
  });
}

/**
 * Updates an existing record, using optimistic concurrency control.
 * @param db The Drizzle database instance.
 * @param tenantId The ID of the tenant.
 * @param recordId The ID of the record to update.
 * @param version The expected version of the record.
 * @param payload The data to update.
 * @returns The updated record, or undefined if the record was not found or the version mismatched.
 */
export async function updateRecord(
  db: Db,
  tenantId: string,
  recordId: string,
  version: number,
  payload: { data: Partial<RecordData>; updatedBy?: string },
) {
  const [result] = await db
    .update(schema.records)
    .set({
      data: sql`${schema.records.data} || ${payload.data}`,
      updatedBy: payload.updatedBy,
      updatedAt: new Date(), // Explicitly set updatedAt
    })
    .where(
      and(
        eq(schema.records.id, recordId),
        eq(schema.records.tenantId, tenantId),
        eq(schema.records.version, version),
      ),
    )
    .returning();
  return result;
}

/**
 * Searches for records based on a compiled filter, with sorting and pagination.
 * @param db The Drizzle database instance.
 * @param tenantId The ID of the tenant.
 * @param entityTypeId The ID of the entity type to search within.
 * @param options The search, sorting, and pagination options.
 * @returns An array of found records.
 */
export async function searchRecords(
  db: Db,
  tenantId: string,
  entityTypeId: string,
  options: SearchOptions,
) {
  const conditions = [
    eq(schema.records.tenantId, tenantId),
    eq(schema.records.entityTypeId, entityTypeId),
    options.filter,
  ];

  let query = db
    .select()
    .from(schema.records)
    .where(and(...conditions));

  if (options.sort) {
    const sortColumn = schema.records[options.sort.field];
    if (sortColumn) {
      const direction = options.sort.direction === 'asc' ? asc : desc;
      query = query.orderBy(direction(sortColumn));
    }
  }

  query = query
    .limit(options.pagination.limit)
    .offset(options.pagination.offset);

  return query;
}