const { getPool } = require('../../database');

class AuditService {
  async log(entityType, entityId, action, actor = 'system', metadata = null) {
    const pool = getPool();
    try {
      await pool.query(
        `INSERT INTO audit_log (entity_type, entity_id, action, actor, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [entityType, entityId, action, actor, metadata ? JSON.stringify(metadata) : null],
      );
    } catch (err) {
      // Audit log non deve bloccare l'operazione principale
      console.error(`Audit log failed: ${err.message}`);
    }
  }

  async findByEntity(entityType, entityId, { limit = 50, offset = 0 } = {}) {
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

  async findAll({ entityType, actor, fromDate, toDate, limit = 50, offset = 0 } = {}) {
    const pool = getPool();
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (entityType) {
      conditions.push(`entity_type = $${paramIndex++}`);
      params.push(entityType);
    }
    if (actor) {
      conditions.push(`actor = $${paramIndex++}`);
      params.push(actor);
    }
    if (fromDate) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(fromDate);
    }
    if (toDate) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(toDate);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit, offset);

    const result = await pool.query(
      `SELECT id, entity_type, entity_id, action, actor, metadata, created_at
       FROM audit_log
       ${where}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params,
    );
    return result.rows;
  }
}

module.exports = new AuditService();
