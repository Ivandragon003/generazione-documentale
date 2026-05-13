const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:3000"}/api`;

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "boolean"
  | "checkbox"
  | "email"
  | "url"
  | "tel"
  | "select"
  | "currency"
  | "table"
  | "subtable"
  | "list"
  | "repeater";

export type FieldPrimitive = string | number | boolean | null;
export interface FieldRow {
  [key: string]: FieldValue;
}
export type FieldValue = FieldPrimitive | FieldRow | FieldRow[];
export type FieldValueMap = Record<string, FieldValue>;

export type ApiTemplateFieldOption = {
  label: string;
  value: string;
};

export type ApiTemplateField = {
  name: string;
  label?: string;
  type?: FieldType;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  options?: ApiTemplateFieldOption[];
  columns?: ApiTemplateField[];
};

export type TemplateDto = {
  id: string;
  name: string;
  description: string | null;
  content: string;
  githubPath?: string;
  category?: string | null;
  section?: string | null;
  fields: ApiTemplateField[];
  contentHash: string;
  createdAt: string;
  updatedAt: string;
};

export type PdfJobDto = {
  id: string;
  templateId: string;
  status: "queued" | "running" | "completed" | "failed";
  filename: string | null;
  fieldValues: FieldValueMap;
  templateContentHash: string | null;
  fieldValuesHash: string | null;
  renderedContentHash: string | null;
  unresolvedFields: string[];
  errorMessage: string | null;
  requestedBy: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

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

function segment(value: string): string {
  return encodeURIComponent(value);
}

export function getTemplates(): Promise<{
  data: TemplateDto[];
  total: number;
}> {
  return api(`${BASE}/templates`);
}

export function createTemplate(payload: {
  name: string;
  content: string;
  fields?: ApiTemplateField[];
  path?: string;
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
  },
): Promise<TemplateDto> {
  return api(`${BASE}/templates/${segment(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function triggerPdfGeneration(
  templateId: string,
  fieldValues: FieldValueMap = {},
): Promise<PdfJobDto> {
  return api(`${BASE}/templates/${segment(templateId)}/pdf`, {
    method: "POST",
    body: JSON.stringify({ fieldValues, strict: false }),
  });
}

export function getPdfJobs(templateId: string): Promise<PdfJobDto[]> {
  return api(`${BASE}/templates/${segment(templateId)}/pdf/jobs`);
}

export function getPdfJob(
  templateId: string,
  jobId: string,
): Promise<PdfJobDto> {
  return api(
    `${BASE}/templates/${segment(templateId)}/pdf/jobs/${segment(jobId)}`,
  );
}

export function getLatestPdfDownloadUrl(
  templateId: string,
  fieldValues: FieldValueMap,
): string {
  return `${BASE}/templates/${segment(templateId)}/pdf/latest?fieldValues=${encodeURIComponent(JSON.stringify(fieldValues))}`;
}
