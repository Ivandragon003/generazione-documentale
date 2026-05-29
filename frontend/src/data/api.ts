const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:3000"}/api`;
export class ApiRequestError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function toApiError(res: Response): Promise<ApiRequestError> {
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? (JSON.parse(text) as unknown) : undefined;
  } catch {
    parsed = undefined;
  }
  let message = `Request failed with status ${res.status}`;
  if (parsed && typeof parsed === "object" && "message" in parsed) {
    const rawMessage = (parsed as { message?: unknown }).message;
    if (typeof rawMessage === "string" && rawMessage.trim().length > 0) {
      message = rawMessage;
    } else if (Array.isArray(rawMessage)) {
      const normalized = rawMessage
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean);
      if (normalized.length > 0) {
        message = normalized.join("; ");
      }
    }
  } else if (text.trim().length > 0) {
    message = text;
  }
  return new ApiRequestError(res.status, message, parsed);
}

export type FieldType =
  | "string"
  | "text"
  | "textarea"
  | "number"
  | "integer"
  | "date"
  | "boolean"
  | "phone"
  | "checkbox"
  | "email"
  | "url"
  | "tel"
  | "select"
  | "currency"
  | "percentage"
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
  maxLength?: number;
  defaultValue?: string;
  placeholder?: string;
  listName?: string;
  listLabel?: string;
  options?: ApiTemplateFieldOption[];
  columns?: ApiTemplateField[];
};

export type TemplateDto = {
  id: string;
  name: string;
  content: string;
  githubPath?: string;
  category?: string | null;
  section?: string | null;
  fields: ApiTemplateField[];
  contentHash: string;
  createdAt: string;
  updatedAt: string;
};

export type TenantDto = {
  uuid: string;
  name: string;
  description?: string;
};

export type TemplateVersionDto = {
  sha: string;
  shortSha: string;
  message: string;
  author: string | null;
  committedAt: string | null;
};

export type TemplateFieldListDto = {
  id?: string;
  tenantUuid: string;
  listName: string;
  values: string[];
  updatedAt?: string;
};

