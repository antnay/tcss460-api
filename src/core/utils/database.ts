import { Pool } from 'pg';
import dotenvx from '@dotenvx/dotenvx';

dotenvx.config();

const pool: Pool = new Pool({
  // user: process.env.DB_USER,
  // password: process.env.DB_PASSWORD,
  // host: process.env.DB_HOST,
  // port: Number(process.env.DB_PORT),
  // database: process.env.DB_NAME,
  connectionString: process.env.DB_URL,
  connectionTimeoutMillis: 2000,
  query_timeout: 4000,
});

/**
 * Initialize the PostgreSQL connection pool.
 * Ensures the pool is created only once and is reused throughout the application.
 */
export const initializeDatabase = async () => {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()'); // simple test query
    // client.release();
    console.log('Database pool initialized and connection verified.');
  } catch (err) {
    console.error('Failed to initialize database:', err);
    process.exit(1); // stop app if DB cannot connect
  }
};

/**
 * Gracefully close the PostgreSQL connection pool.
 * Ensures all connections are closed and resources are cleaned up.
 */
export const closeDatabase = async (): Promise<void> => {
  if (!pool || pool.ended) {
    console.warn('Database pool is not initialized or already closed.');
    return;
  }

  try {
    await pool.end();
    console.log('Database pool closed.');
  } catch (error) {
    console.error('Error while closing the database pool:', error);
    throw error;
  }
};

export default pool;