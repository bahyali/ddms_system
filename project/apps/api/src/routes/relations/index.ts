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
} from './schemas';
import { recordAuditEvent } from '../../lib/audit';

const relationsRoutes: FastifyPluginAsync = async (fastify) => {
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
