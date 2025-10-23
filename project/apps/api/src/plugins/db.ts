import { drizzle } from 'drizzle-orm/node-postgres';
import fp from 'fastify-plugin';
import { Pool } from 'pg';
import * as schema from '@ddms/db';

// Augment FastifyInstance with the db decorator
declare module 'fastify' {
  interface FastifyInstance {
    db: ReturnType<typeof drizzle<typeof schema>>;
  }
  interface FastifyRequest {
    db: ReturnType<typeof drizzle<typeof schema>>;
  }
}

/**
 * This plugin creates a Drizzle instance and decorates the Fastify instance with it.
 * It also handles graceful shutdown of the database connection pool.
 */
export default fp(async function dbPlugin(fastify) {
  if (!process.env.DATABASE_URL) {
    fastify.log.error('DATABASE_URL environment variable is not set.');
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool, { schema });

  fastify.decorate('db', db);
  fastify.decorateRequest('db', db);

  fastify.addHook('onClose', async (instance) => {
    instance.log.info('Closing database connection pool...');
    await pool.end();
    instance.log.info('Database connection pool closed.');
  });
}, { name: 'db' });
