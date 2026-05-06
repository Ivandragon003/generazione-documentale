import type { Request } from "express";

export interface ApiRegressionTestResult {
  name: string;
  status: "passed" | "failed";
  startedAt: string;
  completedAt: string;
  error?: string;
  details?: unknown;
}

interface RequestOptions {
  body?: unknown;
  headers?: Record<string, string>;
  expectedStatus?: number | number[];
}

export class ApiRegressionFailure extends Error {
  constructor(
    message: string,
    public readonly failedTest: ApiRegressionTestResult,
    public readonly tests: ApiRegressionTestResult[],
  ) {
    super(message);
    this.name = "ApiRegressionFailure";
  }
}

const normalizeBaseUrl = (
  baseUrl: string | undefined,
  request?: Request,
): string => {
  if (baseUrl) {
    return baseUrl.replace(/\/$/, "");
  }

  if (!request) {
    throw new Error("baseUrl richiesto quando request non e disponibile");
  }

  return `${request.protocol}://${request.get("host")}`;
};

const parseResponse = async (
  response: globalThis.Response,
): Promise<unknown> => {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
};

const expectCondition = (
  condition: boolean,
  message: string,
  details?: unknown,
): void => {
  if (!condition) {
    const error = new Error(message) as Error & { details?: unknown };
    error.details = details;
    throw error;
  }
};

const requestApi = async (
  baseUrl: string,
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<{ status: number; body: unknown }> => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const parsed = await parseResponse(response);
  const expected = Array.isArray(options.expectedStatus)
    ? options.expectedStatus
    : options.expectedStatus !== undefined
      ? [options.expectedStatus]
      : [];

  if (expected.length > 0 && !expected.includes(response.status)) {
    throw new Error(
      `Status atteso ${expected.join("/")} ma ricevuto ${response.status}: ${JSON.stringify(parsed)}`,
    );
  }

  return {
    status: response.status,
    body: parsed,
  };
};

