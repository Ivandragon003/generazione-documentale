/**
 * dev.queries.js
 *
 * Query SQL usate esclusivamente dagli endpoint di sviluppo/test.
 * Non usare in produzione.
 */

const { getPool } = require('../../database/database');

async function truncateAll(pool) {
  await pool.query(`
    TRUNCATE TABLE
      audit_log,
      pdf_jobs,
      document_versions,
      documents,
      template_versions,
      templates
    RESTART IDENTITY CASCADE
  `);
}

async function insertFixtureTemplate(pool, { id, name, description, contentPath, fields }) {
  await pool.query(
    `INSERT INTO templates (id, name, description, content_path, status, version, fields, created_by)
     VALUES ($1, $2, $3, $4, 'draft', 1, $5, 'dev-fixture')`,
    [id, name, description, contentPath, JSON.stringify(fields)],
  );
}

async function insertFixtureTemplateVersion(pool, { templateId, contentPath, fields }) {
  await pool.query(
    `INSERT INTO template_versions (template_id, version, content_path, fields, status, action, created_by)
     VALUES ($1, 1, $2, $3, 'draft', 'create_fixture', 'dev-fixture')`,
    [templateId, contentPath, JSON.stringify(fields)],
  );
}

async function insertFixtureDocument(pool, { id, name, templateId, content, fieldValues }) {
  await pool.query(
    `INSERT INTO documents (id, name, template_id, template_version, content, field_values, status, created_by)
     VALUES ($1, $2, $3, 1, $4, $5, 'draft', 'dev-fixture')`,
    [id, name, templateId, content, JSON.stringify(fieldValues)],
  );
}

async function insertFixtureDocumentVersion(pool, { documentId, content, fieldValues }) {
  await pool.query(
    `INSERT INTO document_versions (document_id, version, content, field_values, action, created_by)
     VALUES ($1, 1, $2, $3, 'create_fixture', 'dev-fixture')`,
    [documentId, content, JSON.stringify(fieldValues)],
  );
}

async function insertFixturePdfJob(pool, { id, documentId, filename }) {
  await pool.query(
    `INSERT INTO pdf_jobs (id, document_id, status, filename, unresolved_fields, requested_by, started_at, completed_at)
     VALUES ($1, $2, 'completed', $3, '[]', 'dev-fixture', NOW(), NOW())`,
    [id, documentId, filename],
  );
}

module.exports = {
  truncateAll,
  insertFixtureTemplate,
  insertFixtureTemplateVersion,
  insertFixtureDocument,
  insertFixtureDocumentVersion,
  insertFixturePdfJob,
};