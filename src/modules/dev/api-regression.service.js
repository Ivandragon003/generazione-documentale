'use strict';

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

// ─── API Regression Suite ──────────────────────────────────────────────────────

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

  // 1. Reset
  await test('Reset dati di test', async () => {
    if (!reset) return;
    const result = await request(resolvedBaseUrl, 'POST', '/api/dev/reset', {
      headers: { 'x-reset-confirm': 'true' }, expectedStatus: 200,
    });
    expect(result.body.reset === true, 'Reset non confermato', result.body);
  });

  // 2. Health
  await test('Health check', async () => {
    const result = await request(resolvedBaseUrl, 'GET', '/health', { expectedStatus: 200 });
    expect(result.body.status === 'ok', 'Health check non OK', result.body);
  });

  // 3. Validate-md valido
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

  // 4. Validate-md corrotto
  await test('Validazione Markdown corrotto', async () => {
    const result = await request(resolvedBaseUrl, 'POST', '/api/templates/validate-md', {
      expectedStatus: 200,
      body: { content: '# corrotto\n\nCampo aperto senza chiusura: {{cliente\n\nCampo non valido: {{nome cliente}}' },
    });
    expect(result.body.valid === false, 'Markdown corrotto marcato come valido', result.body);
    expect(Array.isArray(result.body.errors) && result.body.errors.length > 0, 'Errori di validazione mancanti', result.body);
  });

  // 5. Crea template
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

  // 6. Dettaglio template
  await test('Dettaglio template', async () => {
    const result = await request(resolvedBaseUrl, 'GET', `/api/templates/${context.templateId}`, { expectedStatus: 200 });
    expect(result.body.id === context.templateId, 'Dettaglio template errato', result.body);
  });

  // 7. Aggiorna template
  await test('Aggiornamento template', async () => {
    const result = await request(resolvedBaseUrl, 'PUT', `/api/templates/${context.templateId}`, {
      expectedStatus: 200,
      headers: { 'x-user': 'api-regression' },
      body: { description: 'Aggiornato dalla suite regression' },
    });
    expect(result.body.id === context.templateId, 'ID template aggiornato non corrisponde', result.body);
  });

  // 8. Versioni template
  await test('Cronologia versioni template', async () => {
    const result = await request(resolvedBaseUrl, 'GET', `/api/templates/${context.templateId}/versions`, { expectedStatus: 200 });
    expect(Array.isArray(result.body), 'Lista versioni non è un array', result.body);
    expect(result.body.length >= 1, 'Nessuna versione trovata', result.body);
  });

  // 9. Audit template
  await test('Audit log template', async () => {
    const result = await request(resolvedBaseUrl, 'GET', `/api/templates/${context.templateId}/audit`, { expectedStatus: 200 });
    expect(Array.isArray(result.body.data || result.body), 'Risposta audit template non valida', result.body);
  });

  // 10. Crea documento
  await test('Creazione documento da template', async () => {
    const result = await request(resolvedBaseUrl, 'POST', '/api/documents', {
      expectedStatus: 201,
      headers: { 'x-user': 'api-regression' },
      body: { name: `Documento Regression ${Date.now()}`, templateId: context.templateId },
    });
    context.documentId = result.body.id;
    expect(Boolean(context.documentId), 'ID documento mancante', result.body);
  });

  // 11. Dettaglio documento
  await test('Dettaglio documento', async () => {
    const result = await request(resolvedBaseUrl, 'GET', `/api/documents/${context.documentId}`, { expectedStatus: 200 });
    expect(result.body.id === context.documentId, 'Dettaglio documento errato', result.body);
  });

  // 12. Aggiorna fieldValues
  await test('Aggiornamento fieldValues documento', async () => {
    const result = await request(resolvedBaseUrl, 'PUT', `/api/documents/${context.documentId}`, {
      expectedStatus: 200,
      headers: { 'x-user': 'api-regression' },
      body: { fieldValues: { titolo: 'Contratto Regression', cliente: 'Cliente Test', importo: '1000', data: '2026-04-29' } },
    });
    expect(result.body.field_values.titolo === 'Contratto Regression', 'fieldValues non salvati correttamente', result.body);
  });

  // 13. Versioni documento
  await test('Cronologia versioni documento', async () => {
    const result = await request(resolvedBaseUrl, 'GET', `/api/documents/${context.documentId}/versions`, { expectedStatus: 200 });
    expect(Array.isArray(result.body), 'Lista versioni documento non è un array', result.body);
  });

  // 14. Audit documento
  await test('Audit log documento', async () => {
    const result = await request(resolvedBaseUrl, 'GET', `/api/documents/${context.documentId}/audit`, { expectedStatus: 200 });
    expect(Array.isArray(result.body.data || result.body), 'Risposta audit documento non valida', result.body);
  });

  // 15. Genera PDF
  await test('Accodamento generazione PDF', async () => {
    const result = await request(resolvedBaseUrl, 'POST', `/api/documents/${context.documentId}/generate-pdf`, {
      expectedStatus: 202,
      headers: { 'x-user': 'api-regression' },
    });
    expect(result.body.jobId !== undefined, 'jobId PDF mancante nella risposta', result.body);
    expect(['queued', 'processing', 'completed'].includes(result.body.status), 'Status job PDF non valido', result.body);
  });

  return { ok: true, suite: 'api-regression', baseUrl: resolvedBaseUrl, passed: tests.length, failed: 0, tests };
}

