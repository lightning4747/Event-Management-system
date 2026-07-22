import { pool } from './index';
import { logger } from '../utils/logger';

const clear = async () => {
  try {
    logger.info('Clearing all data from the database...');

    await pool.query(`
      TRUNCATE TABLE 
        certificate_deadline_extensions,
        certificates,
        certificate_requirements,
        application_approval_history,
        od_applications,
        students,
        faculty,
        users
      CASCADE;
    `);

    logger.info('Database cleared successfully. All tables are now empty.');
  } catch (error) {
    logger.error({ error }, 'Database clear failed.');
    process.exit(1);
  } finally {
    await pool.end();
  }
};

clear();
