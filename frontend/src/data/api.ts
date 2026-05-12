const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:3000"}/api`;

// ─── Types ───────────────────────────────────────────────────────────────────

export type DocumentStatus = "draft" | "generated" | "published" | "archived";

export type TemplateDto = {
  id: string;
  name: string;
  description: string | null;
  content: string;
  fields: ApiTemplateField[];
  status: "draft" | "published";
  createdAt: string;
  updatedAt: string;
};

// Backend risponde camelCase (response.mapper.ts)
export type DocumentDto = {
  id: string;
  name: string;
  templateId: string | null;
  content: string;
  fieldValues: Record<string, string | number | boolean | null>;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
};

export type PdfJobDto = {
  id: string;
  documentId: string;
  status: "queued" | "running" | "completed" | "failed";
  filename: string | null;
  unresolvedFields: string[];
  errorMessage: string | null;
  requestedBy: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

/**
 * Tipo campo allineato a TemplateFieldDto del backend.
 * IMPORTANTE: usa "name" (non "key") — whitelist:true nel ValidationPipe
 * strippava "key" causando body:undefined nel controller.
 */
export type ApiTemplateField = {
  name: string; // corrisponde a TemplateFieldDto.name
  label?: string;
  type?:
    | "text"
    | "textarea"
    | "number"
    | "date"
    | "boolean"
    | "email"
    | "url"
    | "tel"
    | "select"
    | "currency";
  required?: boolean;
  defaultValue?: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function api<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-user": "frontend",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[${res.status}] ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Templates ───────────────────────────────────────────────────────────────

export function getTemplates(): Promise<{
  data: TemplateDto[];
  total: number;
}> {
  return api(`${BASE}/templates`);
}

export function getTemplateById(id: string): Promise<TemplateDto> {
  return api(`${BASE}/templates/${id}`);
}

/**
 * Crea un nuovo template.
 * Il payload usa ApiTemplateField (con "name") — non TemplateVersion["fields"] (con "key").
 */
export function createTemplate(payload: {
  name: string;
  content: string;
  fields?: ApiTemplateField[];
  status?: "draft" | "published";
}): Promise<TemplateDto> {
  return api(`${BASE}/templates`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Aggiorna un template esistente.
 * Stessa convenzione: fields usa ApiTemplateField.
 */
export function updateTemplate(
  id: string,
  payload: {
    name?: string;
    content?: string;
    fields?: ApiTemplateField[];
    status?: "draft" | "published";
  },
): Promise<TemplateDto> {
  return api(`${BASE}/templates/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteTemplate(id: string): Promise<void> {
  return api(`${BASE}/templates/${id}`, { method: "DELETE" });
}

// ─── Documents ───────────────────────────────────────────────────────────────

export function getDocuments(): Promise<{
  data: DocumentDto[];
  total: number;
}> {
  return api(`${BASE}/documents`);
}

export function getDocumentById(id: string): Promise<DocumentDto> {
  return api(`${BASE}/documents/${id}`);
}

export function createDocument(payload: {
  name: string;
  templateId: string;
}): Promise<DocumentDto> {
  return api(`${BASE}/documents`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateDocument(
  id: string,
  payload: {
    name?: string;
    content?: string;
    fieldValues?: Record<string, string | number | boolean | null>;
  },
): Promise<DocumentDto> {
  return api(`${BASE}/documents/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteDocument(id: string): Promise<void> {
  return api(`${BASE}/documents/${id}`, { method: "DELETE" });
}

// ─── PDF Jobs ─────────────────────────────────────────────────────────────────

export function triggerPdfGeneration(documentId: string): Promise<PdfJobDto> {
  return api(`${BASE}/documents/${documentId}/pdf`, { method: "POST" });
}

export function getPdfJobs(documentId: string): Promise<PdfJobDto[]> {
  return api(`${BASE}/documents/${documentId}/pdf/jobs`);
}

export function getPdfJob(
  documentId: string,
  jobId: string,
): Promise<PdfJobDto> {
  return api(`${BASE}/documents/${documentId}/pdf/jobs/${jobId}`);
}

export function getPdfDownloadUrl(documentId: string, jobId: string): string {
  return `${BASE}/documents/${documentId}/pdf/jobs/${jobId}/download`;
}

export function getLatestPdfUrl(documentId: string): string {
  return `${BASE}/documents/${documentId}/pdf/latest`;
}
