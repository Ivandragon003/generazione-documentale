'use strict';

const fs   = require('fs');
const path = require('path');
const {
  Controller, Post, Body, Req, HttpException, HttpCode, HttpStatus,
} = require('@nestjs/common');
const { ApiTags, ApiOperation, ApiResponse, ApiHeader } = require('@nestjs/swagger');

const { getPool }          = require('../../database/database');
const q                    = require('./dev.queries');
const { runApiRegressionSuite, runLargePdfSeed, ApiRegressionFailure } = require('./api-regression.service');

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
  const fields = [
    { name: 'titolo',  label: 'Titolo',  type: 'text', required: true,  defaultValue: '' },
    { name: 'cliente', label: 'Cliente', type: 'text', required: true,  defaultValue: '' },
    { name: 'importo', label: 'Importo', type: 'text', required: true,  defaultValue: '' },
    { name: 'data',    label: 'Data',    type: 'date', required: true,  defaultValue: '' },
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

  await q.insertFixtureTemplate(pool, {
    id: FIXTURE_TEMPLATE_ID, name: 'Template Fixture',
    description: 'Template stabile per collection API', contentPath, fields,
  });
  await q.insertFixtureTemplateVersion(pool, {
    templateId: FIXTURE_TEMPLATE_ID, contentPath, fields,
  });
  await q.insertFixtureTemplate(pool, {
    id: FIXTURE_DELETE_TEMPLATE_ID, name: 'Template Fixture Delete',
    description: 'Template eliminabile per collection API',
    contentPath: deleteContentPath, fields,
  });
  await q.insertFixtureTemplateVersion(pool, {
    templateId: FIXTURE_DELETE_TEMPLATE_ID, contentPath: deleteContentPath, fields,
  });
  await q.insertFixtureDocument(pool, {
    id: FIXTURE_DOCUMENT_ID, name: 'Documento Fixture',
    templateId: FIXTURE_TEMPLATE_ID, content, fieldValues,
  });
  await q.insertFixtureDocumentVersion(pool, {
    documentId: FIXTURE_DOCUMENT_ID, content, fieldValues,
  });
  await q.insertFixturePdfJob(pool, {
    id: FIXTURE_PDF_JOB_ID, documentId: FIXTURE_DOCUMENT_ID, filename: FIXTURE_PDF_FILENAME,
  });
}

class DevController {
  async executeTestRun(body, req) {
    if (process.env.NODE_ENV === 'production') {
      throw new HttpException('Test run non disponibili in produzione', 403);
    }
    const suite = body?.suite || 'api-regression';
    if (suite !== 'api-regression') throw new HttpException('Suite non supportata', 400);
    try {
      return await runApiRegressionSuite({
        baseUrl: body?.baseUrl,
        reset:   body?.reset !== false,
        req,
      });
    } catch (err) {
      if (err instanceof ApiRegressionFailure) {
        throw new HttpException(
          { ok: false, suite, error: err.message, failedTest: err.failedTest, tests: err.tests || [] },
          500,
        );
      }
      throw err;
    }
  }

  async reset(req) {
    if (process.env.NODE_ENV === 'production') {
      throw new HttpException('Reset non disponibile in produzione', 403);
    }
    if (req.headers['x-reset-confirm'] !== 'true') {
      throw new HttpException('Header x-reset-confirm: true obbligatorio', 400);
    }
    const pool = getPool();
    await q.truncateAll(pool);
    await Promise.all([
      resetDirectory(path.resolve(TEMPLATE_STORAGE_PATH)),
      resetDirectory(path.resolve(STORAGE_PATH)),
      resetDirectory(path.resolve(UPLOAD_PATH)),
    ]);
    await seedDevFixtures(pool);
    return {
      reset: true,
      fixtures: {
        templateId:       FIXTURE_TEMPLATE_ID,
        deleteTemplateId: FIXTURE_DELETE_TEMPLATE_ID,
        documentId:       FIXTURE_DOCUMENT_ID,
        pdfJobId:         FIXTURE_PDF_JOB_ID,
      },
    };
  }

  /**
   * Crea un template grande (contratto multi-sezione, 21 campi),
   * riempie solo 9 campi, accoda la generazione PDF.
   * Il PDF viene salvato in storage e non viene mai eliminato.
   */
  async seedLargePdf(body, req) {
    if (process.env.NODE_ENV === 'production') {
      throw new HttpException('Seed non disponibile in produzione', 403);
    }
    try {
      return await runLargePdfSeed({ baseUrl: body?.baseUrl, req });
    } catch (err) {
      throw new HttpException(
        { ok: false, error: err.message },
        err.status || 500,
      );
    }
  }
}

