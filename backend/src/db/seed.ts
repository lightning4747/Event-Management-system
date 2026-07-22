import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './index';
import { logger } from '../utils/logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const seed = async () => {
  try {
    logger.info('Starting database seeding from spec/temp.sql...');

    const sqlFilePath = path.resolve(__dirname, '../../../spec/temp.sql');

    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`Seed SQL file not found at: ${sqlFilePath}`);
    }

    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

    // 1. Run the seed SQL file contents as a query batch
    logger.info('Executing temp.sql...');
    await pool.query(sqlContent);

    // 2. Provision the default Administrator account (since it is not present in temp.sql)
    logger.info('Provisioning default Administrator user...');
    await pool.query(`
      INSERT INTO users (user_id, username, password_hash, role) 
      VALUES ('ADMIN001', 'admin', '$2a$12$zn6uVfTGdOLR7gCTxSII0eMZlFZw7cmTFuJsJVar4pqOYyuRO6yyK', 'Administrator')
      ON CONFLICT (user_id) DO NOTHING;
    `);
    await pool.query(`
      INSERT INTO faculty (user_id, full_name, designation) 
      VALUES ('ADMIN001', 'System Administrator', 'IT Admin')
      ON CONFLICT (user_id) DO NOTHING;
    `);

    logger.info('Database seeded successfully.');
  } catch (error) {
    logger.error({ error }, 'Database seeding failed.');
    process.exit(1);
  } finally {
    await pool.end();
  }
};

seed();
