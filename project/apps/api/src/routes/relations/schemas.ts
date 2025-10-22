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