ApiTags('dev')(DevController);
Controller('dev')(DevController);

const proto = DevController.prototype;

// POST /dev/test-runs/execute
Post('test-runs/execute')(proto, 'executeTestRun', Object.getOwnPropertyDescriptor(proto, 'executeTestRun'));
HttpCode(HttpStatus.OK)(proto, 'executeTestRun', Object.getOwnPropertyDescriptor(proto, 'executeTestRun'));
ApiOperation({ summary: 'Esegue la suite di regression test API', description: 'Bloccato in NODE_ENV=production.' })(proto, 'executeTestRun', Object.getOwnPropertyDescriptor(proto, 'executeTestRun'));
ApiResponse({ status: 200, description: 'Tutti i test superati' })(proto, 'executeTestRun', Object.getOwnPropertyDescriptor(proto, 'executeTestRun'));
ApiResponse({ status: 500, description: 'Almeno un test fallito' })(proto, 'executeTestRun', Object.getOwnPropertyDescriptor(proto, 'executeTestRun'));
Reflect.defineMetadata('design:paramtypes', [Object, Object], proto, 'executeTestRun');
Body()(proto, 'executeTestRun', 0);
Req()(proto, 'executeTestRun', 1);

// POST /dev/reset
Post('reset')(proto, 'reset', Object.getOwnPropertyDescriptor(proto, 'reset'));
HttpCode(HttpStatus.OK)(proto, 'reset', Object.getOwnPropertyDescriptor(proto, 'reset'));
ApiOperation({
  summary:     'Reset dati e storage (solo dev/test)',
  description: 'Richiede header x-reset-confirm: true. Bloccato in produzione.',
})(proto, 'reset', Object.getOwnPropertyDescriptor(proto, 'reset'));
ApiHeader({ name: 'x-reset-confirm', description: 'Deve essere "true"', required: true })(proto, 'reset', Object.getOwnPropertyDescriptor(proto, 'reset'));
ApiResponse({ status: 200, description: 'Reset completato con fixture' })(proto, 'reset', Object.getOwnPropertyDescriptor(proto, 'reset'));
ApiResponse({ status: 400, description: 'Header mancante' })(proto, 'reset', Object.getOwnPropertyDescriptor(proto, 'reset'));
ApiResponse({ status: 403, description: 'Non disponibile in produzione' })(proto, 'reset', Object.getOwnPropertyDescriptor(proto, 'reset'));
Reflect.defineMetadata('design:paramtypes', [Object], proto, 'reset');
Req()(proto, 'reset', 0);

// POST /dev/seed-large-pdf
Post('seed-large-pdf')(proto, 'seedLargePdf', Object.getOwnPropertyDescriptor(proto, 'seedLargePdf'));
HttpCode(HttpStatus.CREATED)(proto, 'seedLargePdf', Object.getOwnPropertyDescriptor(proto, 'seedLargePdf'));
ApiOperation({
  summary: 'Seed template grande con campi parziali + generazione PDF',
  description: [
    'Crea un template contrattuale multi-sezione con 21 campi.',
    'Compila solo 9 campi (sede, CF cliente, CAP, durata, importi IVA/totale,',
    'modalita pagamento e firme rimangono come {{placeholder}} nel PDF).',
    'Il file PDF generato viene mantenuto in storage. Bloccato in produzione.',
  ].join(' '),
})(proto, 'seedLargePdf', Object.getOwnPropertyDescriptor(proto, 'seedLargePdf'));
ApiResponse({ status: 201, description: 'PDF accodato, IDs restituiti' })(proto, 'seedLargePdf', Object.getOwnPropertyDescriptor(proto, 'seedLargePdf'));
ApiResponse({ status: 403, description: 'Non disponibile in produzione' })(proto, 'seedLargePdf', Object.getOwnPropertyDescriptor(proto, 'seedLargePdf'));
Reflect.defineMetadata('design:paramtypes', [Object, Object], proto, 'seedLargePdf');
Body()(proto, 'seedLargePdf', 0);
Req()(proto, 'seedLargePdf', 1);

module.exports = { DevController };
