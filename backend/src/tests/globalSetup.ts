import pg from 'pg';

export default async function setup() {
  const originalUrl = process.env.DATABASE_URL || 'postgres://postgres:password123@localhost:5432/od_approval_db';
  process.env.DATABASE_URL = originalUrl;

  const testDbName = 'od_approval_test_db';
  const connectionUrlObj = new URL(originalUrl);
  // Connect to postgres default db to perform administrative query
  connectionUrlObj.pathname = '/postgres';
  const baseConnectionString = connectionUrlObj.toString();

  const client = new pg.Client({ connectionString: baseConnectionString });
  await client.connect();

  try {
    const res = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [testDbName]);
    if (res.rowCount === 0) {
      await client.query(`CREATE DATABASE ${testDbName}`);
      console.log(`\nCreated isolation test database: ${testDbName}`);
    }
  } catch (err) {
    console.error('Error ensuring test database exists:', err);
    throw err;
  } finally {
    await client.end();
  }
}
