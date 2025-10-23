import { z } from 'zod';

export const fieldIndexParamsSchema = z.object({
  fieldId: z.string().uuid(),
});

export const fieldIndexStatusEnum = z.enum([
  'pending',
  'in_progress',
  'ready',
  'failed',
]);

export const fieldIndexSchema = z.object({
  id: z.string().uuid(),
  fieldId: z.string().uuid(),
  entityTypeId: z.string().uuid(),
  indexName: z.string(),
  status: fieldIndexStatusEnum,
  attempts: z.number().int(),
  lastError: z.string().nullable(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  fieldKey: z.string(),
  fieldLabel: z.string(),
});
