import { FastifyPluginAsync } from 'fastify';
import * as dal from '../../lib/dal/metadata';
import { hasPermission } from '../../lib/authz';
import {
  createEntityTypeBodySchema,
  entityTypeSchema,
  updateEntityTypeBodySchema,
  entityTypeIdParamsSchema,
  fieldIdParamsSchema,
  fieldDefSchema,
  createFieldDefBodySchema,
  updateFieldDefBodySchema,
} from './schemas';
import { recordAuditEvent } from '../../lib/audit';

const metadataRoutes: FastifyPluginAsync = async (fastify) => {
  //
  // Entity Type Routes
  //

  fastify.get(
    '/entity-types',
    {
      schema: {
        tags: ['Metadata'],
        summary: 'List Entity Types',
        response: {
          200: entityTypeSchema.array(),
        },
      },
    },
    async (request, reply) => {
      const entityTypes = await dal.findEntityTypesByTenant(
        request.db,
        request.tenantId,
      );
      return reply.send(entityTypes);
    },
  );

  fastify.post(
    '/entity-types',
    {
      preHandler: async (request, reply) => {
        if (!hasPermission(request.user, 'entity-type:create')) {
          return reply.code(403).send({
            code: 'FORBIDDEN',
            message: 'You do not have permission to create entity types.',
          });
        }
      },
      schema: {
        tags: ['Metadata'],
        summary: 'Create Entity Type',
        body: createEntityTypeBodySchema,
        response: {
          201: entityTypeSchema,
        },
      },
    },
    async (request, reply) => {
      const newEntityType = await dal.createEntityType(
        request.db,
        request.tenantId,
        request.body,
      );

      await recordAuditEvent(request.db, fastify.log, {
        tenantId: request.tenantId,
        actorId: request.user.id,
        action: 'entity_type.created',
        resourceType: 'entity_type',
        resourceId: newEntityType.id,
        meta: { key: newEntityType.key },
      });

      return reply.code(201).send(newEntityType);
    },
  );

  fastify.patch(
    '/entity-types/:entityTypeId',
    {
      preHandler: async (request, reply) => {
        if (!hasPermission(request.user, 'entity-type:update')) {
          return reply.code(403).send({
            code: 'FORBIDDEN',
            message: 'You do not have permission to update entity types.',
          });
        }
      },
      schema: {
        tags: ['Metadata'],
        summary: 'Update Entity Type',
        params: entityTypeIdParamsSchema,
        body: updateEntityTypeBodySchema,
        response: {
          200: entityTypeSchema,
        },
      },
    },
    async (request, reply) => {
      const { entityTypeId } = request.params;

      const existing = await dal.findEntityTypeById(
        request.db,
        request.tenantId,
        entityTypeId,
      );
      if (!existing) {
        return reply
          .code(404)
          .send({ code: 'NOT_FOUND', message: 'Entity type not found' });
      }

      const updatedEntityType = await dal.updateEntityType(
        request.db,
        request.tenantId,
        entityTypeId,
        request.body,
      );

      await recordAuditEvent(request.db, fastify.log, {
        tenantId: request.tenantId,
        actorId: request.user.id,
        action: 'entity_type.updated',
        resourceType: 'entity_type',
        resourceId: entityTypeId,
        meta: { changes: request.body },
      });

      return reply.send(updatedEntityType);
    },
  );

  //
  // Field Definition Routes
  //

  fastify.get(
    '/entity-types/:entityTypeId/fields',
    {
      schema: {
        tags: ['Metadata'],
        summary: 'List Field Definitions',
        params: entityTypeIdParamsSchema,
        response: {
          200: fieldDefSchema.array(),
        },
      },
    },
    async (request, reply) => {
      const { entityTypeId } = request.params;

      const entityType = await dal.findEntityTypeById(
        request.db,
        request.tenantId,
        entityTypeId,
      );
      if (!entityType) {
        return reply
          .code(404)
          .send({ code: 'NOT_FOUND', message: 'Entity type not found' });
      }

      const fieldDefs = await dal.findFieldDefsByEntityType(
        request.db,
        request.tenantId,
        entityTypeId,
      );
      return reply.send(fieldDefs);
    },
  );

  fastify.post(
    '/entity-types/:entityTypeId/fields',
    {
      preHandler: async (request, reply) => {
        if (!hasPermission(request.user, 'field-def:create')) {
          return reply.code(403).send({
            code: 'FORBIDDEN',
            message: 'You do not have permission to create field definitions.',
          });
        }
      },
      schema: {
        tags: ['Metadata'],
        summary: 'Create Field Definition',
        params: entityTypeIdParamsSchema,
        body: createFieldDefBodySchema,
        response: {
          201: fieldDefSchema,
        },
      },
    },
    async (request, reply) => {
      const { entityTypeId } = request.params;

      const entityType = await dal.findEntityTypeById(
        request.db,
        request.tenantId,
        entityTypeId,
      );
      if (!entityType) {
        return reply
          .code(404)
          .send({ code: 'NOT_FOUND', message: 'Entity type not found' });
      }

      const newFieldDef = await dal.createFieldDef(
        request.db,
        request.tenantId,
        entityTypeId,
        request.body,
      );

      if (newFieldDef.indexed) {
        await fastify.fieldIndexer.enqueueJob({
          tenantId: request.tenantId,
          entityTypeId,
          fieldId: newFieldDef.id,
        });
      }

      await recordAuditEvent(request.db, fastify.log, {
        tenantId: request.tenantId,
        actorId: request.user.id,
        action: 'field_def.created',
        resourceType: 'field_def',
        resourceId: newFieldDef.id,
        meta: {
          entityTypeId,
          key: newFieldDef.key,
          indexed: newFieldDef.indexed,
        },
      });

      return reply.code(201).send(newFieldDef);
    },
  );

  fastify.patch(
    '/fields/:fieldId',
    {
      preHandler: async (request, reply) => {
        if (!hasPermission(request.user, 'field-def:update')) {
          return reply.code(403).send({
            code: 'FORBIDDEN',
            message: 'You do not have permission to update field definitions.',
          });
        }
      },
      schema: {
        tags: ['Metadata'],
        summary: 'Update Field Definition',
        params: fieldIdParamsSchema,
        body: updateFieldDefBodySchema,
        response: {
          200: fieldDefSchema,
        },
      },
    },
    async (request, reply) => {
      const { fieldId } = request.params;

      const existing = await dal.findFieldDefById(
        request.db,
        request.tenantId,
        fieldId,
      );
      if (!existing) {
        return reply
          .code(404)
          .send({ code: 'NOT_FOUND', message: 'Field definition not found' });
      }

      const updatedFieldDef = await dal.updateFieldDef(
        request.db,
        request.tenantId,
        fieldId,
        request.body,
      );

      const indexedRequested = request.body.indexed;
      if (
        indexedRequested === true &&
        existing.indexed === false &&
        updatedFieldDef?.indexed
      ) {
        await fastify.fieldIndexer.enqueueJob({
          tenantId: request.tenantId,
          entityTypeId: existing.entityTypeId,
          fieldId,
        });
      }

      await recordAuditEvent(request.db, fastify.log, {
        tenantId: request.tenantId,
        actorId: request.user.id,
        action: 'field_def.updated',
        resourceType: 'field_def',
        resourceId: fieldId,
        meta: { changes: request.body },
      });

      return reply.send(updatedFieldDef);
    },
  );
};

export default metadataRoutes;