export type AuditLogDto = {
  id: string;
  tenant_uuid: string;
  event_type: string;
  actor: string;
  template_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

export type TemplateTreeFolderNode = {
  type: "folder";
  name: string;
  path: string;
};

export type TemplateTreeFileNode = {
  type: "template";
  name: string;
  path: string;
  id: string;
};

export type TemplateTreeLevelDto = {
  path: string;
  folders: TemplateTreeFolderNode[];
  templates: TemplateTreeFileNode[];
  nextCursor: string | null;
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

export type DeterministicValidationIssueDto = {
  code: string;
  severity?: "error" | "warning";
  placeholder?: string;
  message: string;
  line: number;
  blocking: boolean;
  fieldName?: string;
  invalidType?: string;
  suggestion?: string;
  autoFixable?: boolean;
};

export type AiSemanticWarningDto = {
  fieldName: string;
  currentType: string;
  suggestedType: string | null;
  reason: string;
  confidence: number;
  severity: "info" | "warning";
};

export type TemplateAuditReportDto = {
  deterministic: {
    errors: DeterministicValidationIssueDto[];
    warnings: DeterministicValidationIssueDto[];
    durationMs: number;
  };
  ai: {
    warnings: AiSemanticWarningDto[];
    provider: string;
    model: string | null;
    latencyMs: number;
    failed?: boolean;
    error?: string;
  } | null;
};

export type TemplateDraftGenerationReportDto = {
  content: string;
  fields: Array<{ name: string; type: string; line: number }>;
  placeholderAnalysis?: {
    extractedFields: Array<{ raw: string; type: string; name: string }>;
    validFields: Array<{ raw: string; type: string; name: string }>;
    invalidPlaceholders: string[];
    syntaxErrors: string[];
    unsupportedTypes: string[];
    duplicatedPlaceholders: string[];
    placeholdersInTitles: string[];
    truncatedOutputErrors: string[];
    nonExtractedInvalidPlaceholders: string[];
    repairableErrors: string[];
    nonRepairableErrors: string[];
    repairableErrorsAvailable: boolean;
    repairApplied: boolean;
    blockingErrorsAfterRepair: number;
    sectionsWithDescription: number;
    sectionsMissingDescription: number;
    genericDescriptionsCount: number;
    didacticQualityScore: number;
  };
  deterministic: {
    errors: DeterministicValidationIssueDto[];
    warnings: DeterministicValidationIssueDto[];
    durationMs: number;
  };
  semanticAudit: {
    warnings: AiSemanticWarningDto[];
  };
  ai: {
    provider: string;
    model: string | null;
    latencyMs: number;
    failed: boolean;
    error: string | null;
  };
  benchmark?: {
    generationMode: "free" | "guided";
    syntaxSpecIncluded: boolean;
    syntaxSpecVersion: string | null;
    parserVersion: string | null;
  };
  repair?: {
    applied: boolean;
    changes: string[];
    errorsBeforeRepair: number;
    repairableErrorsAvailable: boolean;
    repairAppliedCount: number;
    repairedPlaceholders: string[];
    errorsAfterRepair: number;
    blockingErrorsAfterRepair: number;
    finalValidationPassed: boolean;
  };
  savable: boolean;
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
    throw await toApiError(res);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function segment(value: string): string {
  return encodeURIComponent(value);
}

function withTenant(url: string, tenantUuid?: string): string {
  if (!tenantUuid) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}tenantUuid=${encodeURIComponent(tenantUuid)}`;
}

function browserLanguage(): string | undefined {
  if (typeof navigator === "undefined") return undefined;
  return navigator.language || navigator.languages?.[0];
}

export function getTemplates(tenantUuid?: string): Promise<{
  data: TemplateDto[];
  total: number;
}> {
  return api(withTenant(`${BASE}/templates`, tenantUuid));
}

export function getTemplateTreeLevel(
  tenantUuid: string,
  path = "",
  cursor = "0",
  limit = 50,
): Promise<TemplateTreeLevelDto> {
  const base = `${BASE}/templates/tree?path=${encodeURIComponent(path)}&cursor=${encodeURIComponent(cursor)}&limit=${limit}`;
  return api(withTenant(base, tenantUuid));
}

export function searchTemplatesLazy(
  tenantUuid: string,
  q: string,
  path = "",
  cursor = "0",
  limit = 50,
): Promise<{ items: TemplateTreeFileNode[]; nextCursor: string | null }> {
  const base = `${BASE}/templates/search?q=${encodeURIComponent(q)}&path=${encodeURIComponent(path)}&cursor=${encodeURIComponent(cursor)}&limit=${limit}`;
  return api(withTenant(base, tenantUuid));
}

export function getTemplateContent(
  templateId: string,
  tenantUuid: string,
): Promise<TemplateDto> {
  return api(
    withTenant(`${BASE}/templates/${segment(templateId)}/content`, tenantUuid),
  );
}

export function createTemplate(payload: {
  name: string;
  content: string;
  fields?: ApiTemplateField[];
  path?: string;
  tenantUuid?: string;
}): Promise<TemplateDto> {
  return api(withTenant(`${BASE}/templates`, payload.tenantUuid), {
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
    tenantUuid?: string;
  },
): Promise<TemplateDto> {
  return api(
    withTenant(`${BASE}/templates/${segment(id)}`, payload.tenantUuid),
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
}

export function deleteTemplate(id: string, tenantUuid?: string): Promise<void> {
  return api(withTenant(`${BASE}/templates/${segment(id)}`, tenantUuid), {
    method: "DELETE",
  });
}

export function triggerPdfGeneration(
  templateId: string,
  fieldValues: FieldValueMap = {},
  tenantUuid?: string,
): Promise<PdfJobDto> {
  return api(
    withTenant(`${BASE}/templates/${segment(templateId)}/pdf`, tenantUuid),
    {
      method: "POST",
      body: JSON.stringify({ fieldValues, language: browserLanguage() }),
    },
  );
}

export function getPdfJobs(
  templateId: string,
  tenantUuid?: string,
): Promise<PdfJobDto[]> {
  return api(
    withTenant(`${BASE}/templates/${segment(templateId)}/pdf/jobs`, tenantUuid),
  );
}

export function getPdfJob(
  templateId: string,
  jobId: string,
  tenantUuid?: string,
): Promise<PdfJobDto> {
  return api(
    withTenant(
      `${BASE}/templates/${segment(templateId)}/pdf/jobs/${segment(jobId)}`,
      tenantUuid,
    ),
  );
}

export function getLatestPdfDownloadUrl(
  templateId: string,
  fieldValues: FieldValueMap,
  tenantUuid?: string,
): string {
  const language = browserLanguage();
  const url = `${BASE}/templates/${segment(templateId)}/pdf/latest?fieldValues=${encodeURIComponent(JSON.stringify(fieldValues))}${
    language ? `&language=${encodeURIComponent(language)}` : ""
  }`;
  return withTenant(url, tenantUuid);
}

export function getPdfJobDownloadUrl(
  templateId: string,
  jobId: string,
  tenantUuid?: string,
): string {
  return withTenant(
    `${BASE}/templates/${segment(templateId)}/pdf/jobs/${segment(jobId)}/download`,
    tenantUuid,
  );
}

export function validateTemplateMarkdown(content: string): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
  deterministic?: TemplateAuditReportDto["deterministic"];
  ai?: TemplateAuditReportDto["ai"];
}> {
  return api(`${BASE}/templates/validate`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export function auditTemplateMarkdown(
  content: string,
  runAi = true,
): Promise<TemplateAuditReportDto> {
  return api(`${BASE}/templates/audit`, {
    method: "POST",
    body: JSON.stringify({ content, runAi }),
  });
}

export function generateTemplateDraft(payload: {
  description: string;
  language?: string;
  runSemanticAudit?: boolean;
  generationMode?: "free" | "guided";
  autoRepair?: boolean;
  defaultLength?: number;
}): Promise<TemplateDraftGenerationReportDto> {
  return api(`${BASE}/templates/generate-draft`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function repairTemplateDraft(payload: {
  content: string;
  language?: string;
  runSemanticAudit?: boolean;
  generationMode?: "free" | "guided";
  defaultLength?: number;
}): Promise<TemplateDraftGenerationReportDto> {
  return api(`${BASE}/templates/repair-draft`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function generateDocxBlob(
  templateId: string,
  fieldValues: FieldValueMap = {},
  tenantUuid?: string,
): Promise<Blob> {
  const res = await fetch(
    withTenant(`${BASE}/templates/${segment(templateId)}/docx`, tenantUuid),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user": "frontend",
      },
      body: JSON.stringify({ fieldValues, language: browserLanguage() }),
    },
  );
  if (!res.ok) {
    throw await toApiError(res);
  }
  return res.blob();
}

export function getTenants(): Promise<TenantDto[]> {
  return api(`${BASE}/templates/tenants`);
}

export function listTemplateVersions(
  templateId: string,
  tenantUuid: string,
): Promise<TemplateVersionDto[]> {
  return api(
    withTenant(`${BASE}/templates/${segment(templateId)}/versions`, tenantUuid),
  );
}

export function getTemplateVersionContent(
  templateId: string,
  commitSha: string,
  tenantUuid: string,
): Promise<{ content: string; commitSha: string }> {
  return api(
    withTenant(
      `${BASE}/templates/${segment(templateId)}/versions/${segment(commitSha)}`,
      tenantUuid,
    ),
  );
}

export function restoreTemplateVersion(
  templateId: string,
  commitSha: string,
  tenantUuid: string,
): Promise<{ restoredFrom: string }> {
  return api(
    withTenant(
      `${BASE}/templates/${segment(templateId)}/versions/${segment(commitSha)}/restore`,
      tenantUuid,
    ),
    { method: "POST" },
  );
}

export function getTemplateListValues(
  tenantUuid: string,
  listName: string,
): Promise<TemplateFieldListDto> {
  return api(
    `${BASE}/templates/tenants/${segment(tenantUuid)}/template-lists/${segment(listName)}`,
  );
}

export function getTenantTemplateLists(tenantUuid: string): Promise<
  Array<{
    id: string;
    tenant_uuid: string;
    list_name: string;
    values: string[];
    created_at: string;
    updated_at: string;
  }>
> {
  return api(`${BASE}/templates/tenants/${segment(tenantUuid)}/template-lists`);
}

export function getTenantAuditLogs(
  tenantUuid: string,
  templateId?: string,
  limit = 100,
  offset = 0,
): Promise<AuditLogDto[]> {
  const templateFilter = templateId
    ? `&templateId=${encodeURIComponent(templateId)}`
    : "";
  return api(
    `${BASE}/templates/tenants/${segment(tenantUuid)}/audit-logs?limit=${limit}&offset=${offset}${templateFilter}`,
  );
}
