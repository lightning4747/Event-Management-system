import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';
import { logger } from '../utils/logger';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  logger.error('DATABASE_URL environment variable is missing.');
  throw new Error('DATABASE_URL environment variable is missing.');
}

export const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: false,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle client');
});

export const db = drizzle(pool, { schema });
