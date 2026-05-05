'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getPool } = require('../../src/database/database');

const fsp = fs.promises;
const SCHEMA_FILE = path.join(__dirname, '..', 'schema.sql');
const MIGRATIONS_DIR = __dirname;
const TEMPLATE_STORAGE_PATH = process.env.TEMPLATE_STORAGE_PATH || './storage/templates';

async function columnExists(client, table, col) {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, col],
  );
  return rows.length > 0;
}

async function writeTemplateFile(id, version, content) {
  const dir = path.join(TEMPLATE_STORAGE_PATH, id);
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(path.join(dir, `v${version}.md`), content, 'utf8');
  return `${id}/v${version}.md`;
}

async function backfillTemplateFiles(client) {
  const hasTpl = await columnExists(client, 'templates', 'content');
  const hasVer = await columnExists(client, 'template_versions', 'content');
  if (!hasTpl && !hasVer) return;

  if (hasVer) {
    const { rows } = await client.query(
      `SELECT template_id, version, content FROM template_versions
       WHERE content_path IS NULL AND content IS NOT NULL`,
    );
    for (const r of rows) {
      const p = await writeTemplateFile(r.template_id, r.version, r.content);
      await client.query(
        `UPDATE template_versions SET content_path = $1 WHERE template_id = $2 AND version = $3`,
        [p, r.template_id, r.version],
      );
    }
  }

  if (hasTpl) {
    const { rows } = await client.query(
      `SELECT id, version, content FROM templates
       WHERE content_path IS NULL AND content IS NOT NULL`,
    );
    for (const r of rows) {
      const p = await writeTemplateFile(r.id, r.version, r.content);
      await client.query(`UPDATE templates SET content_path = $1 WHERE id = $2`, [p, r.id]);
    }
  }
}

async function runIncrementalMigrations(client) {
  const files = (await fsp.readdir(MIGRATIONS_DIR))
    .filter((name) => /^\d+.*\.sql$/i.test(name))
    .sort((a, b) => a.localeCompare(b));

  for (const file of files) {
    const sql = await fsp.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    await client.query(sql);
    console.log(`Executed incremental migration: ${file}`);
  }
}

async function runMigrations() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    console.log('Starting migrations...');
    const sql = await fsp.readFile(SCHEMA_FILE, 'utf8');
    await client.query(sql);
    await runIncrementalMigrations(client);
    await backfillTemplateFiles(client);
    console.log('Migrations completed.');
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
