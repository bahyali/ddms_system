import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { and, asc, eq } from 'drizzle-orm';
import { fieldDefs, fieldIndexes } from '@ddms/db';

type FieldIndexRow = typeof fieldIndexes.$inferSelect;
type FieldDefRow = typeof fieldDefs.$inferSelect;

declare module 'fastify' {
  interface FastifyInstance {
    fieldIndexer: FieldIndexer;
  }
}

const DEFAULT_INTERVAL_MS = 5000;

export class FieldIndexer {
  private timer?: NodeJS.Timeout;
  private isProcessing = false;

  constructor(
    private readonly fastify: FastifyInstance,
    private readonly intervalMs: number = DEFAULT_INTERVAL_MS,
  ) {}

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, this.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  async enqueueJob(params: {
    tenantId: string;
    entityTypeId: string;
    fieldId: string;
  }) {
    const { tenantId, entityTypeId, fieldId } = params;
    const indexName = FieldIndexer.buildIndexName(fieldId);
    const now = new Date();

    await this.fastify.db
      .insert(fieldIndexes)
      .values({
        tenantId,
        entityTypeId,
        fieldId,
        indexName,
      })
      .onConflictDoUpdate({
        target: fieldIndexes.fieldId,
        set: {
          tenantId,
          entityTypeId,
          indexName,
          status: 'pending',
          attempts: 0,
          lastError: null,
          startedAt: null,
          completedAt: null,
          updatedAt: now,
        },
      });

    // Attempt to process immediately instead of waiting for the next interval.
    void this.tick();
  }

  private async tick() {
    if (this.isProcessing) return;

    this.isProcessing = true;
    try {
      await this.processNextJob();
    } catch (err) {
      this.fastify.log.error(
        { err },
        'Unexpected error during field index processing tick',
      );
    } finally {
      this.isProcessing = false;
    }
  }

  private async processNextJob() {
    const [job] = await this.fastify.db
      .select()
      .from(fieldIndexes)
      .where(eq(fieldIndexes.status, 'pending'))
      .orderBy(asc(fieldIndexes.createdAt))
      .limit(1);

    if (!job) {
      return;
    }

    const claimResult = await this.fastify.db
      .update(fieldIndexes)
      .set({
        status: 'in_progress',
        attempts: job.attempts + 1,
        startedAt: new Date(),
        updatedAt: new Date(),
        lastError: null,
      })
      .where(
        and(
          eq(fieldIndexes.id, job.id),
          eq(fieldIndexes.status, 'pending'),
        ),
      )
      .returning();

    if (claimResult.length === 0) {
      return; // Another worker claimed it.
    }

    try {
      const field = await this.fastify.db
        .select()
        .from(fieldDefs)
        .where(eq(fieldDefs.id, job.fieldId))
        .limit(1);

      const [fieldDef] = field;
      if (!fieldDef) {
        throw new Error(
          `Field definition ${job.fieldId} not found for indexing`,
        );
      }

      await this.ensureIndex(job, fieldDef);

      await this.fastify.db
        .update(fieldIndexes)
        .set({
          status: 'ready',
          completedAt: new Date(),
          updatedAt: new Date(),
          lastError: null,
        })
        .where(eq(fieldIndexes.id, job.id));
    } catch (err) {
      this.fastify.log.error(
        { err, jobId: job.id },
        'Failed to build field index',
      );
      await this.fastify.db
        .update(fieldIndexes)
        .set({
          status: 'failed',
          updatedAt: new Date(),
          lastError: err instanceof Error ? err.message : String(err),
        })
        .where(eq(fieldIndexes.id, job.id));
    }
  }

  private async ensureIndex(job: FieldIndexRow, field: FieldDefRow) {
    const existing = await this.fastify.pg.query(
      `SELECT 1 FROM pg_indexes WHERE schemaname = $1 AND indexname = $2`,
      ['public', job.indexName],
    );

    if (existing.rowCount > 0) {
      return;
    }

    const expression = FieldIndexer.buildIndexExpression(field);
    const tenantLiteral = FieldIndexer.escapeLiteral(job.tenantId);
    const entityTypeLiteral = FieldIndexer.escapeLiteral(job.entityTypeId);

    const statement = `
      CREATE INDEX CONCURRENTLY ${job.indexName}
      ON public.records USING btree (${expression})
      WHERE tenant_id = '${tenantLiteral}'
        AND entity_type_id = '${entityTypeLiteral}';
    `;

    await this.fastify.pg.query(statement);
  }

  static buildIndexName(fieldId: string) {
    const base = `idx_records_field_${fieldId.replace(/-/g, '')}`;
    if (!/^[a-zA-Z0-9_]+$/.test(base)) {
      throw new Error(`Unsafe characters detected in index name ${base}`);
    }
    return base.slice(0, 60);
  }

  static buildIndexExpression(field: FieldDefRow) {
    const keyLiteral = FieldIndexer.escapeLiteral(field.key);
    switch (field.kind) {
      case 'number':
        return `((data ->> '${keyLiteral}')::numeric)`;
      case 'date':
        return `((data ->> '${keyLiteral}')::timestamptz)`;
      case 'boolean':
        return `((data ->> '${keyLiteral}')::boolean)`;
      case 'relation':
        return `((data ->> '${keyLiteral}')::uuid)`;
      default:
        return `(data ->> '${keyLiteral}')`;
    }
  }

  private static escapeLiteral(value: string) {
    return value.replace(/'/g, "''");
  }
}

const indexerPlugin: FastifyPluginAsync = async (fastify) => {
  const intervalMs = process.env.FIELD_INDEXER_INTERVAL_MS
    ? Number(process.env.FIELD_INDEXER_INTERVAL_MS)
    : DEFAULT_INTERVAL_MS;

  const indexer = new FieldIndexer(fastify, intervalMs);
  fastify.decorate('fieldIndexer', indexer);

  indexer.start();

  fastify.addHook('onClose', async () => {
    indexer.stop();
  });
};

export default fp(indexerPlugin, {
  name: 'fieldIndexer',
  dependencies: ['db'],
});
