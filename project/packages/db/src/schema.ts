import { relations, sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  customType,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

// Enums and Custom Types
export const fieldKindEnum = pgEnum('field_kind', [
  'text',
  'number',
  'date',
  'select',
  'relation',
  'boolean',
]);

export const indexStatusEnum = pgEnum('index_status', [
  'pending',
  'in_progress',
  'ready',
  'failed',
]);

const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' });

// Table Definitions

/**
 * 6.1 Tenancy
 * An organization using the system. Tenants are strictly isolated.
 */
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * 6.2 Entity Types & Field Definitions
 * An Entity Type is a template describing a kind of record (e.g., "user", "project").
 */
export const entityTypes = pgTable(
  'entity_types',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    label: text('label').notNull(),
    description: text('description'),
  },
  (table) => ({
    uniqueKey: unique('entity_types_tenant_id_key_unique').on(
      table.tenantId,
      table.key,
    ),
  }),
);

/**
 * A Field Definition describes a custom field's metadata (key, label, kind, constraints).
 */
export const fieldDefs = pgTable(
  'field_defs',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    entityTypeId: uuid('entity_type_id')
      .notNull()
      .references(() => entityTypes.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    label: text('label').notNull(),
    kind: fieldKindEnum('kind').notNull(),
    required: boolean('required').notNull().default(false),
    uniqueWithinType: boolean('unique_within_type').notNull().default(false),
    searchable: boolean('searchable').notNull().default(true),
    indexed: boolean('indexed').notNull().default(false),
    options: jsonb('options').notNull().default(sql`'{}'::jsonb`),
    validate: jsonb('validate').notNull().default(sql`'{}'::jsonb`),
    acl: jsonb('acl').notNull().default(sql`'{}'::jsonb`),
    position: integer('position').notNull().default(0),
    active: boolean('active').notNull().default(true),
  },
  (table) => ({
    uniqueKey: unique('field_defs_tenant_id_entity_type_id_key_unique').on(
      table.tenantId,
      table.entityTypeId,
      table.key,
    ),
  }),
);

/**
 * 6.3 Records (Property Bag)
 * A Record is one instance of an entity type, storing business data in a JSONB property bag.
 */
export const records = pgTable('records', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  entityTypeId: uuid('entity_type_id')
    .notNull()
    .references(() => entityTypes.id, { onDelete: 'cascade' }),
  data: jsonb('data').notNull().default(sql`'{}'::jsonb`),
  fts: tsvector('fts'),
  version: integer('version').notNull().default(1),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * 6.4 Edges (Relationships)
 * An Edge represents a relationship between two records.
 */
export const edges = pgTable(
  'edges',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    fieldId: uuid('field_id')
      .notNull()
      .references(() => fieldDefs.id, { onDelete: 'cascade' }),
    fromRecordId: uuid('from_record_id')
      .notNull()
      .references(() => records.id, { onDelete: 'cascade' }),
    toRecordId: uuid('to_record_id')
      .notNull()
      .references(() => records.id, { onDelete: 'cascade' }),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    uniqueKey:
      unique('edges_tenant_id_field_id_from_record_id_to_record_id_unique').on(
        table.tenantId,
        table.fieldId,
        table.fromRecordId,
        table.toRecordId,
      ),
  }),
);

/**
 * 6.5 History & Auditing
 * Stores historical versions of records.
 */
export const recordVersions = pgTable('record_versions', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  recordId: uuid('record_id')
    .notNull()
    .references(() => records.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  data: jsonb('data').notNull(),
  changedBy: uuid('changed_by'),
  changedAt: timestamp('changed_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Logs significant actions within the system for auditing purposes.
 */
export const auditLog = pgTable('audit_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  actorId: uuid('actor_id'),
  action: text('action').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: uuid('resource_id'),
  meta: jsonb('meta').notNull().default(sql`'{}'::jsonb`),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Tracks background index creation jobs for field definitions.
 */
export const fieldIndexes = pgTable(
  'field_indexes',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    entityTypeId: uuid('entity_type_id')
      .notNull()
      .references(() => entityTypes.id, { onDelete: 'cascade' }),
    fieldId: uuid('field_id')
      .notNull()
      .references(() => fieldDefs.id, { onDelete: 'cascade' }),
    indexName: text('index_name').notNull(),
    status: indexStatusEnum('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    uniqueField: unique('field_indexes_field_id_unique').on(table.fieldId),
    uniqueIndexName: unique('field_indexes_index_name_unique').on(
      table.indexName,
    ),
  }),
);

// Relations

export const tenantsRelations = relations(tenants, ({ many }) => ({
  entityTypes: many(entityTypes),
  fieldDefs: many(fieldDefs),
  records: many(records),
  edges: many(edges),
  fieldIndexes: many(fieldIndexes),
  auditLogs: many(auditLog),
}));

export const entityTypesRelations = relations(entityTypes, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [entityTypes.tenantId],
    references: [tenants.id],
  }),
  fieldDefs: many(fieldDefs),
  records: many(records),
  fieldIndexes: many(fieldIndexes),
}));

export const fieldDefsRelations = relations(fieldDefs, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [fieldDefs.tenantId],
    references: [tenants.id],
  }),
  entityType: one(entityTypes, {
    fields: [fieldDefs.entityTypeId],
    references: [entityTypes.id],
  }),
  edges: many(edges),
  indexJob: one(fieldIndexes, {
    fields: [fieldDefs.id],
    references: [fieldIndexes.fieldId],
  }),
}));

export const recordsRelations = relations(records, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [records.tenantId],
    references: [tenants.id],
  }),
  entityType: one(entityTypes, {
    fields: [records.entityTypeId],
    references: [entityTypes.id],
  }),
  edgesFrom: many(edges, { relationName: 'edgesFrom' }),
  edgesTo: many(edges, { relationName: 'edgesTo' }),
  versions: many(recordVersions),
}));

export const edgesRelations = relations(edges, ({ one }) => ({
  tenant: one(tenants, {
    fields: [edges.tenantId],
    references: [tenants.id],
  }),
  fieldDef: one(fieldDefs, {
    fields: [edges.fieldId],
    references: [fieldDefs.id],
  }),
  fromRecord: one(records, {
    fields: [edges.fromRecordId],
    references: [records.id],
    relationName: 'edgesFrom',
  }),
  toRecord: one(records, {
    fields: [edges.toRecordId],
    references: [records.id],
    relationName: 'edgesTo',
  }),
}));

export const recordVersionsRelations = relations(recordVersions, ({ one }) => ({
  record: one(records, {
    fields: [recordVersions.recordId],
    references: [records.id],
  }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  tenant: one(tenants, {
    fields: [auditLog.tenantId],
    references: [tenants.id],
  }),
}));

export const fieldIndexesRelations = relations(fieldIndexes, ({ one }) => ({
  tenant: one(tenants, {
    fields: [fieldIndexes.tenantId],
    references: [tenants.id],
  }),
  entityType: one(entityTypes, {
    fields: [fieldIndexes.entityTypeId],
    references: [entityTypes.id],
  }),
  field: one(fieldDefs, {
    fields: [fieldIndexes.fieldId],
    references: [fieldDefs.id],
  }),
}));
