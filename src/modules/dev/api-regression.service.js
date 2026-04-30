// Questo service esegue chiamate HTTP all'API stessa, quindi non dipende da NestJS.

class ApiRegressionFailure extends Error {
  constructor(message, failedTest, tests) {
    super(message);
    this.name = 'ApiRegressionFailure';
    this.failedTest = failedTest;
    this.tests = tests;
  }
}

function normalizeBaseUrl(baseUrl, req) {
  if (baseUrl) return baseUrl.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

async function parseResponse(response) {
  const ct = response.headers.get('content-type') || '';
  if (ct.includes('application/json')) return response.json();
  return response.text();
}

function expect(condition, message, details) {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

async function request(baseUrl, method, path, { body, headers = {}, expectedStatus } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const parsed = await parseResponse(response);
  const expected = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
  if (expectedStatus && !expected.includes(response.status)) {
    throw new Error(`Status atteso ${expected.join('/')} ma ricevuto ${response.status}: ${JSON.stringify(parsed)}`);
  }
  return { status: response.status, body: parsed };
}

async function runApiRegressionSuite({ baseUrl, req, reset = true } = {}) {
  const resolvedBaseUrl = normalizeBaseUrl(baseUrl, req);
  const tests = [];
  const context = {};

  async function test(name, fn) {
    const startedAt = new Date().toISOString();
    try {
      await fn();
      tests.push({ name, status: 'passed', startedAt, completedAt: new Date().toISOString() });
    } catch (err) {
      const failed = { name, status: 'failed', startedAt, completedAt: new Date().toISOString(), error: err.message, details: err.details };
      tests.push(failed);
      throw new ApiRegressionFailure(`Test fallito: ${name}`, failed, tests);
    }
  }

  await test('Reset dati di test', async () => {
    if (!reset) return;
    const result = await request(resolvedBaseUrl, 'POST', '/api/dev/reset', {
      headers: { 'x-reset-confirm': 'true' }, expectedStatus: 200,
    });
    expect(result.body.reset === true, 'Reset non confermato', result.body);
  });

  // /health è escluso dal prefisso /api (standard load balancer)
  await test('Health check', async () => {
    const result = await request(resolvedBaseUrl, 'GET', '/health', { expectedStatus: 200 });
    expect(result.body.status === 'ok', 'Health check non OK', result.body);
  });

  await test('Validazione Markdown valido', async () => {
    const result = await request(resolvedBaseUrl, 'POST', '/api/templates/validate-md', {
      expectedStatus: 200,
      body: { content: '# {{titolo}}\n\nCliente: {{cliente}}\nImporto: {{importo}}' },
    });
    const fieldNames = result.body.fields.map((f) => f.name);
    expect(result.body.valid === true, 'Markdown valido marcato come non valido', result.body);
    expect(
      fieldNames.includes('titolo') && fieldNames.includes('cliente') && fieldNames.includes('importo'),
      'Campi estratti non corretti', result.body,
    );
  });

  await test('Validazione Markdown corrotto', async () => {
    const result = await request(resolvedBaseUrl, 'POST', '/api/templates/validate-md', {
      expectedStatus: 200,
      body: { content: '# corrotto\n\nCampo aperto senza chiusura: {{cliente\n\nCampo non valido: {{nome cliente}}' },
    });
    expect(result.body.valid === false, 'Markdown corrotto marcato come valido', result.body);
    expect(Array.isArray(result.body.errors) && result.body.errors.length > 0, 'Errori di validazione mancanti', result.body);
  });

  await test('Creazione template valido', async () => {
    const result = await request(resolvedBaseUrl, 'POST', '/api/templates', {
      expectedStatus: 201,
      headers: { 'x-user': 'api-regression' },
      body: {
        name: `Template Regression ${Date.now()}`,
        description: 'Creato dalla suite tecnica',
        content: '# {{titolo}}\n\nCliente: {{cliente}}\nImporto: {{importo}}\nData: {{data}}',
        fields: [
          { name: 'titolo',  label: 'Titolo',  type: 'text',   required: true },
          { name: 'cliente', label: 'Cliente', type: 'text',   required: true },
          { name: 'importo', label: 'Importo', type: 'number', required: true },
          { name: 'data',    label: 'Data',    type: 'date',   required: true },
        ],
      },
    });
    context.templateId = result.body.id;
    expect(Boolean(context.templateId), 'ID template mancante', result.body);
    expect(result.body.fields.length === 4, 'Definizione campi template non corretta', result.body);
  });

  await test('Dettaglio template', async () => {
    const result = await request(resolvedBaseUrl, 'GET', `/api/templates/${context.templateId}`, { expectedStatus: 200 });
    expect(result.body.id === context.templateId, 'Dettaglio template errato', result.body);
  });

  await test('Pubblicazione template', async () => {
    const result = await request(resolvedBaseUrl, 'POST', `/api/templates/${context.templateId}/publish`, {
      expectedStatus: 200, headers: { 'x-user': 'api-regression' },
    });
    expect(result.body.status === 'published', 'Template non pubblicato', result.body);
  });

  await test('Creazione documento da template', async () => {
    const result = await request(resolvedBaseUrl, 'POST', '/api/documents', {
      expectedStatus: 201, headers: { 'x-user': 'api-regression' },
      body: { name: `Documento Regression ${Date.now()}`, templateId: context.templateId },
    });
    context.documentId = result.body.id;
    expect(Boolean(context.documentId), 'ID documento mancante', result.body);
  });

  await test('Aggiornamento fieldValues documento', async () => {
    const result = await request(resolvedBaseUrl, 'PUT', `/api/documents/${context.documentId}`, {
      expectedStatus: 200, headers: { 'x-user': 'api-regression' },
      body: { fieldValues: { titolo: 'Contratto Regression', cliente: 'Cliente Test', importo: '1000', data: '2026-04-29' } },
    });
    expect(result.body.field_values.titolo === 'Contratto Regression', 'fieldValues non salvati correttamente', result.body);
  });

  await test('Accodamento generazione PDF', async () => {
    const result = await request(resolvedBaseUrl, 'POST', `/api/documents/${context.documentId}/generate-pdf`, {
      expectedStatus: 202, headers: { 'x-user': 'api-regression' },
    });
    context.pdfJobId = result.body.jobId;
    expect(Boolean(context.pdfJobId), 'jobId PDF mancante', result.body);
  });

  await test('Dettaglio job PDF', async () => {
    const result = await request(resolvedBaseUrl, 'GET', `/api/documents/${context.documentId}/pdf-jobs/${context.pdfJobId}`, { expectedStatus: 200 });
    expect(result.body.id === context.pdfJobId, 'Job PDF errato', result.body);
  });

  await test('Audit globale', async () => {
    const result = await request(resolvedBaseUrl, 'GET', '/api/audit?limit=50', { expectedStatus: 200 });
    expect(Array.isArray(result.body.data || result.body), 'Risposta audit non valida', result.body);
  });

  return { ok: true, suite: 'api-regression', baseUrl: resolvedBaseUrl, passed: tests.length, failed: 0, tests };
}

module.exports = { runApiRegressionSuite, ApiRegressionFailure };
