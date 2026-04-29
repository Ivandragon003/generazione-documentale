require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getPool } = require('../src/database');

const fsp = fs.promises;
const TEMPLATE_STORAGE_PATH = process.env.TEMPLATE_STORAGE_PATH || './storage/templates';

async function writeTemplateFile(templateId, version, content) {
  const relativePath = path.join(templateId, `v${version}.md`).replace(/\\/g, '/');
  await fsp.mkdir(path.join(TEMPLATE_STORAGE_PATH, templateId), { recursive: true });
  await fsp.writeFile(path.join(TEMPLATE_STORAGE_PATH, relativePath), content, 'utf8');
  return relativePath;
}

async function columnExists(client, tableName, columnName) {
  const result = await client.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [tableName, columnName],
  );
  return result.rows.length > 0;
}

async function backfillTemplateFiles(client) {
  const hasTemplateContent = await columnExists(client, 'templates', 'content');
  const hasTemplateVersionContent = await columnExists(client, 'template_versions', 'content');

  if (!hasTemplateContent && !hasTemplateVersionContent) return;

  if (hasTemplateVersionContent) {
  const versions = await client.query(
    `SELECT template_id, version, content
     FROM template_versions
     WHERE content_path IS NULL AND content IS NOT NULL`,
  );

    for (const row of versions.rows) {
      const contentPath = await writeTemplateFile(row.template_id, row.version, row.content);
      await client.query(
        `UPDATE template_versions
         SET content_path = $1
         WHERE template_id = $2 AND version = $3`,
        [contentPath, row.template_id, row.version],
      );
    }
  }

  if (hasTemplateContent) {
  const templates = await client.query(
    `SELECT id, version, content
     FROM templates
     WHERE content_path IS NULL AND content IS NOT NULL`,
  );

    for (const row of templates.rows) {
      const contentPath = await writeTemplateFile(row.id, row.version, row.content);
      await client.query(
        `UPDATE templates
         SET content_path = $1
         WHERE id = $2`,
        [contentPath, row.id],
      );
    }
  }
}

const migrations = `
-- Templates documentali
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  content_path VARCHAR(500),
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  version INTEGER NOT NULL DEFAULT 1,
  fields JSONB NOT NULL DEFAULT '[]',
  created_by VARCHAR(255) NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indice per ricerche per nome e status
CREATE INDEX IF NOT EXISTS idx_templates_status ON templates(status);
CREATE INDEX IF NOT EXISTS idx_templates_name ON templates(name);

-- Storico versioni template (ogni versione è una riga separata)
CREATE TABLE IF NOT EXISTS template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content_path VARCHAR(500),
  fields JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(50) NOT NULL,
  action VARCHAR(100) NOT NULL DEFAULT 'update',
  created_by VARCHAR(255) NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_template_versions_template_id ON template_versions(template_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_template_versions_unique_version ON template_versions(template_id, version);

ALTER TABLE templates ADD COLUMN IF NOT EXISTS content_path VARCHAR(500);
ALTER TABLE template_versions ADD COLUMN IF NOT EXISTS content_path VARCHAR(500);

-- Documenti generati
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
  template_version INTEGER NOT NULL,
  content TEXT NOT NULL,
  field_values JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'published', 'archived')),
  created_by VARCHAR(255) NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_template_id ON documents(template_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);

ALTER TABLE documents DROP COLUMN IF EXISTS package_id;
DROP TABLE IF EXISTS packages;

-- Versioni documenti (forward versioning)
CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  field_values JSONB NOT NULL DEFAULT '{}',
  action VARCHAR(100) NOT NULL DEFAULT 'update',
  created_by VARCHAR(255) NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON document_versions(document_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_document_versions_unique_version ON document_versions(document_id, version);

-- Job PDF asincroni
CREATE TABLE IF NOT EXISTS pdf_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  filename VARCHAR(500),
  unresolved_fields JSONB NOT NULL DEFAULT '[]',
  error TEXT,
  requested_by VARCHAR(255) NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pdf_jobs_document_id ON pdf_jobs(document_id);
CREATE INDEX IF NOT EXISTS idx_pdf_jobs_status ON pdf_jobs(status);

-- Audit log immutabile
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(100) NOT NULL,
  actor VARCHAR(255) NOT NULL DEFAULT 'system',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
`;

const cleanupMigrations = `
DROP INDEX IF EXISTS idx_templates_parent_id;
ALTER TABLE templates DROP COLUMN IF EXISTS parent_id;
ALTER TABLE templates DROP COLUMN IF EXISTS content;
ALTER TABLE template_versions DROP COLUMN IF EXISTS content;
ALTER TABLE documents DROP COLUMN IF EXISTS locked_by;
ALTER TABLE documents DROP COLUMN IF EXISTS locked_at;
ALTER TABLE documents DROP COLUMN IF EXISTS pdf_path;
ALTER TABLE documents DROP COLUMN IF EXISTS pdf_generated_at;
ALTER TABLE documents DROP COLUMN IF EXISTS pdf_status;
ALTER TABLE documents DROP COLUMN IF EXISTS pdf_deleted_at;
UPDATE pdf_jobs SET status = 'failed', error = 'Job interrotto dal riavvio applicazione' WHERE status IN ('queued', 'running');
`;

async function runMigrations() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    console.log('Running migrations...');
    await client.query(migrations);
    await backfillTemplateFiles(client);
    await client.query(cleanupMigrations);
    console.log('Migrations completed successfully.');
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
