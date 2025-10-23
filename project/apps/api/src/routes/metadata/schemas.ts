import { z } from 'zod';

// Reusable parameter schemas
export const entityTypeIdParamsSchema = z.object({
  entityTypeId: z.string().uuid(),
});

export const fieldIdParamsSchema = z.object({
  fieldId: z.string().uuid(),
});

// Entity Type Schemas
export const entityTypeSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  label: z.string(),
  description: z.string().nullable(),
});

export const createEntityTypeBodySchema = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string().nullable().optional(),
});

export const updateEntityTypeBodySchema = z.object({
  label: z.string().optional(),
  description: z.string().nullable().optional(),
});

// Field Definition Schemas
const fieldKindEnum = z.enum([
  'text',
  'number',
  'date',
  'select',
  'relation',
  'boolean',
]);

export const fieldDefSchema = z.object({
  id: z.string().uuid(),
  entityTypeId: z.string().uuid(),
  key: z.string(),
  label: z.string(),
  kind: fieldKindEnum,
  required: z.boolean(),
  uniqueWithinType: z.boolean(),
  searchable: z.boolean(),
  indexed: z.boolean(),
  options: z.record(z.any()),
  validate: z.record(z.any()),
  acl: z.record(z.any()),
  position: z.number().int(),
  active: z.boolean(),
});

export const createFieldDefBodySchema = z.object({
  key: z.string(),
  label: z.string(),
  kind: fieldKindEnum,
  required: z.boolean().optional(),
  uniqueWithinType: z.boolean().optional(),
  searchable: z.boolean().optional(),
  indexed: z.boolean().optional(),
  options: z.record(z.any()).optional(),
  validate: z.record(z.any()).optional(),
  acl: z.record(z.any()).optional(),
  position: z.number().int().optional(),
});

export const updateFieldDefBodySchema = z.object({
  label: z.string().optional(),
  required: z.boolean().optional(),
  uniqueWithinType: z.boolean().optional(),
  searchable: z.boolean().optional(),
  indexed: z.boolean().optional(),
  options: z.record(z.any()).optional(),
  validate: z.record(z.any()).optional(),
  acl: z.record(z.any()).optional(),
  position: z.number().int().optional(),
  active: z.boolean().optional(),
});
