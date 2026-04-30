const { getPool } = require('../../database/database');

/**
 * Trova tutti i documenti con paginazione
 */
async function findAll({ status, limit = 20, offset = 0 } = {}) {
  const pool = getPool();
  let query = 'SELECT id, name, template_id, template_version, content, field_values, status, created_by, created_at, updated_at FROM documents WHERE 1=1';
  const params = [];
  let paramIndex = 1;

  if (status) {
    query += ` AND status = $${paramIndex}`;
    params.push(status);
    paramIndex += 1;
  }

  const countQuery = query.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM');
  const countResult = await pool.query(countQuery, params);
  const total = parseInt(countResult.rows[0].total, 10);

  query += ` ORDER BY updated_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  return { data: result.rows, total };
}

/**
 * Trova documento per ID
 */
async function findById(id) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, name, template_id, template_version, content, field_values, status, created_by, created_at, updated_at
     FROM documents WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Inserisce un nuovo documento
 */
async function insertDocument(client, { name, templateId, templateVersion, content, createdBy }) {
  const result = await client.query(
    `INSERT INTO documents (name, template_id, template_version, content, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, template_id, template_version, content, field_values, status, created_by, created_at, updated_at`,
    [name, templateId, templateVersion, content, createdBy]
  );
  return result.rows[0];
}

/**
 * Inserisce una versione di documento
 */
async function insertDocumentVersion(client, { documentId, version, content, fieldValues, action, createdBy }) {
  const result = await client.query(
    `INSERT INTO document_versions (document_id, version, content, field_values, action, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, document_id, version, content, field_values, action, created_by, created_at`,
    [documentId, version, content, JSON.stringify(fieldValues), action, createdBy]
  );
  return result.rows[0];
}

/**
 * Aggiorna un documento
 */
async function updateDocument(client, { id, name, content, fieldValues }) {
  const result = await client.query(
    `UPDATE documents SET name = $1, content = $2, field_values = $3, updated_at = NOW()
     WHERE id = $4
     RETURNING id, name, template_id, template_version, content, field_values, status, created_by, created_at, updated_at`,
    [name, content, JSON.stringify(fieldValues), id]
  );
  return result.rows[0];
}

/**
 * Ottiene la versione massima di un documento
 */
async function getMaxVersion(id) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT COALESCE(MAX(version), 0) as max_version FROM document_versions WHERE document_id = $1`,
    [id]
  );
  return parseInt(result.rows[0].max_version, 10);
}

/**
 * Cambia lo stato di un documento
 */
async function changeDocumentStatus(id, newStatus) {
  const pool = getPool();
  const result = await pool.query(
    `UPDATE documents SET status = $1, updated_at = NOW() WHERE id = $2
     RETURNING id, name, template_id, template_version, content, field_values, status, created_by, created_at, updated_at`,
    [newStatus, id]
  );
  return result.rows[0];
}

/**
 * Rinomina un documento
 */
async function renameDocument(id, newName) {
  const pool = getPool();
  const result = await pool.query(
    `UPDATE documents SET name = $1, updated_at = NOW() WHERE id = $2
     RETURNING id, name, template_id, template_version, content, field_values, status, created_by, created_at, updated_at`,
    [newName, id]
  );
  return result.rows[0];
}

/**
 * Ripristina un documento da una versione precedente
 */
async function restoreDocument(client, { id, content, fieldValues }) {
  const result = await client.query(
    `UPDATE documents SET content = $1, field_values = $2, updated_at = NOW() WHERE id = $3
     RETURNING id, name, template_id, template_version, content, field_values, status, created_by, created_at, updated_at`,
    [content, JSON.stringify(fieldValues), id]
  );
  return result.rows[0];
}

/**
 * Trova una versione specifica di un documento
 */
async function findVersionById(id, version) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, document_id, version, content, field_values, action, created_by, created_at
     FROM document_versions WHERE document_id = $1 AND version = $2`,
    [id, version]
  );
  return result.rows[0] || null;
}

/**
 * Trova tutte le versioni di un documento
 */
async function findVersions(id) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, document_id, version, content, field_values, action, created_by, created_at
     FROM document_versions WHERE document_id = $1 ORDER BY version DESC`,
    [id]
  );
  return result.rows;
}

