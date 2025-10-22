import { FastifyPluginAsync } from 'fastify';
import { ZodError } from 'zod';
import { sql } from 'drizzle-orm';
import { getValidationSchema, compileFilter } from '@ddms/core';
import * as recordDal from '../../lib/dal/records';
import * as metadataDal from '../../lib/dal/metadata';
import * as schema from '@ddms/db';
import {
  entityTypeKeyParamsSchema,
  recordCreateBodySchema,
  recordIdParamsSchema,
  recordSchema,
  recordUpdateBodySchema,
  searchRequestBodySchema,
  searchResponseSchema,
} from './schemas';

type EntityType = typeof schema.entityTypes.$inferSelect;
type FieldDef = typeof schema.fieldDefs.$inferSelect;

declare module 'fastify' {
  interface FastifyRequest {
    entityType: EntityType;
    fieldDefs: FieldDef[];
  }
}

function formatZodError(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    code: issue.code,
    message: issue.message,
  }));
}

const entitiesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', async (request, reply) => {
    const params = entityTypeKeyParamsSchema.parse(request.params);
    const { entityTypeKey } = params;

    const entityType = await metadataDal.findEntityTypeByKey(
      request.db,
      request.tenantId,
      entityTypeKey,
    );

    if (!entityType) {
      return reply
        .code(404)
        .send({ code: 'NOT_FOUND', message: 'Entity type not found' });
    }

    const fieldDefs = await metadataDal.findFieldDefsByEntityType(
      request.db,
      request.tenantId,
      entityType.id,
    );

    request.entityType = entityType;
    request.fieldDefs = fieldDefs;
  });

  // Create Record
  fastify.post(
    '/:entityTypeKey',
    {
      schema: {
        tags: ['Records'],
        summary: 'Create Record',
        params: entityTypeKeyParamsSchema,
        body: recordCreateBodySchema,
        response: { 201: recordSchema },
      },
    },
    async (request, reply) => {
      const { entityType, fieldDefs } = request;
      const validationSchema = getValidationSchema(entityType.id, fieldDefs);
      const validationResult = validationSchema.safeParse(request.body.data);

      if (!validationResult.success) {
        return reply.code(400).send({
          code: 'VALIDATION_ERROR',
          message: 'The request body is invalid.',
          errors: formatZodError(validationResult.error),
        });
      }

      const newRecord = await recordDal.createRecord(
        request.db,
        request.tenantId,
        entityType.id,
        { data: validationResult.data },
      );

      return reply.code(201).send(newRecord);
    },
  );

  // Search Records
  fastify.post(
    '/:entityTypeKey/search',
    {
      schema: {
        tags: ['Records'],
        summary: 'Search Records',
        params: entityTypeKeyParamsSchema,
        body: searchRequestBodySchema,
        response: { 200: searchResponseSchema },
      },
    },
    async (request, reply) => {
      const { entityType } = request;
      const { filter, sort, limit = 50, cursor } = request.body;

      const compiled = compileFilter(filter);
      const chunks = compiled.sql.split(/\$\d+/);
      const filterSql = sql(chunks as any, ...compiled.params);

      const offset = cursor
        ? parseInt(Buffer.from(cursor, 'base64').toString('ascii'), 10)
        : 0;

      const rows = await recordDal.searchRecords(
        request.db,
        request.tenantId,
        entityType.id,
        {
          filter: filterSql,
          sort: sort?.[0] as any, // DAL currently supports one sort field
          pagination: { limit, offset },
        },
      );

      const nextCursor =
        rows.length === limit
          ? Buffer.from(String(offset + limit)).toString('base64')
          : null;

      return reply.send({ rows, nextCursor });
    },
  );

  // Get Record
  fastify.get(
    '/:entityTypeKey/:recordId',
    {
      schema: {
        tags: ['Records'],
        summary: 'Get Record by ID',
        params: recordIdParamsSchema,
        response: { 200: recordSchema },
      },
    },
    async (request, reply) => {
      const { recordId } = request.params;
      const record = await recordDal.findRecordById(
        request.db,
        request.tenantId,
        recordId,
      );

      if (!record || record.entityTypeId !== request.entityType.id) {
        return reply
          .code(404)
          .send({ code: 'NOT_FOUND', message: 'Record not found' });
      }

      return reply.send(record);
    },
  );

  // Update Record
  fastify.patch(
    '/:entityTypeKey/:recordId',
    {
      schema: {
        tags: ['Records'],
        summary: 'Update Record',
        params: recordIdParamsSchema,
        body: recordUpdateBodySchema,
        response: { 200: recordSchema },
      },
    },
    async (request, reply) => {
      const { recordId } = request.params;
      const { version, data } = request.body;
      const { entityType, fieldDefs } = request;

      const existingRecord = await recordDal.findRecordById(
        request.db,
        request.tenantId,
        recordId,
      );

      if (
        !existingRecord ||
        existingRecord.entityTypeId !== entityType.id
      ) {
        return reply
          .code(404)
          .send({ code: 'NOT_FOUND', message: 'Record not found' });
      }

      if (existingRecord.version !== version) {
        return reply.code(409).send({
          code: 'CONFLICT',
          message:
            'The record has been updated by another process. Please refresh and try again.',
        });
      }

      const validationSchema = getValidationSchema(
        entityType.id,
        fieldDefs,
      ).partial();
      const validationResult = validationSchema.safeParse(data);

      if (!validationResult.success) {
        return reply.code(400).send({
          code: 'VALIDATION_ERROR',
          message: 'The request body is invalid.',
          errors: formatZodError(validationResult.error),
        });
      }

      const updatedRecord = await recordDal.updateRecord(
        request.db,
        request.tenantId,
        recordId,
        version,
        { data: validationResult.data },
      );

      if (!updatedRecord) {
        // This can happen in a race condition if the record was updated after our version check
        return reply.code(409).send({
          code: 'CONFLICT',
          message:
            'The record has been updated by another process. Please refresh and try again.',
        });
      }

      return reply.send(updatedRecord);
    },
  );
};

export default entitiesRoutes;