const { getPool } = require('../../database/database');

/**
 * Trova tutti i template con paginazione
 */
async function findAll({ status, limit = 20, offset = 0 } = {}) {
  const pool = getPool();
  const selectClause = 'SELECT id, name, description, content_path, status, version, fields, created_by, created_at, updated_at';
  let fromWhereClause = 'FROM templates WHERE 1=1';
  const params = [];
  let paramIndex = 1;

  if (status) {
    fromWhereClause += ` AND status = $${paramIndex}`;
    params.push(status);
    paramIndex += 1;
  }

  const countQuery = `SELECT COUNT(*) as total ${fromWhereClause}`;
  const countResult = await pool.query(countQuery, params);
  const total = parseInt(countResult.rows[0].total, 10);

  const query = `${selectClause} ${fromWhereClause} ORDER BY updated_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  return { data: result.rows, total };
}

/**
 * Trova template per ID
 */
async function findById(id) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, name, description, content_path, status, version, fields, created_by, created_at, updated_at
     FROM templates WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Inserisce un nuovo template
 */
async function insertTemplate(client, { id, name, description, contentPath, fields, createdBy }) {
  const result = await client.query(
    `INSERT INTO templates (id, name, description, content_path, status, version, fields, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, name, description, content_path, status, version, fields, created_by, created_at, updated_at`,
    [id, name, description, contentPath, 'draft', 1, JSON.stringify(fields), createdBy]
  );
  return result.rows[0];
}

/**
 * Inserisce una versione di template
 */
async function insertTemplateVersion(client, { templateId, version, contentPath, fields, status, action, createdBy }) {
  const result = await client.query(
    `INSERT INTO template_versions (template_id, version, content_path, fields, status, action, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, template_id, version, content_path, fields, status, action, created_by, created_at`,
    [templateId, version, contentPath, JSON.stringify(fields), status, action, createdBy]
  );
  return result.rows[0];
}

/**
 * Aggiorna un template
 */
async function updateTemplate(client, { id, name, description, contentPath, fields, newVersion }) {
  const result = await client.query(
    `UPDATE templates SET name = $1, description = $2, content_path = $3, version = $4, fields = $5, updated_at = NOW()
     WHERE id = $6
     RETURNING id, name, description, content_path, status, version, fields, created_by, created_at, updated_at`,
    [name, description, contentPath, newVersion, JSON.stringify(fields), id]
  );
  return result.rows[0];
}

/**
 * Pubblica un template
 */
async function publishTemplate(id) {
  const pool = getPool();
  const result = await pool.query(
    `UPDATE templates SET status = 'published' WHERE id = $1
     RETURNING id, name, description, content_path, status, version, fields, created_by, created_at, updated_at`,
    [id]
  );
  return result.rows[0];
}

/**
 * Trova versione per ID e numero versione
 */
async function findVersionById(id, version) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, template_id, version, content_path, fields, status, action, created_by, created_at
     FROM template_versions WHERE template_id = $1 AND version = $2`,
    [id, version]
  );
  return result.rows[0] || null;
}

/**
 * Ripristina un template da una versione precedente
 */
async function restoreTemplate(client, { id, contentPath, fields, newVersion }) {
  const result = await client.query(
    `UPDATE templates SET content_path = $1, fields = $2, version = $3, status = 'draft', updated_at = NOW()
     WHERE id = $4
     RETURNING id, name, description, content_path, status, version, fields, created_by, created_at, updated_at`,
    [contentPath, JSON.stringify(fields), newVersion, id]
  );
  return result.rows[0];
}

/**
 * Trova tutte le versioni di un template
 */
async function findVersions(id) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, template_id, version, content_path, fields, status, action, created_by, created_at
     FROM template_versions WHERE template_id = $1 ORDER BY version DESC`,
    [id]
  );
  return result.rows;
}

/**
 * Conta quanti documenti attivi usano questo template
 */
async function countActiveDocuments(templateId) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM documents WHERE template_id = $1 AND status != 'archived'`,
    [templateId]
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Cancella un template
 */
async function deleteTemplate(id) {
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM templates WHERE id = $1 RETURNING id`,
    [id]
  );
  return result.rows[0];
}

module.exports = {
  findAll,
  findById,
  insertTemplate,
  insertTemplateVersion,
  updateTemplate,
  publishTemplate,
  findVersionById,
  restoreTemplate,
  findVersions,
  countActiveDocuments,
  deleteTemplate,
};
