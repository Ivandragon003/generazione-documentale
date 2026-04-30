'use strict';

/**
 * reset.controller.js
 *
 * NOTA: Questo file implementa le stesse funzionalità di DevController.
 * È mantenuto come Express middleware puro (senza NestJS) per compatibilità
 * con eventuali test runner che lo montano direttamente su un'app Express.
 *
 * In un setup NestJS puro è sufficiente usare DevController.
 * Se non viene montato da nessun modulo NestJS, questo file non viene caricato.
 */

const fs   = require('fs');
const path = require('path');
const { getPool }          = require('../../database/database');
const apiRegressionService = require('./api-regression.service');
const { wrapAsync }        = require('../common/http.utils');

const fsp = fs.promises;
const STORAGE_PATH          = process.env.STORAGE_PATH          || './storage/pdf';
const TEMPLATE_STORAGE_PATH = process.env.TEMPLATE_STORAGE_PATH || './storage/templates';
const UPLOAD_PATH           = process.env.UPLOAD_PATH           || './storage/uploads';

const FIXTURE_TEMPLATE_ID        = '11111111-1111-4111-8111-111111111111';
const FIXTURE_DELETE_TEMPLATE_ID = '11111111-1111-4111-8111-111111111112';
const FIXTURE_DOCUMENT_ID        = '22222222-2222-4222-8222-222222222222';
const FIXTURE_PDF_JOB_ID         = '33333333-3333-4333-8333-333333333333';
const FIXTURE_PDF_FILENAME       = 'fixture-completed.pdf';

async function resetDirectory(dirPath) {
  await fsp.rm(dirPath, { recursive: true, force: true });
  await fsp.mkdir(dirPath, { recursive: true });
}

async function writeFixtureTemplate(templateId, content) {
  const templateDir = path.resolve(TEMPLATE_STORAGE_PATH, templateId);
  await fsp.mkdir(templateDir, { recursive: true });
  await fsp.writeFile(path.join(templateDir, 'v1.md'), content, 'utf8');
  return `${templateId}/v1.md`;
}

async function seedDevFixtures(pool) {
  const content = '# {{titolo}}\n\nCliente: {{cliente}}\nImporto: {{importo}}\nData: {{data}}\n';
  const fields  = [
    { name: 'titolo',  label: 'Titolo',  type: 'text', required: true, defaultValue: '' },
    { name: 'cliente', label: 'Cliente', type: 'text', required: true, defaultValue: '' },
    { name: 'importo', label: 'Importo', type: 'text', required: true, defaultValue: '' },
    { name: 'data',    label: 'Data',    type: 'date', required: true, defaultValue: '' },
  ];
  const fieldValues = {
    titolo: 'Documento fixture', cliente: 'Cliente fixture', importo: '1000', data: '2026-04-29',
  };

  const contentPath       = await writeFixtureTemplate(FIXTURE_TEMPLATE_ID, content);
  const deleteContentPath = await writeFixtureTemplate(FIXTURE_DELETE_TEMPLATE_ID, content);
  const pdfPath           = path.resolve(STORAGE_PATH, FIXTURE_PDF_FILENAME);

  await fsp.writeFile(
    pdfPath,
    '%PDF-1.4\n% fixture pdf\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n',
    'utf8',
  );

  await pool.query(
    `INSERT INTO templates
       (id, name, description, content_path, status, version, fields, created_by)
     VALUES ($1, 'Template Fixture', 'Template stabile per collection API', $2, 'draft', 1, $3, 'dev-fixture')`,
    [FIXTURE_TEMPLATE_ID, contentPath, JSON.stringify(fields)],
  );
  await pool.query(
    `INSERT INTO template_versions
       (template_id, version, content_path, fields, status, action, created_by)
     VALUES ($1, 1, $2, $3, 'draft', 'create_fixture', 'dev-fixture')`,
    [FIXTURE_TEMPLATE_ID, contentPath, JSON.stringify(fields)],
  );

  await pool.query(
    `INSERT INTO templates
       (id, name, description, content_path, status, version, fields, created_by)
     VALUES ($1, 'Template Fixture Delete', 'Template eliminabile per collection API', $2, 'draft', 1, $3, 'dev-fixture')`,
    [FIXTURE_DELETE_TEMPLATE_ID, deleteContentPath, JSON.stringify(fields)],
  );
  await pool.query(
    `INSERT INTO template_versions
       (template_id, version, content_path, fields, status, action, created_by)
     VALUES ($1, 1, $2, $3, 'draft', 'create_fixture', 'dev-fixture')`,
    [FIXTURE_DELETE_TEMPLATE_ID, deleteContentPath, JSON.stringify(fields)],
  );

  await pool.query(
    `INSERT INTO documents
       (id, name, template_id, template_version, content, field_values, status, version, created_by)
     VALUES ($1, 'Documento Fixture', $2, 1, $3, $4, 'draft', 1, 'dev-fixture')`,
    [FIXTURE_DOCUMENT_ID, FIXTURE_TEMPLATE_ID, content, JSON.stringify(fieldValues)],
  );
  await pool.query(
    `INSERT INTO document_versions
       (document_id, version, content, field_values, action, created_by)
     VALUES ($1, 1, $2, $3, 'create_fixture', 'dev-fixture')`,
    [FIXTURE_DOCUMENT_ID, content, JSON.stringify(fieldValues)],
  );
  await pool.query(
    `INSERT INTO pdf_jobs
       (id, document_id, status, filename, created_by)
     VALUES ($1, $2, 'completed', $3, 'dev-fixture')`,
    [FIXTURE_PDF_JOB_ID, FIXTURE_DOCUMENT_ID, FIXTURE_PDF_FILENAME],
  );
}

// ─── Handler Express ─────────────────────────────────────────────────────────

/**
 * POST /reset
 * Svuota il database, i file system di storage e reinserisce le fixture.
 */
const handleReset = wrapAsync(async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Reset non disponibile in produzione' });
  }
  if (req.headers['x-reset-confirm'] !== 'true') {
    return res.status(400).json({ error: 'Header x-reset-confirm: true obbligatorio' });
  }

  const pool = getPool();

  await pool.query('TRUNCATE TABLE audit_log, pdf_jobs, document_versions, documents, template_versions, templates RESTART IDENTITY CASCADE');

  await Promise.all([
    resetDirectory(path.resolve(TEMPLATE_STORAGE_PATH)),
    resetDirectory(path.resolve(STORAGE_PATH)),
    resetDirectory(path.resolve(UPLOAD_PATH)),
  ]);

  await seedDevFixtures(pool);

  return res.json({
    reset: true,
    fixtures: {
      templateId:       FIXTURE_TEMPLATE_ID,
      deleteTemplateId: FIXTURE_DELETE_TEMPLATE_ID,
      documentId:       FIXTURE_DOCUMENT_ID,
      pdfJobId:         FIXTURE_PDF_JOB_ID,
    },
  });
});

/**
 * POST /dev/test-runs/execute
 * Esegue la suite di regression test (solo dev/test).
 */
const handleTestRun = wrapAsync(async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Test run non disponibili in produzione' });
  }

  const suite = req.body?.suite || 'api-regression';
  if (suite !== 'api-regression') {
    return res.status(400).json({ error: 'Suite non supportata' });
  }

  try {
    const result = await apiRegressionService.runApiRegressionSuite({
      baseUrl: req.body?.baseUrl,
      reset:   req.body?.reset !== false,
      req,
    });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({
      ok:         false,
      suite,
      error:      err.message,
      failedTest: err.failedTest,
      tests:      err.tests || [],
    });
  }
});

module.exports = { handleReset, handleTestRun };