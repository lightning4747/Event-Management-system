import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './index';
import { logger } from '../utils/logger';
import path from 'path';

export async function runMigrations() {
  try {
    // Safely ensure 'Skipped' value exists in PostgreSQL cert_status enum type
    await pool.query(`ALTER TYPE "public"."cert_status" ADD VALUE IF NOT EXISTS 'Skipped';`);

    const migrationsFolder = path.join(process.cwd(), 'drizzle');
    logger.info(`Running database migrations from ${migrationsFolder}...`);
    await migrate(db, { migrationsFolder });
    logger.info('Database migrations completed successfully.');
  } catch (err) {
    logger.error({ err }, 'Failed to run database migrations.');
    throw err;
  }
}

// Allow direct CLI execution: bun src/db/migrate.ts
if (process.argv[1]?.endsWith('migrate.ts')) {
  runMigrations()
    .then(() => {
      console.log('✅ Migrations applied successfully.');
      pool.end();
    })
    .catch((err) => {
      console.error('❌ Migration failed:', err);
      pool.end();
      process.exit(1);
    });
}
