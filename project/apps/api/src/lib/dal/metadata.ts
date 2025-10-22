import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import * as schema from '@ddms/db';

type Db = FastifyInstance['db'];
type NewEntityType = typeof schema.entityTypes.$inferInsert;
type NewFieldDef = typeof schema.fieldDefs.$inferInsert;

//
// Entity Type Functions
//

/**
 * Creates a new entity type for a specific tenant.
 * @param db The Drizzle database instance.
 * @param tenantId The ID of the tenant.
 * @param data The data for the new entity type.
 * @returns The newly created entity type.
 */
export async function createEntityType(
  db: Db,
  tenantId: string,
  data: Omit<NewEntityType, 'tenantId' | 'id'>,
) {
  const [result] = await db
    .insert(schema.entityTypes)
    .values({
      ...data,
      tenantId,
    })
    .returning();
  return result;
}

/**
 * Finds all entity types belonging to a specific tenant.
 * @param db The Drizzle database instance.
 * @param tenantId The ID of the tenant.
 * @returns An array of entity types.
 */
export async function findEntityTypesByTenant(db: Db, tenantId: string) {
  return db.query.entityTypes.findMany({
    where: eq(schema.entityTypes.tenantId, tenantId),
  });
}

/**
 * Finds a single entity type by its ID, ensuring it belongs to the correct tenant.
 * @param db The Drizzle database instance.
 * @param tenantId The ID of the tenant.
 * @param entityTypeId The ID of the entity type to find.
 * @returns The entity type, or undefined if not found.
 */
export async function findEntityTypeById(
  db: Db,
  tenantId: string,
  entityTypeId: string,
) {
  return db.query.entityTypes.findFirst({
    where: and(
      eq(schema.entityTypes.id, entityTypeId),
      eq(schema.entityTypes.tenantId, tenantId),
    ),
  });
}

/**
 * Finds a single entity type by its key, ensuring it belongs to the correct tenant.
 * @param db The Drizzle database instance.
 * @param tenantId The ID of the tenant.
 * @param key The key of the entity type to find.
 * @returns The entity type, or undefined if not found.
 */
export async function findEntityTypeByKey(
  db: Db,
  tenantId: string,
  key: string,
) {
  return db.query.entityTypes.findFirst({
    where: and(
      eq(schema.entityTypes.key, key),
      eq(schema.entityTypes.tenantId, tenantId),
    ),
  });
}

/**
 * Updates an existing entity type.
 * @param db The Drizzle database instance.
 * @param tenantId The ID of the tenant.
 * @param entityTypeId The ID of the entity type to update.
 * @param data The data to update.
 * @returns The updated entity type.
 */
export async function updateEntityType(
  db: Db,
  tenantId: string,
  entityTypeId: string,
  data: Partial<Omit<NewEntityType, 'tenantId' | 'id'>>,
) {
  const [result] = await db
    .update(schema.entityTypes)
    .set(data)
    .where(
      and(
        eq(schema.entityTypes.id, entityTypeId),
        eq(schema.entityTypes.tenantId, tenantId),
      ),
    )
    .returning();
  return result;
}

//
// Field Definition Functions
//

/**
 * Creates a new field definition for a specific entity type and tenant.
 * @param db The Drizzle database instance.
 * @param tenantId The ID of the tenant.
 * @param entityTypeId The ID of the parent entity type.
 * @param data The data for the new field definition.
 * @returns The newly created field definition.
 */
export async function createFieldDef(
  db: Db,
  tenantId: string,
  entityTypeId: string,
  data: Omit<NewFieldDef, 'tenantId' | 'id' | 'entityTypeId'>,
) {
  const [result] = await db
    .insert(schema.fieldDefs)
    .values({
      ...data,
      tenantId,
      entityTypeId,
    })
    .returning();
  return result;
}

/**
 * Finds all field definitions for a specific entity type.
 * @param db The Drizzle database instance.
 * @param tenantId The ID of the tenant.
 * @param entityTypeId The ID of the entity type.
 * @returns An array of field definitions.
 */
export async function findFieldDefsByEntityType(
  db: Db,
  tenantId: string,
  entityTypeId: string,
) {
  return db.query.fieldDefs.findMany({
    where: and(
      eq(schema.fieldDefs.tenantId, tenantId),
      eq(schema.fieldDefs.entityTypeId, entityTypeId),
    ),
  });
}

/**
 * Finds a single field definition by its ID, ensuring it belongs to the correct tenant.
 * @param db The Drizzle database instance.
 * @param tenantId The ID of the tenant.
 * @param fieldDefId The ID of the field definition to find.
 * @returns The field definition, or undefined if not found.
 */
export async function findFieldDefById(
  db: Db,
  tenantId: string,
  fieldDefId: string,
) {
  return db.query.fieldDefs.findFirst({
    where: and(
      eq(schema.fieldDefs.id, fieldDefId),
      eq(schema.fieldDefs.tenantId, tenantId),
    ),
  });
}

/**
 * Updates an existing field definition.
 * @param db The Drizzle database instance.
 * @param tenantId The ID of the tenant.
 * @param fieldDefId The ID of the field definition to update.
 * @param data The data to update.
 * @returns The updated field definition.
 */
export async function updateFieldDef(
  db: Db,
  tenantId: string,
  fieldDefId: string,
  data: Partial<Omit<NewFieldDef, 'tenantId' | 'id' | 'entityTypeId'>>,
) {
  const [result] = await db
    .update(schema.fieldDefs)
    .set(data)
    .where(
      and(
        eq(schema.fieldDefs.id, fieldDefId),
        eq(schema.fieldDefs.tenantId, tenantId),
      ),
    )
    .returning();
  return result;
}