export const runApiRegressionSuite = async ({
  baseUrl,
  request,
  reset = true,
}: {
  baseUrl?: string;
  request?: Request;
  reset?: boolean;
} = {}): Promise<{
  ok: true;
  suite: "api-regression";
  baseUrl: string;
  passed: number;
  failed: number;
  tests: ApiRegressionTestResult[];
}> => {
  const resolvedBaseUrl = normalizeBaseUrl(baseUrl, request);
  const tests: ApiRegressionTestResult[] = [];
  const context: { templateId?: string; documentId?: string } = {};

  const test = async (name: string, fn: () => Promise<void>): Promise<void> => {
    const startedAt = new Date().toISOString();
    try {
      await fn();
      tests.push({
        name,
        status: "passed",
        startedAt,
        completedAt: new Date().toISOString(),
      });
    } catch (error) {
      const failed: ApiRegressionTestResult = {
        name,
        status: "failed",
        startedAt,
        completedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Errore sconosciuto",
        details:
          error && typeof error === "object" && "details" in error
            ? error.details
            : undefined,
      };
      tests.push(failed);
      throw new ApiRegressionFailure(`Test fallito: ${name}`, failed, tests);
    }
  };

  await test("Reset dati di test", async () => {
    if (!reset) {
      return;
    }
    const result = await requestApi(resolvedBaseUrl, "POST", "/api/dev/reset", {
      headers: { "x-reset-confirm": "true" },
      expectedStatus: 200,
    });
    expectCondition(
      (result.body as { reset?: boolean }).reset === true,
      "Reset non confermato",
      result.body,
    );
  });

  await test("Health check", async () => {
    const result = await requestApi(resolvedBaseUrl, "GET", "/health", {
      expectedStatus: 200,
    });
    expectCondition(
      (result.body as { status?: string }).status === "ok",
      "Health check non OK",
      result.body,
    );
  });

  await test("Validazione Markdown valido", async () => {
    const result = await requestApi(
      resolvedBaseUrl,
      "POST",
      "/api/templates/validate-md",
      {
        expectedStatus: 200,
        body: {
          content: "# {{titolo}}\n\nCliente: {{cliente}}\nImporto: {{importo}}",
        },
      },
    );

    const fields = (
      (result.body as { fields?: Array<{ name: string }> }).fields ?? []
    ).map((field) => field.name);
    expectCondition(
      (result.body as { valid?: boolean }).valid === true,
      "Markdown valido marcato come non valido",
      result.body,
    );
    expectCondition(
      fields.includes("titolo") &&
        fields.includes("cliente") &&
        fields.includes("importo"),
      "Campi estratti non corretti",
      result.body,
    );
  });

  await test("Validazione Markdown corrotto", async () => {
    const result = await requestApi(
      resolvedBaseUrl,
      "POST",
      "/api/templates/validate-md",
      {
        expectedStatus: 200,
        body: {
          content:
            "# corrotto\n\nCampo aperto senza chiusura: {{cliente\n\nCampo non valido: {{nome cliente}}",
        },
      },
    );

    const errors = (result.body as { errors?: unknown[] }).errors;
    expectCondition(
      (result.body as { valid?: boolean }).valid === false,
      "Markdown corrotto marcato come valido",
      result.body,
    );
    expectCondition(
      Array.isArray(errors) && errors.length > 0,
      "Errori di validazione mancanti",
      result.body,
    );
  });

  await test("Creazione template valido", async () => {
    const result = await requestApi(resolvedBaseUrl, "POST", "/api/templates", {
      expectedStatus: 201,
      headers: { "x-user": "api-regression" },
      body: {
        name: `Template Regression ${Date.now()}`,
        description: "Creato dalla suite tecnica",
        content:
          "# {{titolo}}\n\nCliente: {{cliente}}\nImporto: {{importo}}\nData: {{data}}",
        fields: [
          { name: "titolo", label: "Titolo", type: "text", required: true },
          { name: "cliente", label: "Cliente", type: "text", required: true },
          { name: "importo", label: "Importo", type: "number", required: true },
          { name: "data", label: "Data", type: "date", required: true },
        ],
      },
    });

    context.templateId = (result.body as { id?: string }).id;
    const fields = (result.body as { fields?: unknown[] }).fields ?? [];
    expectCondition(
      Boolean(context.templateId),
      "ID template mancante",
      result.body,
    );
    expectCondition(
      fields.length === 4,
      "Definizione campi template non corretta",
      result.body,
    );
  });

  await test("Dettaglio template", async () => {
    const result = await requestApi(
      resolvedBaseUrl,
      "GET",
      `/api/templates/${context.templateId}`,
      {
        expectedStatus: 200,
      },
    );
    expectCondition(
      (result.body as { id?: string }).id === context.templateId,
      "Dettaglio template errato",
      result.body,
    );
  });

  await test("Aggiornamento template", async () => {
    const result = await requestApi(
      resolvedBaseUrl,
      "PUT",
      `/api/templates/${context.templateId}`,
      {
        expectedStatus: 200,
        headers: { "x-user": "api-regression" },
        body: { description: "Aggiornato dalla suite regression" },
      },
    );
    expectCondition(
      (result.body as { id?: string }).id === context.templateId,
      "ID template aggiornato non corrisponde",
      result.body,
    );
  });

  await test("Cronologia versioni template", async () => {
    const result = await requestApi(
      resolvedBaseUrl,
      "GET",
      `/api/templates/${context.templateId}/versions`,
      {
        expectedStatus: 200,
      },
    );
    expectCondition(
      Array.isArray(result.body),
      "Lista versioni non e un array",
      result.body,
    );
    expectCondition(
      (result.body as unknown[]).length >= 1,
      "Nessuna versione trovata",
      result.body,
    );
  });

  await test("Audit log template", async () => {
    const result = await requestApi(
      resolvedBaseUrl,
      "GET",
      `/api/templates/${context.templateId}/audit`,
      {
        expectedStatus: 200,
      },
    );
    const body = result.body as { data?: unknown[] } | unknown[];
    expectCondition(
      Array.isArray(Array.isArray(body) ? body : body.data),
      "Risposta audit template non valida",
      result.body,
    );
  });

  await test("Creazione documento da template", async () => {
    const result = await requestApi(resolvedBaseUrl, "POST", "/api/documents", {
      expectedStatus: 201,
      headers: { "x-user": "api-regression" },
      body: {
        name: `Documento Regression ${Date.now()}`,
        templateId: context.templateId,
      },
    });

    context.documentId = (result.body as { id?: string }).id;
    expectCondition(
      Boolean(context.documentId),
      "ID documento mancante",
      result.body,
    );
  });

  await test("Dettaglio documento", async () => {
    const result = await requestApi(
      resolvedBaseUrl,
      "GET",
      `/api/documents/${context.documentId}`,
      {
        expectedStatus: 200,
      },
    );
    expectCondition(
      (result.body as { id?: string }).id === context.documentId,
      "Dettaglio documento errato",
      result.body,
    );
  });

  await test("Aggiornamento fieldValues documento", async () => {
    const result = await requestApi(
      resolvedBaseUrl,
      "PUT",
      `/api/documents/${context.documentId}`,
      {
        expectedStatus: 200,
        headers: { "x-user": "api-regression" },
        body: {
          fieldValues: {
            titolo: "Contratto Regression",
            cliente: "Cliente Test",
            importo: "1000",
            data: "2026-04-29",
          },
        },
      },
    );
    const fields = (result.body as { field_values?: Record<string, string> })
      .field_values;
    expectCondition(
      fields?.titolo === "Contratto Regression",
      "fieldValues non salvati correttamente",
      result.body,
    );
  });

  await test("Cronologia versioni documento", async () => {
    const result = await requestApi(
      resolvedBaseUrl,
      "GET",
      `/api/documents/${context.documentId}/versions`,
      {
        expectedStatus: 200,
      },
    );
    expectCondition(
      Array.isArray(result.body),
      "Lista versioni documento non e un array",
      result.body,
    );
  });

  await test("Audit log documento", async () => {
    const result = await requestApi(
      resolvedBaseUrl,
      "GET",
      `/api/documents/${context.documentId}/audit`,
      {
        expectedStatus: 200,
      },
    );
    const body = result.body as { data?: unknown[] } | unknown[];
    expectCondition(
      Array.isArray(Array.isArray(body) ? body : body.data),
      "Risposta audit documento non valida",
      result.body,
    );
  });

  await test("Accodamento generazione PDF", async () => {
    const result = await requestApi(
      resolvedBaseUrl,
      "POST",
      `/api/documents/${context.documentId}/generate-pdf`,
      {
        expectedStatus: 202,
        headers: { "x-user": "api-regression" },
      },
    );

    const body = result.body as { jobId?: string; status?: string };
    expectCondition(
      body.jobId !== undefined,
      "jobId PDF mancante nella risposta",
      result.body,
    );
    expectCondition(
      ["queued", "running", "completed"].includes(body.status ?? ""),
      "Status job PDF non valido",
      result.body,
    );
  });

  return {
    ok: true,
    suite: "api-regression",
    baseUrl: resolvedBaseUrl,
    passed: tests.length,
    failed: 0,
    tests,
  };
};

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
  {
    name: "numero_contratto",
    label: "Numero Contratto",
    type: "text",
    required: true,
  },
  {
    name: "nome_fornitore",
    label: "Nome Fornitore",
    type: "text",
    required: true,
  },
  {
    name: "piva_fornitore",
    label: "P.IVA Fornitore",
    type: "text",
    required: true,
  },
  {
    name: "sede_fornitore",
    label: "Sede Legale Fornitore",
    type: "text",
    required: false,
  },
  { name: "nome_cliente", label: "Nome Cliente", type: "text", required: true },
  {
    name: "codice_fiscale_cliente",
    label: "Codice Fiscale / P.IVA",
    type: "text",
    required: false,
  },
  {
    name: "indirizzo_cliente",
    label: "Indirizzo Cliente",
    type: "text",
    required: false,
  },
  { name: "cap_cliente", label: "CAP", type: "text", required: false },
  { name: "citta_cliente", label: "Citta", type: "text", required: false },
  {
    name: "descrizione_servizio",
    label: "Descrizione Servizio",
    type: "text",
    required: true,
  },
  {
    name: "durata_contratto",
    label: "Durata Contratto",
    type: "text",
    required: false,
  },
  { name: "data_inizio", label: "Data Inizio", type: "date", required: true },
  {
    name: "data_fine",
    label: "Data Fine Prevista",
    type: "date",
    required: false,
  },
  {
    name: "importo_netto",
    label: "Imponibile (EUR)",
    type: "number",
    required: true,
  },
  { name: "importo_iva", label: "IVA (EUR)", type: "number", required: false },
  {
    name: "importo_totale",
    label: "Totale (EUR)",
    type: "number",
    required: false,
  },
  {
    name: "modalita_pagamento",
    label: "Modalita di Pagamento",
    type: "text",
    required: false,
  },
  { name: "luogo_firma", label: "Luogo Firma", type: "text", required: false },
  { name: "data_stipula", label: "Data Stipula", type: "date", required: true },
  {
    name: "firma_fornitore",
    label: "Firma Fornitore",
    type: "text",
    required: false,
  },
  {
    name: "firma_cliente",
    label: "Firma Cliente",
    type: "text",
    required: false,
  },
];