// ─── Large PDF Seed ──────────────────────────────────────────────────────────────────
//
// Crea un template grande (contratto multi-sezione),
// riempie solo 9 campi su 21, accoda la generazione PDF.
// Il PDF viene salvato in storage e NON viene eliminato.
//
const LARGE_TEMPLATE_CONTENT = `# CONTRATTO DI FORNITURA SERVIZI N. {{numero_contratto}}

---

## 1. PARTI CONTRAENTI

**Fornitore:** {{nome_fornitore}}  
**P.IVA Fornitore:** {{piva_fornitore}}  
**Sede legale:** {{sede_fornitore}}

**Cliente:** {{nome_cliente}}  
**Codice Fiscale / P.IVA:** {{codice_fiscale_cliente}}  
**Indirizzo:** {{indirizzo_cliente}}, {{cap_cliente}} {{citta_cliente}}

---

## 2. OGGETTO DEL CONTRATTO

{{descrizione_servizio}}

Durata prevista: **{{durata_contratto}}**  
Data di inizio: **{{data_inizio}}**  
Data di fine prevista: **{{data_fine}}**

---

## 3. CORRISPETTIVO

| Voce                | Importo         |
|---------------------|-----------------|
| Imponibile          | {{importo_netto}} EUR |
| IVA (22%)           | {{importo_iva}} EUR  |
| **Totale**          | **{{importo_totale}} EUR** |

Modalita di pagamento: {{modalita_pagamento}}

---

## 4. FIRME

Luogo e data: {{luogo_firma}}, {{data_stipula}}

**Il Fornitore**  
{{firma_fornitore}}

**Il Cliente**  
{{firma_cliente}}
`;

const LARGE_TEMPLATE_FIELDS = [
  { name: 'numero_contratto',       label: 'Numero Contratto',       type: 'text',   required: true  },
  { name: 'nome_fornitore',         label: 'Nome Fornitore',         type: 'text',   required: true  },
  { name: 'piva_fornitore',         label: 'P.IVA Fornitore',        type: 'text',   required: true  },
  { name: 'sede_fornitore',         label: 'Sede Legale Fornitore',  type: 'text',   required: false },
  { name: 'nome_cliente',           label: 'Nome Cliente',           type: 'text',   required: true  },
  { name: 'codice_fiscale_cliente', label: 'Codice Fiscale / P.IVA', type: 'text',   required: false },
  { name: 'indirizzo_cliente',      label: 'Indirizzo Cliente',      type: 'text',   required: false },
  { name: 'cap_cliente',            label: 'CAP',                    type: 'text',   required: false },
  { name: 'citta_cliente',          label: 'Citta',                  type: 'text',   required: false },
  { name: 'descrizione_servizio',   label: 'Descrizione Servizio',   type: 'text',   required: true  },
  { name: 'durata_contratto',       label: 'Durata Contratto',       type: 'text',   required: false },
  { name: 'data_inizio',            label: 'Data Inizio',            type: 'date',   required: true  },
  { name: 'data_fine',              label: 'Data Fine Prevista',     type: 'date',   required: false },
  { name: 'importo_netto',          label: 'Imponibile (EUR)',       type: 'number', required: true  },
  { name: 'importo_iva',            label: 'IVA (EUR)',              type: 'number', required: false },
  { name: 'importo_totale',         label: 'Totale (EUR)',           type: 'number', required: false },
  { name: 'modalita_pagamento',     label: 'Modalita di Pagamento',  type: 'text',   required: false },
  { name: 'luogo_firma',            label: 'Luogo Firma',            type: 'text',   required: false },
  { name: 'data_stipula',           label: 'Data Stipula',           type: 'date',   required: true  },
  { name: 'firma_fornitore',        label: 'Firma Fornitore',        type: 'text',   required: false },
  { name: 'firma_cliente',          label: 'Firma Cliente',          type: 'text',   required: false },
];

