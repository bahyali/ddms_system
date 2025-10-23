import { FastifyPluginAsync } from 'fastify';
import { PgError } from 'pg';
import { hasPermission } from '../../lib/authz';
import * as edgeDal from '../../lib/dal/edges';
import * as recordDal from '../../lib/dal/records';
import * as metadataDal from '../../lib/dal/metadata';
import {
  createRelationBodySchema,
  relationIdParamsSchema,
  relationSchema,
  listRelationsQuerySchema,
  relationWithContextSchema,
} from './schemas';
import { recordAuditEvent } from '../../lib/audit';
import { and, eq } from 'drizzle-orm';
import * as schema from '@ddms/db';

const relationsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/relations',
    {
      schema: {
        tags: ['Relations'],
        summary: 'List Relations',
        querystring: listRelationsQuerySchema,
        response: {
          200: relationWithContextSchema.array(),
        },
      },
    },
    async (request, reply) => {
      if (!hasPermission(request.user, 'relation:read')) {
        return reply.code(403).send({
          code: 'FORBIDDEN',
          message: 'You do not have permission to view relations.',
        });
      }

      const { record_id, field_id, role = 'from' } = listRelationsQuerySchema.parse(
        request.query,
      );

      const filters = [eq(schema.edges.tenantId, request.tenantId)];
      if (field_id) {
        filters.push(eq(schema.edges.fieldId, field_id));
      }
      if (role === 'from') {
        filters.push(eq(schema.edges.fromRecordId, record_id));
      } else {
        filters.push(eq(schema.edges.toRecordId, record_id));
      }

      const edges = await request.db
        .select({
          id: schema.edges.id,
          fieldId: schema.edges.fieldId,
          fromRecordId: schema.edges.fromRecordId,
          toRecordId: schema.edges.toRecordId,
          createdBy: schema.edges.createdBy,
          createdAt: schema.edges.createdAt,
          fieldKey: schema.fieldDefs.key,
          fieldLabel: schema.fieldDefs.label,
          fieldEntityTypeId: schema.fieldDefs.entityTypeId,
          fieldOptions: schema.fieldDefs.options,
        })
        .from(schema.edges)
        .innerJoin(schema.fieldDefs, eq(schema.edges.fieldId, schema.fieldDefs.id))
        .where(and(...filters));

      const relatedIds = new Set<string>();
      for (const edge of edges) {
        const relatedId = role === 'from' ? edge.toRecordId : edge.fromRecordId;
        relatedIds.add(relatedId);
      }

      const relatedRecords = new Map<string, Awaited<ReturnType<typeof recordDal.findRecordById>>>();
      await Promise.all(
        Array.from(relatedIds).map(async (relatedId) => {
          const related = await recordDal.findRecordById(
            request.db,
            request.tenantId,
            relatedId,
          );
          if (related) {
            relatedRecords.set(relatedId, related);
          }
        }),
      );

      const responsePayload = edges.map((edge) => {
        const relationOptions = (edge.fieldOptions as {
          relation?: { target_entity_type_id?: string; cardinality?: 'one' | 'many' };
        } | null)?.relation;

        const relatedId = role === 'from' ? edge.toRecordId : edge.fromRecordId;
        const relatedRecord = relatedRecords.get(relatedId) ?? null;
        const relatedData = relatedRecord?.data as Record<string, unknown> | undefined;
        const labelFromData = relatedData
          ? ['name', 'label', 'title']
              .map((key) => relatedData[key])
              .find((value): value is string => typeof value === 'string' && value.length > 0) ?? null
          : null;

        const relatedEntityTypeId =
          relatedRecord?.entityTypeId ??
          (role === 'from'
            ? relationOptions?.target_entity_type_id ?? edge.fieldEntityTypeId
            : edge.fieldEntityTypeId);

        return {
          id: edge.id,
          field_id: edge.fieldId,
          from_record_id: edge.fromRecordId,
          to_record_id: edge.toRecordId,
          createdBy: edge.createdBy,
          createdAt: edge.createdAt.toISOString(),
          direction: role,
          field: {
            id: edge.fieldId,
            key: edge.fieldKey,
            label: edge.fieldLabel,
            entityTypeId: edge.fieldEntityTypeId,
            targetEntityTypeId: relationOptions?.target_entity_type_id ?? null,
            cardinality: relationOptions?.cardinality ?? null,
          },
          relatedRecord: {
            id: relatedId,
            entityTypeId: relatedEntityTypeId,
            label: labelFromData,
          },
        };
      });

      return reply.send(responsePayload);
    },
  );

  // Create Relation
  fastify.post(
    '/relations',
    {
      schema: {
        tags: ['Relations'],
        summary: 'Create Relation',
        body: createRelationBodySchema,
        response: {
          201: relationSchema,
        },
      },
    },
    async (request, reply) => {
      if (!hasPermission(request.user, 'relation:create')) {
        return reply.code(403).send({
          code: 'FORBIDDEN',
          message: 'You do not have permission to create relations.',
        });
      }

      const { field_id, from_record_id, to_record_id } = request.body;
      const { tenantId, db, user } = request;

      // Pre-flight checks to ensure all referenced entities exist for this tenant.
      // This provides clearer error messages than relying solely on the DB trigger.
      const [fieldDef, fromRecord, toRecord] = await Promise.all([
        metadataDal.findFieldDefById(db, tenantId, field_id),
        recordDal.findRecordById(db, tenantId, from_record_id),
        recordDal.findRecordById(db, tenantId, to_record_id),
      ]);

      if (!fieldDef) {
        return reply
          .code(404)
          .send({ code: 'NOT_FOUND', message: 'Field definition not found.' });
      }
      if (!fromRecord) {
        return reply
          .code(404)
          .send({ code: 'NOT_FOUND', message: 'Source record not found.' });
      }
      if (!toRecord) {
        return reply
          .code(404)
          .send({ code: 'NOT_FOUND', message: 'Target record not found.' });
      }

      try {
        const newEdge = await edgeDal.createEdge(db, tenantId, {
          fieldId: field_id,
          fromRecordId: from_record_id,
          toRecordId: to_record_id,
          createdBy: user.id,
        });

        const responsePayload = {
          id: newEdge.id,
          field_id: newEdge.fieldId,
          from_record_id: newEdge.fromRecordId,
          to_record_id: newEdge.toRecordId,
          createdBy: newEdge.createdBy,
          createdAt: newEdge.createdAt.toISOString(),
        };

        await recordAuditEvent(request.db, fastify.log, {
          tenantId,
          actorId: user.id,
          action: 'relation.created',
          resourceType: 'relation',
          resourceId: newEdge.id,
          meta: {
            fieldId: newEdge.fieldId,
            fromRecordId: newEdge.fromRecordId,
            toRecordId: newEdge.toRecordId,
          },
        });

        return reply.code(201).send(responsePayload);
      } catch (err) {
        if (err instanceof PgError) {
          // unique_violation on the unique index
          if (err.code === '23505') {
            return reply.code(409).send({
              code: 'CONFLICT',
              message: 'This relation already exists.',
            });
          }
          // Error raised from the edges_validate trigger
          if (
            err.message.includes('edge target type mismatch') ||
            err.message.includes('is not relation')
          ) {
            return reply.code(400).send({
              code: 'BAD_REQUEST',
              message: err.message,
            });
          }
        }
        request.log.error(err, 'Failed to create relation');
        throw err; // Let the generic error handler take over
      }

    },
  );

  // Delete Relation
  fastify.delete(
    '/relations/:relationId',
    {
      preHandler: async (request, reply) => {
        if (!hasPermission(request.user, 'relation:delete')) {
          return reply.code(403).send({
            code: 'FORBIDDEN',
            message: 'You do not have permission to delete relations.',
          });
        }
      },
      schema: {
        tags: ['Relations'],
        summary: 'Delete Relation',
        params: relationIdParamsSchema,
        response: {
          204: { type: 'null', description: 'Relation deleted successfully.' },
        },
      },
    },
    async (request, reply) => {
      const { relationId } = request.params;
      const deletedEdge = await edgeDal.deleteEdge(
        request.db,
        request.tenantId,
        relationId,
      );

      if (!deletedEdge) {
        return reply
          .code(404)
          .send({ code: 'NOT_FOUND', message: 'Relation not found.' });
      }

      await recordAuditEvent(request.db, fastify.log, {
        tenantId: request.tenantId,
        actorId: request.user.id,
        action: 'relation.deleted',
        resourceType: 'relation',
        resourceId: relationId,
        meta: {
          fieldId: deletedEdge.fieldId,
          fromRecordId: deletedEdge.fromRecordId,
          toRecordId: deletedEdge.toRecordId,
        },
      });

      return reply.code(204).send();
    },
  );
};

export default relationsRoutes;