const LARGE_FIELD_VALUES: Record<string, string> = {
  numero_contratto: "CONTR-2026-001",
  nome_fornitore: "Acme S.r.l.",
  piva_fornitore: "IT12345678901",
  nome_cliente: "Mario Rossi",
  descrizione_servizio:
    "Sviluppo e manutenzione del sistema di generazione documentale per il periodo di riferimento contrattuale.",
  data_inizio: "2026-05-01",
  importo_netto: "8000",
  luogo_firma: "Napoli",
  data_stipula: "2026-04-30",
};

export const runLargePdfSeed = async ({
  baseUrl,
  request,
}: {
  baseUrl?: string;
  request?: Request;
} = {}): Promise<Record<string, unknown>> => {
  const resolvedBaseUrl = normalizeBaseUrl(baseUrl, request);
  const result: Record<string, unknown> = {};

  const templateResponse = await requestApi(
    resolvedBaseUrl,
    "POST",
    "/api/templates",
    {
      expectedStatus: 201,
      headers: { "x-user": "seed-large-pdf" },
      body: {
        name: `Contratto Fornitura - Seed ${new Date().toISOString().slice(0, 10)}`,
        description:
          "Template grande multi-sezione per test PDF con campi parziali",
        content: LARGE_TEMPLATE_CONTENT,
        fields: LARGE_TEMPLATE_FIELDS,
      },
    },
  );

  const templateBody = templateResponse.body as {
    id: string;
    fields?: unknown[];
  };
  result.templateId = templateBody.id;
  result.templateFields = templateBody.fields?.length ?? 0;

  const documentResponse = await requestApi(
    resolvedBaseUrl,
    "POST",
    "/api/documents",
    {
      expectedStatus: 201,
      headers: { "x-user": "seed-large-pdf" },
      body: {
        name: "Contratto Fornitura - Test Campi Parziali",
        templateId: templateBody.id,
      },
    },
  );

  const documentBody = documentResponse.body as { id: string };
  result.documentId = documentBody.id;

  const filledKeys = Object.keys(LARGE_FIELD_VALUES);
  await requestApi(
    resolvedBaseUrl,
    "PUT",
    `/api/documents/${documentBody.id}`,
    {
      expectedStatus: 200,
      headers: { "x-user": "seed-large-pdf" },
      body: { fieldValues: LARGE_FIELD_VALUES },
    },
  );

  result.filledFields = filledKeys.length;
  result.emptyFields = LARGE_TEMPLATE_FIELDS.length - filledKeys.length;
  result.emptyFieldNames = LARGE_TEMPLATE_FIELDS.map(
    (field) => field.name,
  ).filter((fieldName) => !(fieldName in LARGE_FIELD_VALUES));

  const pdfResponse = await requestApi(
    resolvedBaseUrl,
    "POST",
    `/api/documents/${documentBody.id}/generate-pdf`,
    {
      expectedStatus: 202,
      headers: { "x-user": "seed-large-pdf" },
    },
  );

  const pdfBody = pdfResponse.body as { jobId?: string; status?: string };
  result.pdfJobId = pdfBody.jobId;
  result.pdfJobStatus = pdfBody.status;

  return {
    ok: true,
    note: `PDF accodato con ${result.filledFields} campi compilati e ${result.emptyFields} campi vuoti (rimangono come {{placeholder}} nel PDF). Il file resta in storage.`,
    ...result,
  };
};
