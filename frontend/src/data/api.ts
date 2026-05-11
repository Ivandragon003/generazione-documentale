import type { TemplateVersion } from './mock';

const BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000') + '/api';

// ─── Types ───────────────────────────────────────────────────────────────────

export type DocumentStatus = 'draft' | 'generated' | 'published' | 'archived';

export type TemplateDto = {
  id: string;
  name: string;
  description: string | null;
  content: string;
  fields: TemplateVersion['fields'];
  status: 'draft' | 'published';
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type DocumentDto = {
  id: string;
  name: string;
  template_id: string | null;
  content: string;
  field_values: Record<string, string | number | boolean | null>;
  status: DocumentStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type PdfJobDto = {
  id: string;
  document_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  filename: string | null;
  unresolved_fields: string[];
  error_message: string | null;
  requested_by: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function api<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-user': 'frontend',
      ...(init?.headers ?? {}),
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

export function getTemplates(): Promise<{ data: TemplateDto[]; total: number }> {
  return api(`${BASE}/templates`);
}

export function getTemplateById(id: string): Promise<TemplateDto> {
  return api(`${BASE}/templates/${id}`);
}

export function createTemplate(payload: {
  name: string;
  content: string;
  fields: TemplateVersion['fields'];
  sectionId?: string;
  status?: 'draft' | 'published';
}): Promise<TemplateDto> {
  return api(`${BASE}/templates`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateTemplate(
  id: string,
  payload: {
    name?: string;
    content?: string;
    fields?: TemplateVersion['fields'];
    status?: 'draft' | 'published';
  },
): Promise<TemplateDto> {
  return api(`${BASE}/templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteTemplate(id: string): Promise<void> {
  return api(`${BASE}/templates/${id}`, { method: 'DELETE' });
}

// ─── Documents ───────────────────────────────────────────────────────────────

export function getDocuments(): Promise<{ data: DocumentDto[]; total: number }> {
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
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Aggiorna nome, content e/o field_values di un documento.
 * Usa PUT /api/documents/:id (unico endpoint di update nel backend).
 */
export function updateDocument(
  id: string,
  payload: {
    name?: string;
    content?: string;
    fieldValues?: Record<string, string | number | boolean | null>;
  },
): Promise<DocumentDto> {
  return api(`${BASE}/documents/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteDocument(id: string): Promise<void> {
  return api(`${BASE}/documents/${id}`, { method: 'DELETE' });
}

// ─── PDF Jobs ─────────────────────────────────────────────────────────────────

/** Avvia generazione PDF → POST /api/documents/:id/pdf */
export function triggerPdfGeneration(documentId: string): Promise<PdfJobDto> {
  return api(`${BASE}/documents/${documentId}/pdf`, { method: 'POST' });
}

/** Lista job PDF di un documento → GET /api/documents/:id/pdf/jobs */
export function getPdfJobs(documentId: string): Promise<PdfJobDto[]> {
  return api(`${BASE}/documents/${documentId}/pdf/jobs`);
}

/** Stato singolo job → GET /api/documents/:id/pdf/jobs/:jobId */
export function getPdfJob(documentId: string, jobId: string): Promise<PdfJobDto> {
  return api(`${BASE}/documents/${documentId}/pdf/jobs/${jobId}`);
}

/** URL download PDF completato */
export function getPdfDownloadUrl(documentId: string, jobId: string): string {
  return `${BASE}/documents/${documentId}/pdf/jobs/${jobId}/download`;
}

/** URL ultimo PDF completato */
export function getLatestPdfUrl(documentId: string): string {
  return `${BASE}/documents/${documentId}/pdf/latest`;
}
