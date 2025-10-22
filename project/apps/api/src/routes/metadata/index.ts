import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as dal from '../../lib/dal/metadata';
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

const metadataRoutes: FastifyPluginAsync = async (fastify) => {
  // A placeholder tenantId until authentication is implemented
  const tenantId = '00000000-0000-0000-0000-000000000000';

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
          200: z.array(entityTypeSchema),
        },
      },
    },
    async (request, reply) => {
      const entityTypes = await dal.findEntityTypesByTenant(
        request.db,
        tenantId,
      );
      return reply.send(entityTypes);
    },
  );

  fastify.post(
    '/entity-types',
    {
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
        tenantId,
        request.body,
      );
      return reply.code(201).send(newEntityType);
    },
  );

  fastify.patch(
    '/entity-types/:entityTypeId',
    {
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
        tenantId,
        entityTypeId,
      );
      if (!existing) {
        return reply
          .code(404)
          .send({ code: 'NOT_FOUND', message: 'Entity type not found' });
      }

      const updatedEntityType = await dal.updateEntityType(
        request.db,
        tenantId,
        entityTypeId,
        request.body,
      );
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
          200: z.array(fieldDefSchema),
        },
      },
    },
    async (request, reply) => {
      const { entityTypeId } = request.params;

      const entityType = await dal.findEntityTypeById(
        request.db,
        tenantId,
        entityTypeId,
      );
      if (!entityType) {
        return reply
          .code(404)
          .send({ code: 'NOT_FOUND', message: 'Entity type not found' });
      }

      const fieldDefs = await dal.findFieldDefsByEntityType(
        request.db,
        tenantId,
        entityTypeId,
      );
      return reply.send(fieldDefs);
    },
  );

  fastify.post(
    '/entity-types/:entityTypeId/fields',
    {
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
        tenantId,
        entityTypeId,
      );
      if (!entityType) {
        return reply
          .code(404)
          .send({ code: 'NOT_FOUND', message: 'Entity type not found' });
      }

      const newFieldDef = await dal.createFieldDef(
        request.db,
        tenantId,
        entityTypeId,
        request.body,
      );
      return reply.code(201).send(newFieldDef);
    },
  );

  fastify.patch(
    '/fields/:fieldId',
    {
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

      const existing = await dal.findFieldDefById(request.db, tenantId, fieldId);
      if (!existing) {
        return reply
          .code(404)
          .send({ code: 'NOT_FOUND', message: 'Field definition not found' });
      }

      const updatedFieldDef = await dal.updateFieldDef(
        request.db,
        tenantId,
        fieldId,
        request.body,
      );
      return reply.send(updatedFieldDef);
    },
  );
};

export default metadataRoutes;