const LARGE_FIELD_VALUES = {
  numero_contratto:     'CONTR-2026-001',
  nome_fornitore:       'Acme S.r.l.',
  piva_fornitore:       'IT12345678901',
  nome_cliente:         'Mario Rossi',
  descrizione_servizio: 'Sviluppo e manutenzione del sistema di generazione documentale per il periodo di riferimento contrattuale.',
  data_inizio:          '2026-05-01',
  importo_netto:        '8000',
  luogo_firma:          'Napoli',
  data_stipula:         '2026-04-30',
};

async function runLargePdfSeed({ baseUrl, req } = {}) {
  const resolvedBaseUrl = normalizeBaseUrl(baseUrl, req);
  const result = {};

  // 1. Crea template
  const tplRes = await request(resolvedBaseUrl, 'POST', '/api/templates', {
    expectedStatus: 201,
    headers: { 'x-user': 'seed-large-pdf' },
    body: {
      name:        `Contratto Fornitura — Seed ${new Date().toISOString().slice(0, 10)}`,
      description: 'Template grande multi-sezione per test PDF con campi parziali',
      content:     LARGE_TEMPLATE_CONTENT,
      fields:      LARGE_TEMPLATE_FIELDS,
    },
  });
  result.templateId     = tplRes.body.id;
  result.templateFields = tplRes.body.fields?.length ?? 0;

  // 2. Crea documento
  const docRes = await request(resolvedBaseUrl, 'POST', '/api/documents', {
    expectedStatus: 201,
    headers: { 'x-user': 'seed-large-pdf' },
    body: { name: 'Contratto Fornitura — Test Campi Parziali', templateId: result.templateId },
  });
  result.documentId = docRes.body.id;

  // 3. Compila 9 campi su 21
  const filledKeys = Object.keys(LARGE_FIELD_VALUES);
  await request(resolvedBaseUrl, 'PUT', `/api/documents/${result.documentId}`, {
    expectedStatus: 200,
    headers: { 'x-user': 'seed-large-pdf' },
    body: { fieldValues: LARGE_FIELD_VALUES },
  });
  result.filledFields    = filledKeys.length;
  result.emptyFields     = LARGE_TEMPLATE_FIELDS.length - filledKeys.length;
  result.emptyFieldNames = LARGE_TEMPLATE_FIELDS.map((f) => f.name).filter((n) => !LARGE_FIELD_VALUES[n]);

  // 4. Accoda generazione PDF
  const pdfRes = await request(resolvedBaseUrl, 'POST', `/api/documents/${result.documentId}/generate-pdf`, {
    expectedStatus: 202,
    headers: { 'x-user': 'seed-large-pdf' },
  });
  result.pdfJobId     = pdfRes.body.jobId;
  result.pdfJobStatus = pdfRes.body.status;

  return {
    ok: true,
    note: `PDF accodato con ${result.filledFields} campi compilati e ${result.emptyFields} campi vuoti (rimangono come {{placeholder}} nel PDF). Il file resta in storage.`,
    ...result,
  };
}

module.exports = { runApiRegressionSuite, runLargePdfSeed, ApiRegressionFailure };
