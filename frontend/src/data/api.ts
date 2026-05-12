const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:3000"}/api`;

// ─── Types ───────────────────────────────────────────────────────────────────

export type TemplateDto = {
  id: string;
  name: string;
  description: string | null;
  content: string;
  githubPath?: string;
  category?: string | null;
  section?: string | null;
  fields: ApiTemplateField[];
  status: "draft" | "published";
  createdAt: string;
  updatedAt: string;
};

export type PdfJobDto = {
  id: string;
  templateId: string;
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
  name: string;
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

export function getTemplates(): Promise<{ data: TemplateDto[]; total: number }> {
  return api(`${BASE}/templates`);
}

export function getTemplateById(id: string): Promise<TemplateDto> {
  return api(`${BASE}/templates/${id}`);
}

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

// ─── PDF (direttamente su template, senza Document) ──────────────────────────

export function triggerPdfGeneration(
  templateId: string,
  fieldValues: Record<string, string | number | boolean | null> = {},
): Promise<PdfJobDto> {
  return api(`${BASE}/templates/${templateId}/pdf`, {
    method: "POST",
    body: JSON.stringify({ fieldValues }),
  });
}

export function getPdfJobs(templateId: string): Promise<PdfJobDto[]> {
  return api(`${BASE}/templates/${templateId}/pdf/jobs`);
}

export function getPdfJob(templateId: string, jobId: string): Promise<PdfJobDto> {
  return api(`${BASE}/templates/${templateId}/pdf/jobs/${jobId}`);
}

export function getPdfDownloadUrl(templateId: string, jobId: string): string {
  return `${BASE}/templates/${templateId}/pdf/jobs/${jobId}/download`;
}

export function getLatestPdfUrl(templateId: string): string {
  return `${BASE}/templates/${templateId}/pdf/latest`;
}
