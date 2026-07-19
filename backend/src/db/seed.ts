import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './index';
import { logger } from '../utils/logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const seed = async () => {
  try {
    logger.info('Starting database seeding...');

    const sqlFilePath = path.resolve(__dirname, '../../../spec/temp.sql');
    
    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`Seed SQL file not found at: ${sqlFilePath}`);
    }

    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

    // Run the seed SQL file contents as a query batch
    await pool.query(sqlContent);

    logger.info('Database seeded successfully.');
  } catch (error) {
    logger.error({ error }, 'Database seeding failed.');
    process.exit(1);
  } finally {
    await pool.end();
  }
};

seed();
