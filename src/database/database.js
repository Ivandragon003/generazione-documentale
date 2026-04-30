'use strict';

const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT, 10) || 5432,
      user:     process.env.DB_USER     || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME     || 'mac_documents',
      max:      10,
      idleTimeoutMillis:       30000,
      connectionTimeoutMillis: 2000,
    });
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client:', err.message);
    });
  }
  return pool;
}

/**
 * Esegue `fn(client)` dentro una transazione PostgreSQL.
 * Fa automaticamente BEGIN, COMMIT o ROLLBACK, e rilascia il client.
 *
 * @param {import('pg').Pool} pool
 * @param {(client: import('pg').PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withTransaction(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { getPool, withTransaction };
