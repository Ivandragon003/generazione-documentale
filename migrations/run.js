'use strict';

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { getPool } = require('../src/database/database');

const fsp                   = fs.promises;
const MIGRATIONS_DIR        = path.join(__dirname, '..', 'db', 'migrations');
const TEMPLATE_STORAGE_PATH = process.env.TEMPLATE_STORAGE_PATH || './storage/templates';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function columnExists(client, tableName, columnName) {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = $1
       AND column_name  = $2`,
    [tableName, columnName],
  );
  return rows.length > 0;
}

async function writeTemplateFile(templateId, version, content) {
  const dir          = path.join(TEMPLATE_STORAGE_PATH, templateId);
  const relativePath = `${templateId}/v${version}.md`;
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(path.join(dir, `v${version}.md`), content, 'utf8');
  return relativePath;
}

// Migra eventuali template con content inline → file su disco (legacy backfill)
async function backfillTemplateFiles(client) {
  const hasTplContent = await columnExists(client, 'templates', 'content');
  const hasVerContent = await columnExists(client, 'template_versions', 'content');

  if (!hasTplContent && !hasVerContent) return;

  if (hasVerContent) {
    const { rows } = await client.query(
      `SELECT template_id, version, content
       FROM   template_versions
       WHERE  content_path IS NULL AND content IS NOT NULL`,
    );
    for (const row of rows) {
      const contentPath = await writeTemplateFile(row.template_id, row.version, row.content);
      await client.query(
        `UPDATE template_versions SET content_path = $1
         WHERE  template_id = $2 AND version = $3`,
        [contentPath, row.template_id, row.version],
      );
    }
  }

  if (hasTplContent) {
    const { rows } = await client.query(
      `SELECT id, version, content
       FROM   templates
       WHERE  content_path IS NULL AND content IS NOT NULL`,
    );
    for (const row of rows) {
      const contentPath = await writeTemplateFile(row.id, row.version, row.content);
      await client.query(
        `UPDATE templates SET content_path = $1 WHERE id = $2`,
        [contentPath, row.id],
      );
    }
  }
}

// ─── Runner principale ───────────────────────────────────────────────────────

async function runMigrations() {
  const pool   = getPool();
  const client = await pool.connect();

  try {
    console.log('\u25b6 Avvio migration...');

    // Legge tutti i file .sql da db/migrations/ in ordine alfabetico ed esegue
    const files = (await fsp.readdir(MIGRATIONS_DIR))
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.warn('  Nessun file .sql trovato in db/migrations/');
    }

    for (const file of files) {
      const sql = await fsp.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`  \u21b3 ${file}`);
      await client.query(sql);
    }

    await backfillTemplateFiles(client);

    console.log('\u2705 Migration completate con successo.');
  } catch (err) {
    console.error('\u274c Errore migration:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