/**
 * Cancella un documento
 */
async function deleteDocument(id) {
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM documents WHERE id = $1 RETURNING id`,
    [id]
  );
  return result.rows[0];
}

/**
 * Inserisce un job per generare PDF
 */
async function insertPdfJob(documentId, actor = 'system') {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO pdf_jobs (document_id, requested_by)
     VALUES ($1, $2)
     RETURNING id, document_id, status, filename, unresolved_fields, error, requested_by, created_at, started_at, completed_at`,
    [documentId, actor]
  );
  return result.rows[0];
}

/**
 * Trova un job PDF per ID
 */
async function findPdfJobById(id) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, document_id, status, filename, unresolved_fields, error, requested_by, created_at, started_at, completed_at
     FROM pdf_jobs WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Aggiorna job PDF a stato running
 */
async function updatePdfJobRunning(id) {
  const pool = getPool();
  await pool.query(
    `UPDATE pdf_jobs SET status = 'running', started_at = NOW() WHERE id = $1`,
    [id]
  );
}

/**
 * Aggiorna job PDF a stato completed
 */
async function updatePdfJobCompleted(id, filename, unresolvedFields) {
  const pool = getPool();
  await pool.query(
    `UPDATE pdf_jobs SET status = 'completed', filename = $1, unresolved_fields = $2, completed_at = NOW()
     WHERE id = $3`,
    [filename, JSON.stringify(unresolvedFields), id]
  );
}

/**
 * Aggiorna job PDF a stato failed
 */
async function updatePdfJobFailed(id, errorMessage) {
  const pool = getPool();
  await pool.query(
    `UPDATE pdf_jobs SET status = 'failed', error = $1, completed_at = NOW() WHERE id = $2`,
    [errorMessage, id]
  );
}

/**
 * Aggiorna stato documento a 'generated'
 */
async function updateDocumentStatusGenerated(id) {
  const pool = getPool();
  await pool.query(
    `UPDATE documents SET status = 'generated' WHERE id = $1`,
    [id]
  );
}

/**
 * Trova un job PDF per documento e ID job
 */
async function findPdfJob(documentId, jobId) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, document_id, status, filename, unresolved_fields, error, requested_by, created_at, started_at, completed_at
     FROM pdf_jobs WHERE document_id = $1 AND id = $2`,
    [documentId, jobId]
  );
  return result.rows[0] || null;
}

/**
 * Trova il job PDF completato più recente per un documento
 */
async function findLatestCompletedPdfJob(documentId) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, document_id, status, filename, unresolved_fields, error, requested_by, created_at, started_at, completed_at
     FROM pdf_jobs WHERE document_id = $1 AND status = 'completed' ORDER BY completed_at DESC LIMIT 1`,
    [documentId]
  );
  return result.rows[0] || null;
}

/**
 * Trova tutti i job PDF di un documento
 */
async function findPdfJobsByDocument(documentId) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, document_id, status, filename, unresolved_fields, error, requested_by, created_at, started_at, completed_at
     FROM pdf_jobs WHERE document_id = $1 ORDER BY created_at DESC`,
    [documentId]
  );
  return result.rows;
}

/**
 * Trova tutti i job PDF in coda
 */
async function findQueuedPdfJobs() {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, document_id, status, filename, unresolved_fields, error, requested_by, created_at, started_at, completed_at
     FROM pdf_jobs WHERE status = 'queued' ORDER BY created_at ASC`
  );
  return result.rows;
}

module.exports = {
  findAll,
  findById,
  insertDocument,
  insertDocumentVersion,
  updateDocument,
  getMaxVersion,
  changeDocumentStatus,
  renameDocument,
  restoreDocument,
  findVersionById,
  findVersions,
  deleteDocument,
  insertPdfJob,
  findPdfJobById,
  updatePdfJobRunning,
  updatePdfJobCompleted,
  updatePdfJobFailed,
  updateDocumentStatusGenerated,
  findPdfJob,
  findLatestCompletedPdfJob,
  findPdfJobsByDocument,
  findQueuedPdfJobs,
};
