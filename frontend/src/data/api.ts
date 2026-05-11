import type { TemplateVersion } from './mock';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// ─── Types ───────────────────────────────────────────────────────────────────

export type DocumentStatus = 'draft' | 'generated' | 'published' | 'archived';

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

// ─── Templates ───────────────────────────────────────────────────────────────

export async function getTemplates(): Promise<TemplateVersion[]> {
  const res = await fetch(`${BASE_URL}/templates`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<TemplateVersion[]>;
}

export async function getTemplateById(id: string): Promise<TemplateVersion> {
  const res = await fetch(`${BASE_URL}/templates/${id}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<TemplateVersion>;
}

export async function createTemplate(payload: {
  name: string;
  markdown: string;
  fields: TemplateVersion['fields'];
}): Promise<TemplateVersion> {
  const res = await fetch(`${BASE_URL}/templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<TemplateVersion>;
}

export async function updateTemplate(
  id: string,
  payload: { markdown: string; fields: TemplateVersion['fields'] }
): Promise<TemplateVersion> {
  const res = await fetch(`${BASE_URL}/templates/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<TemplateVersion>;
}

// ─── Documents ───────────────────────────────────────────────────────────────

export async function getDocuments(): Promise<DocumentDto[]> {
  const res = await fetch(`${BASE_URL}/documents`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<DocumentDto[]>;
}

export async function getDocumentById(id: string): Promise<DocumentDto> {
  const res = await fetch(`${BASE_URL}/documents/${id}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<DocumentDto>;
}

export async function createDocument(payload: {
  name: string;
  template_id: string;
  content: string;
  field_values: Record<string, string | number | boolean | null>;
}): Promise<DocumentDto> {
  const res = await fetch(`${BASE_URL}/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<DocumentDto>;
}

export async function updateDocumentFields(
  id: string,
  field_values: Record<string, string | number | boolean | null>
): Promise<DocumentDto> {
  const res = await fetch(`${BASE_URL}/documents/${id}/field-values`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ field_values }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<DocumentDto>;
}

export async function updateDocumentStatus(
  id: string,
  status: DocumentStatus
): Promise<DocumentDto> {
  const res = await fetch(`${BASE_URL}/documents/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<DocumentDto>;
}

// ─── PDF Jobs ─────────────────────────────────────────────────────────────────

export async function triggerPdfGeneration(document_id: string): Promise<PdfJobDto> {
  const res = await fetch(`${BASE_URL}/pdf-jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_id }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<PdfJobDto>;
}

export async function getPdfJobStatus(job_id: string): Promise<PdfJobDto> {
  const res = await fetch(`${BASE_URL}/pdf-jobs/${job_id}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<PdfJobDto>;
}

export async function getPdfJobsByDocument(document_id: string): Promise<PdfJobDto[]> {
  const res = await fetch(`${BASE_URL}/pdf-jobs?document_id=${document_id}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<PdfJobDto[]>;
}
