import { z } from 'zod';

export const activityCategorySchema = z.enum([
  'schema',
  'record',
  'governance',
  'import',
  'integration',
]);

export const getActivityLogQuerySchema = z.object({
  limit: z
    .preprocess(
      (value) => (value === undefined ? undefined : Number(value)),
      z.number().int().min(1).max(200),
    )
    .default(50),
  cursor: z.string().optional(),
  type: activityCategorySchema.optional(),
  search: z.string().max(200).optional(),
});

export const activityLogEventSchema = z.object({
  id: z.number(),
  occurredAt: z.string(),
  action: z.string(),
  category: activityCategorySchema,
  actorId: z.string().nullable(),
  actorLabel: z.string().nullable(),
  resourceType: z.string(),
  resourceId: z.string().nullable(),
  meta: z.record(z.any()).default({}),
});

export const activityLogSummarySchema = z.object({
  totalEvents: z.number(),
  schemaEdits: z.number(),
  recordUpdates: z.number(),
  uniqueActors: z.number(),
  lastEventAt: z.string().nullable(),
});

export const getActivityLogResponseSchema = z.object({
  events: activityLogEventSchema.array(),
  summary: activityLogSummarySchema,
});
