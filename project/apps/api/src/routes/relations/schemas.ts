import { z } from 'zod';

//
// Parameters
//

export const relationIdParamsSchema = z.object({
  relationId: z.string().uuid(),
});

//
// Payloads
//

export const createRelationBodySchema = z.object({
  field_id: z.string().uuid(),
  from_record_id: z.string().uuid(),
  to_record_id: z.string().uuid(),
});

export const listRelationsQuerySchema = z.object({
  record_id: z.string().uuid(),
  role: z.enum(['from', 'to']).default('from'),
  field_id: z.string().uuid().optional(),
});

//
// Responses
//

export const relationSchema = z.object({
  id: z.string().uuid(),
  field_id: z.string().uuid(),
  from_record_id: z.string().uuid(),
  to_record_id: z.string().uuid(),
  createdBy: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
});

export const relationWithContextSchema = relationSchema.extend({
  direction: z.enum(['from', 'to']),
  field: z.object({
    id: z.string().uuid(),
    key: z.string(),
    label: z.string(),
    entityTypeId: z.string().uuid(),
    targetEntityTypeId: z.string().uuid().nullable(),
    cardinality: z.enum(['one', 'many']).nullable(),
  }),
  relatedRecord: z.object({
    id: z.string().uuid(),
    entityTypeId: z.string().uuid(),
    label: z.string().nullable(),
  }),
});
