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
  fieldId: z.string().uuid().transform((val) => val).as('field_id'),
  fromRecordId: z.string().uuid().transform((val) => val).as('from_record_id'),
  toRecordId: z.string().uuid().transform((val) => val).as('to_record_id'),
  createdBy: z.string().uuid().nullable(),
  createdAt: z.date().transform((d) => d.toISOString()),
});