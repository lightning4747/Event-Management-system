import { checkCertificateDeadlines } from '../modules/certificates/certificates.service';
import { logger } from '../utils/logger';
import { pool } from '../db';

async function main() {
  try {
    logger.info('Starting standalone certificate deadline check worker job...');
    const expiredCount = await checkCertificateDeadlines();
    logger.info(`Certificate deadline check completed successfully. Expired count: ${expiredCount}`);
    await pool.end();
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Standalone certificate deadline check failed.');
    await pool.end();
    process.exit(1);
  }
}

main();
