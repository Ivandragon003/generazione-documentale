'use strict';

const { getPool } = require('../../database/database');

/**
 * Inserisce un log audit
 */
async function insertLog(entityType, entityId, action, actor = 'system', metadata = null) {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO audit_log (entity_type, entity_id, action, actor, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, entity_type, entity_id, action, actor, metadata, created_at`,
    [entityType, entityId, action, actor, metadata ? JSON.stringify(metadata) : null],
  );
  return result.rows[0];
}

/**
 * Trova log per entità specifica
 */
async function findByEntity(entityType, entityId, { limit = 50, offset = 0 } = {}) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, entity_type, entity_id, action, actor, metadata, created_at
     FROM audit_log
     WHERE entity_type = $1 AND entity_id = $2
     ORDER BY created_at DESC
     LIMIT $3 OFFSET $4`,
    [entityType, entityId, limit, offset],
  );
  return result.rows;
}

/**
 * Trova tutti i log con filtri opzionali.
 * Restituisce { data, total } coerente con gli altri moduli.
 */
async function findAll({ entityType, actor, fromDate, toDate, limit = 50, offset = 0 } = {}) {
  const pool = getPool();

  let baseQuery = 'FROM audit_log WHERE 1=1';
  const params = [];
  let paramIndex = 1;

  if (entityType) {
    baseQuery += ` AND entity_type = $${paramIndex}`;
    params.push(entityType);
    paramIndex += 1;
  }

  if (actor) {
    baseQuery += ` AND actor = $${paramIndex}`;
    params.push(actor);
    paramIndex += 1;
  }

  if (fromDate) {
    baseQuery += ` AND created_at >= $${paramIndex}`;
    params.push(new Date(fromDate));
    paramIndex += 1;
  }

  if (toDate) {
    baseQuery += ` AND created_at <= $${paramIndex}`;
    params.push(new Date(toDate));
    paramIndex += 1;
  }

  const countResult = await pool.query(`SELECT COUNT(*) AS total ${baseQuery}`, params);
  const total = parseInt(countResult.rows[0].total, 10);

  const dataResult = await pool.query(
    `SELECT id, entity_type, entity_id, action, actor, metadata, created_at
     ${baseQuery}
     ORDER BY created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset],
  );

  return { data: dataResult.rows, total };
}

module.exports = {
  insertLog,
  findByEntity,
  findAll,
};