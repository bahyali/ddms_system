import { z } from 'zod';

//
// Parameters
//

export const entityTypeKeyParamsSchema = z.object({
  entityTypeKey: z.string(),
});

export const recordIdParamsSchema = entityTypeKeyParamsSchema.extend({
  recordId: z.string().uuid(),
});

//
// Payloads
//

export const recordCreateBodySchema = z.object({
  data: z.object({}).passthrough(),
});

export const recordUpdateBodySchema = z.object({
  data: z.object({}).passthrough(),
  version: z.number().int().positive(),
});

//
// Search & Filter Schemas (recursive)
//

// Base schema to allow for recursive type definition
const baseFilterSchema = z.object({
  op: z.string(),
  field: z.string().optional(),
  value: z.unknown().optional(),
  values: z.array(z.unknown()).optional(),
  query: z.string().optional(),
});

type Filter = z.infer<typeof baseFilterSchema> & {
  filters?: Filter[];
};

export const filterSchema: z.ZodType<Filter> = baseFilterSchema.extend({
  filters: z.lazy(() => filterSchema.array()).optional(),
});

export const sortSchema = z.object({
  field: z.string(),
  dir: z.enum(['asc', 'desc']).default('asc'),
});

export const searchRequestBodySchema = z.object({
  filter: filterSchema.optional(),
  sort: z.array(sortSchema).optional(),
  limit: z.number().int().min(1).max(1000).default(50).optional(),
  cursor: z.string().nullable().optional(),
});

//
// Responses
//

export const recordSchema = z.object({
  id: z.string().uuid(),
  entityTypeId: z.string().uuid(),
  version: z.number().int(),
  data: z.record(z.unknown()),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
  createdAt: z.date().transform((d) => d.toISOString()),
  updatedAt: z.date().transform((d) => d.toISOString()),
});

export const searchResponseSchema = z.object({
  rows: z.array(recordSchema),
  nextCursor: z.string().nullable(),
});

export const validationErrorDetailSchema = z.object({
  path: z.string(),
  code: z.string(),
  message: z.string(),
});

export const errorSchema = z.object({
  code: z.string(),
  message: z.string(),
  requestId: z.string().uuid(),
  errors: z.array(validationErrorDetailSchema).optional(),
});