import { FastifyPluginAsync } from 'fastify';
import { ZodError } from 'zod';
import { sql } from 'drizzle-orm';
import { getValidationSchema, compileFilter } from '@ddms/core';
import {
  hasPermission,
  checkWritePermissions,
  filterReadableFields,
} from '../../lib/authz';
import * as recordDal from '../../lib/dal/records';
import * as metadataDal from '../../lib/dal/metadata';
import * as schema from '@ddms/db';
import { recordAuditEvent } from '../../lib/audit';
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
      if (!hasPermission(request.user, 'record:create')) {
        return reply.code(403).send({
          code: 'FORBIDDEN',
          message: 'You do not have permission to create records.',
        });
      }

      const { entityType, fieldDefs, user } = request;
      const validationSchema = getValidationSchema(entityType.id, fieldDefs);
      const validationResult = validationSchema.safeParse(request.body.data);

      if (!validationResult.success) {
        return reply.code(400).send({
          code: 'VALIDATION_ERROR',
          message: 'The request body is invalid.',
          errors: formatZodError(validationResult.error),
        });
      }

      const recordData = validationResult.data;
      const newRecord = await recordDal.createRecord(
        request.db,
        request.tenantId,
        entityType.id,
        { data: recordData, createdBy: user.id },
      );

      await recordAuditEvent(request.db, fastify.log, {
        tenantId: request.tenantId,
        actorId: user.id,
        action: 'record.created',
        resourceType: 'record',
        resourceId: newRecord.id,
        meta: {
          entityTypeId: entityType.id,
          entityTypeKey: entityType.key,
          dataKeys: Object.keys(recordData),
        },
      });

      const filteredRecord = filterReadableFields(user, fieldDefs, newRecord);
      return reply.code(201).send(filteredRecord);
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
      if (!hasPermission(request.user, 'record:read')) {
        return reply.code(403).send({
          code: 'FORBIDDEN',
          message: 'You do not have permission to search records.',
        });
      }

      const { entityType, fieldDefs } = request;
      const { filter, sort, limit = 50, cursor } = request.body;

      if (sort && sort.length > 1) {
        // For now, we only support sorting by one field as per the DAL.
        return reply.code(400).send({
          code: 'BAD_REQUEST',
          message: 'Sorting by multiple fields is not currently supported.',
        });
      }

      if (sort && sort.length > 0) {
        const sortableFields = new Set([
          'id',
          'version',
          'createdAt',
          'updatedAt',
          'createdBy',
          'updatedBy',
          ...fieldDefs.map((f) => f.key),
        ]);
        if (!sortableFields.has(sort[0].field)) {
          return reply.code(400).send({
            code: 'BAD_REQUEST',
            message: `Invalid sort field: ${sort[0].field}`,
          });
        }
      }

      const compiled = compileFilter(filter);
      // This is a workaround to convert a parameterized SQL string with $1, $2 placeholders
      // into a Drizzle `SQL` object, which the `sql` template literal function provides.
      const chunks = compiled.sql.split(/\$\d+/);
      const template: TemplateStringsArray = Object.assign(chunks, {
        raw: chunks,
      });
      const filterSql = sql(template, ...compiled.params);

      const offset = cursor
        ? parseInt(Buffer.from(cursor, 'base64').toString('ascii'), 10)
        : 0;

      const searchResult = await recordDal.searchRecords(
        request.db,
        request.tenantId,
        entityType.id,
        {
          filter: filterSql,
          sort: sort?.[0],
          pagination: { limit, offset },
        },
      );
      let rows = searchResult.rows;
      const total = searchResult.total;

      const nextCursor =
        offset + rows.length < total
          ? Buffer.from(String(offset + limit)).toString('base64')
          : null;

      rows = rows.map((row) =>
        filterReadableFields(request.user, fieldDefs, row),
      );

      return reply.send({ rows, nextCursor, total });
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
      if (!hasPermission(request.user, 'record:read')) {
        return reply.code(403).send({
          code: 'FORBIDDEN',
          message: 'You do not have permission to view this record.',
        });
      }
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

      const filteredRecord = filterReadableFields(
        request.user,
        request.fieldDefs,
        record,
      );
      return reply.send(filteredRecord);
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
      if (!hasPermission(request.user, 'record:update')) {
        return reply.code(403).send({
          code: 'FORBIDDEN',
          message: 'You do not have permission to update records.',
        });
      }

      const { recordId } = request.params;
      const { version, data } = request.body;
      const { entityType, fieldDefs, user } = request;

      const forbiddenFields = checkWritePermissions(user, fieldDefs, data);
      if (forbiddenFields.length > 0) {
        return reply.code(403).send({
          code: 'FORBIDDEN',
          message: `You do not have permission to write to the following fields: ${forbiddenFields.join(
            ', ',
          )}`,
        });
      }

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

      const partialData = validationResult.data;
      const updatedRecord = await recordDal.updateRecord(
        request.db,
        request.tenantId,
        recordId,
        version,
        { data: partialData, updatedBy: user.id },
      );

      if (!updatedRecord) {
        // This can happen in a race condition if the record was updated after our version check
        return reply.code(409).send({
          code: 'CONFLICT',
          message:
            'The record has been updated by another process. Please refresh and try again.',
        });
      }

      const filteredRecord = filterReadableFields(
        user,
        fieldDefs,
        updatedRecord,
      );

      await recordAuditEvent(request.db, fastify.log, {
        tenantId: request.tenantId,
        actorId: user.id,
        action: 'record.updated',
        resourceType: 'record',
        resourceId: recordId,
        meta: {
          entityTypeId: entityType.id,
          entityTypeKey: entityType.key,
          changedKeys: Object.keys(partialData),
        },
      });

      return reply.send(filteredRecord);
    },
  );
};

export default entitiesRoutes;
