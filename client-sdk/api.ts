// Auto-generated TypeScript client — MAC Documents API
// Do not edit manually. Regenerate from openapi.yaml with swagger-codegen.
// NOTE: basePath must be set in Configuration (e.g. http://localhost:3000 for NestJS)

import type { Configuration } from "./configuration";

const BASE_PATH = ""; // intentionally empty — always pass basePath via Configuration

export const COLLECTION_FORMATS = { csv: ",", ssv: " ", tsv: "\t", pipes: "|" };

export type FetchAPI = (url: string, init?: any) => Promise<Response>;
export interface FetchArgs {
  url: string;
  options: any;
}

export class BaseAPI {
  protected configuration?: Configuration; // opzionale — non sempre passata
  constructor(
    configuration?: Configuration,
    protected basePath: string = BASE_PATH,
    protected fetch: FetchAPI = globalThis.fetch,
  ) {
    if (configuration) {
      this.configuration = configuration;
      this.basePath = configuration.basePath || this.basePath;
    }
  }
}

export class RequiredError extends Error {
  name = "RequiredError";
  constructor(
    public field: string,
    msg?: string,
  ) {
    super(msg);
  }
}

// --- Interfaces ---
export interface ApiDocumentsBody {
  name: string;
  templateId: string;
}
export interface ApiTemplatesBody {
  name: string;
  description?: string;
  content: string;
  fields?: Array<any>;
}
export interface InlineResponse200 {
  status?: string;
  timestamp?: string;
}
export interface TemplatesUploadBody {
  name?: string;
  file?: Blob;
}
export interface TemplatesValidatefileBody {
  file?: Blob;
}
export interface TemplatesValidatemdBody {
  content: string;
}

// --- Health ---
export class HealthApi extends BaseAPI {
  public healthControllerCheck(options?: any) {
    return this.fetch(
      this.basePath + "/health",
      Object.assign({ method: "GET" }, options),
    ).then((r) => {
      if (r.status >= 200 && r.status < 300) return r.json();
      throw r;
    });
  }
}

// --- Audit ---
export class AuditApi extends BaseAPI {
  public auditControllerFindAll(
    entityType?: string,
    actor?: string,
    fromDate?: any,
    toDate?: any,
    limit?: number,
    offset?: number,
    options?: any,
  ) {
    const q = new URLSearchParams();
    if (entityType !== undefined) q.set("entityType", entityType);
    if (actor !== undefined) q.set("actor", actor);
    if (fromDate !== undefined) q.set("fromDate", String(fromDate));
    if (toDate !== undefined) q.set("toDate", String(toDate));
    if (limit !== undefined) q.set("limit", String(limit));
    if (offset !== undefined) q.set("offset", String(offset));
    const qs = q.toString() ? "?" + q.toString() : "";
    return this.fetch(
      this.basePath + "/api/audit" + qs,
      Object.assign({ method: "GET" }, options),
    ).then((r) => {
      if (r.status >= 200 && r.status < 300) return r.json();
      throw r;
    });
  }
}

// --- Dev ---
export class DevApi extends BaseAPI {
  public devControllerExecuteTestRun(options?: any) {
    return this.fetch(
      this.basePath + "/api/dev/test-runs/execute",
      Object.assign({ method: "POST" }, options),
    ).then((r) => {
      if (r.status >= 200 && r.status < 300) return r.json();
      throw r;
    });
  }
  public devControllerReset(xResetConfirm: string, options?: any) {
    if (!xResetConfirm) throw new RequiredError("xResetConfirm", "Required");
    return this.fetch(
      this.basePath + "/api/dev/reset",
      Object.assign(
        { method: "POST", headers: { "x-reset-confirm": xResetConfirm } },
        options,
      ),
    ).then((r) => {
      if (r.status >= 200 && r.status < 300) return r.json();
      throw r;
    });
  }
  public devControllerSeedLargePdf(options?: any) {
    return this.fetch(
      this.basePath + "/api/dev/seed-large-pdf",
      Object.assign({ method: "POST" }, options),
    ).then((r) => {
      if (r.status >= 200 && r.status < 300) return r.json();
      throw r;
    });
  }
}

// --- Documents ---
export class DocumentsApi extends BaseAPI {
  public documentsControllerFindAll(
    status?: string,
    limit?: number,
    offset?: number,
    options?: any,
  ) {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (limit !== undefined) q.set("limit", String(limit));
    if (offset !== undefined) q.set("offset", String(offset));
    const qs = q.toString() ? "?" + q.toString() : "";
    return this.fetch(
      this.basePath + "/api/documents" + qs,
      Object.assign({ method: "GET" }, options),
    ).then((r) => {
      if (r.status >= 200 && r.status < 300) return r.json();
      throw r;
    });
  }
  public documentsControllerCreate(body: ApiDocumentsBody, options?: any) {
    if (!body) throw new RequiredError("body", "Required");
    return this.fetch(
      this.basePath + "/api/documents",
      Object.assign(
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        options,
      ),
    ).then((r) => {
      if (r.status >= 200 && r.status < 300) return r.json();
      throw r;
    });
  }
  public documentsControllerFindOne(id: any, options?: any) {
    if (!id) throw new RequiredError("id", "Required");
    return this.fetch(
      this.basePath + `/api/documents/${encodeURIComponent(String(id))}`,
      Object.assign({ method: "GET" }, options),
    ).then((r) => {
      if (r.status >= 200 && r.status < 300) return r.json();
      throw r;
    });
  }
  public documentsControllerUpdate(id: any, options?: any) {
    if (!id) throw new RequiredError("id", "Required");
    return this.fetch(
      this.basePath + `/api/documents/${encodeURIComponent(String(id))}`,
      Object.assign({ method: "PUT" }, options),
    ).then((r) => {
      if (r.status >= 200 && r.status < 300) return r.json();
      throw r;
    });
  }
  public documentsControllerRemove(id: any, options?: any) {
    if (!id) throw new RequiredError("id", "Required");
    return this.fetch(
      this.basePath + `/api/documents/${encodeURIComponent(String(id))}`,
      Object.assign({ method: "DELETE" }, options),
    ).then((r) => {
      if (r.status >= 200 && r.status < 300) return r.json();
      throw r;
    });
  }
  public documentsControllerGeneratePdf(id: any, options?: any) {
    if (!id) throw new RequiredError("id", "Required");
    return this.fetch(
      this.basePath +
        `/api/documents/${encodeURIComponent(String(id))}/generate-pdf`,
      Object.assign({ method: "POST" }, options),
    ).then((r) => {
      if (r.status >= 200 && r.status < 300) return r.json();
      throw r;
    });
  }
  public documentsControllerDownloadPdf(id: any, jobId: any, options?: any) {
    if (!id) throw new RequiredError("id", "Required");
    if (!jobId) throw new RequiredError("jobId", "Required");
    return this.fetch(
      this.basePath +
        `/api/documents/${encodeURIComponent(String(id))}/pdf-jobs/${encodeURIComponent(String(jobId))}/download`,
      Object.assign({ method: "GET" }, options),
    ).then((r) => {
      if (r.status >= 200 && r.status < 300) return r.json();
      throw r;
    });
  }
  public documentsControllerChangeStatus(id: any, options?: any) {
    if (!id) throw new RequiredError("id", "Required");
    return this.fetch(
      this.basePath + `/api/documents/${encodeURIComponent(String(id))}/status`,
      Object.assign({ method: "PATCH" }, options),
    ).then((r) => {
      if (r.status >= 200 && r.status < 300) return r.json();
      throw r;
    });
  }
  public documentsControllerExportMd(id: any, options?: any) {
    if (!id) throw new RequiredError("id", "Required");
    return this.fetch(
      this.basePath +
        `/api/documents/${encodeURIComponent(String(id))}/export-md`,
      Object.assign({ method: "GET" }, options),
    ).then((r) => {
      if (r.status >= 200 && r.status < 300) return r.json();
      throw r;
    });
  }
  public documentsControllerGetVersions(id: any, options?: any) {
    if (!id) throw new RequiredError("id", "Required");
    return this.fetch(
      this.basePath +
        `/api/documents/${encodeURIComponent(String(id))}/versions`,
      Object.assign({ method: "GET" }, options),
    ).then((r) => {
      if (r.status >= 200 && r.status < 300) return r.json();
      throw r;
    });
  }
  public documentsControllerGetVersionContent(
    id: any,
    version: any,
    options?: any,
  ) {
    if (!id) throw new RequiredError("id", "Required");
    if (!version) throw new RequiredError("version", "Required");
    return this.fetch(
      this.basePath +
        `/api/documents/${encodeURIComponent(String(id))}/versions/${encodeURIComponent(String(version))}`,
      Object.assign({ method: "GET" }, options),
    ).then((r) => {
      if (r.status >= 200 && r.status < 300) return r.json();
      throw r;
    });
  }
  public documentsControllerRestoreVersion(
    id: any,
    version: any,
    options?: any,
  ) {
    if (!id) throw new RequiredError("id", "Required");
    if (!version) throw new RequiredError("version", "Required");
    return this.fetch(
      this.basePath +
        `/api/documents/${encodeURIComponent(String(id))}/versions/${encodeURIComponent(String(version))}/restore`,
      Object.assign({ method: "POST" }, options),
    ).then((r) => {
      if (r.status >= 200 && r.status < 300) return r.json();
      throw r;
    });
  }
  public documentsControllerGetPdfJobs(id: any, options?: any) {
    if (!id) throw new RequiredError("id", "Required");
    return this.fetch(
      this.basePath +
        `/api/documents/${encodeURIComponent(String(id))}/pdf-jobs`,
      Object.assign({ method: "GET" }, options),
    ).then((r) => {
      if (r.status >= 200 && r.status < 300) return r.json();
      throw r;
    });
  }
  public documentsControllerGetPdfJob(id: any, jobId: any, options?: any) {
    if (!id) throw new RequiredError("id", "Required");
    if (!jobId) throw new RequiredError("jobId", "Required");
    return this.fetch(
      this.basePath +
        `/api/documents/${encodeURIComponent(String(id))}/pdf-jobs/${encodeURIComponent(String(jobId))}`,
      Object.assign({ method: "GET" }, options),
    ).then((r) => {
      if (r.status >= 200 && r.status < 300) return r.json();
      throw r;
    });
  }
  public documentsControllerLatestPdf(id: any, options?: any) {
    if (!id) throw new RequiredError("id", "Required");
    return this.fetch(
      this.basePath +
        `/api/documents/${encodeURIComponent(String(id))}/latest-pdf`,
      Object.assign({ method: "GET" }, options),
    ).then((r) => {
      if (r.status >= 200 && r.status < 300) return r.json();
      throw r;
    });
  }
  public documentsControllerPreviewPdf(id: any, options?: any) {
    if (!id) throw new RequiredError("id", "Required");
    return this.fetch(
      this.basePath +
        `/api/documents/${encodeURIComponent(String(id))}/preview-pdf`,
      Object.assign({ method: "GET" }, options),
    ).then((r) => {
      if (r.status >= 200 && r.status < 300) return r.json();
      throw r;
    });
  }
  public documentsControllerRename(id: any, options?: any) {
    if (!id) throw new RequiredError("id", "Required");
    return this.fetch(
      this.basePath + `/api/documents/${encodeURIComponent(String(id))}/rename`,
      Object.assign({ method: "PATCH" }, options),
    ).then((r) => {
      if (r.status >= 200 && r.status < 300) return r.json();
      throw r;
    });
  }
  public documentsControllerGetAudit(
    id: any,
    limit?: number,
    offset?: number,
    options?: any,
  ) {
    if (!id) throw new RequiredError("id", "Required");
    const q = new URLSearchParams();
    if (limit !== undefined) q.set("limit", String(limit));
    if (offset !== undefined) q.set("offset", String(offset));
    const qs = q.toString() ? "?" + q.toString() : "";
    return this.fetch(
      this.basePath +
        `/api/documents/${encodeURIComponent(String(id))}/audit` +
        qs,
      Object.assign({ method: "GET" }, options),
    ).then((r) => {
      if (r.status >= 200 && r.status < 300) return r.json();
      throw r;
    });
  }
}

// --- Templates ---
export class TemplatesApi extends BaseAPI {
  public templatesControllerFindAll(
    status?: string,
    limit?: number,
    offset?: number,
    options?: any,
  ) {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (limit !== undefined) q.set("limit", String(limit));
    if (offset !== undefined) q.set("offset", String(offset));
    const qs = q.toString() ? "?" + q.toString() : "";
    return this.fetch(
      this.basePath + "/api/templates" + qs,
      Object.assign({ method: "GET" }, options),
    ).then((r) => {
      if (r.status >= 200 && r.status < 300) return r.json();
      throw r;
    });
  }
  public templatesControllerCreate(body: ApiTemplatesBody, options?: any) {
    if (!body) throw new RequiredError("body", "Required");
    return this.fetch(
      this.basePath + "/api/templates",
      Object.assign(
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        options,
      ),
    ).then((r) => {
      if (r.status >= 200 && r.status < 300) return r.json();
      throw r;
    });
  }
  public templatesControllerFindOne(id: any, options?: any) {
    if (!id) throw new RequiredError("id", "Required");
    return this.fetch(
      this.basePath + `/api/templates/${encodeURIComponent(String(id))}`,
      Object.assign({ method: "GET" }, options),
    ).then((r) => {
      if (r.status >= 200 && r.status < 300) return r.json();
      throw r;
    });
  }
  public templatesControllerUpdate(id: any, options?: any) {
    if (!id) throw new RequiredError("id", "Required");
    return this.fetch(
      this.basePath + `/api/templates/${encodeURIComponent(String(id))}`,
      Object.assign({ method: "PATCH" }, options),
    ).then((r) => {
      if (r.status >= 200 && r.status < 300) return r.json();
      throw r;
    });
  }
  public templatesControllerRemove(id: any, options?: any) {
    if (!id) throw new RequiredError("id", "Required");
    return this.fetch(
      this.basePath + `/api/templates/${encodeURIComponent(String(id))}`,
      Object.assign({ method: "DELETE" }, options),
    ).then((r) => {
      if (r.status >= 200 && r.status < 300) return r.json();
      throw r;
    });
  }
  public templatesControllerPublish(id: any, options?: any) {
    if (!id) throw new RequiredError("id", "Required");
    return this.fetch(
      this.basePath +
        `/api/templates/${encodeURIComponent(String(id))}/publish`,
      Object.assign({ method: "POST" }, options),
    ).then((r) => {
      if (r.status >= 200 && r.status < 300) return r.json();
      throw r;
    });
  }
  public templatesControllerExportMd(id: any, options?: any) {
    if (!id) throw new RequiredError("id", "Required");
    return this.fetch(
      this.basePath +
        `/api/templates/${encodeURIComponent(String(id))}/export-md`,
      Object.assign({ method: "GET" }, options),
    ).then((r) => {
      if (r.status >= 200 && r.status < 300) return r.json();
      throw r;
    });
  }
  public templatesControllerGetVersions(id: any, options?: any) {
    if (!id) throw new RequiredError("id", "Required");
    return this.fetch(
      this.basePath +
        `/api/templates/${encodeURIComponent(String(id))}/versions`,
      Object.assign({ method: "GET" }, options),
    ).then((r) => {
      if (r.status >= 200 && r.status < 300) return r.json();
      throw r;
    });
  }
  public templatesControllerGetVersionContent(
    id: any,
    version: any,
    options?: any,
  ) {
    if (!id) throw new RequiredError("id", "Required");
    if (!version) throw new RequiredError("version", "Required");
    return this.fetch(
      this.basePath +
        `/api/templates/${encodeURIComponent(String(id))}/versions/${encodeURIComponent(String(version))}`,
      Object.assign({ method: "GET" }, options),
    ).then((r) => {
      if (r.status >= 200 && r.status < 300) return r.json();
      throw r;
    });
  }
  public templatesControllerRestore(id: any, version: any, options?: any) {
    if (!id) throw new RequiredError("id", "Required");
    if (!version) throw new RequiredError("version", "Required");
    return this.fetch(
      this.basePath +
        `/api/templates/${encodeURIComponent(String(id))}/versions/${encodeURIComponent(String(version))}/restore`,
      Object.assign({ method: "POST" }, options),
    ).then((r) => {
      if (r.status >= 200 && r.status < 300) return r.json();
      throw r;
    });
  }
  public templatesControllerImportFile(
    name: string,
    file: Blob,
    options?: any,
  ) {
    if (!name) throw new RequiredError("name", "Required");
    if (!file) throw new RequiredError("file", "Required");
    const formData = new FormData();
    formData.append("name", name);
    formData.append("file", file);
    return this.fetch(
      this.basePath + "/api/templates/upload",
      Object.assign({ method: "POST", body: formData }, options),
    ).then((r) => {
      if (r.status >= 200 && r.status < 300) return r.json();
      throw r;
    });
  }
  public templatesControllerValidateFile(file: Blob, options?: any) {
    if (!file) throw new RequiredError("file", "Required");
    const formData = new FormData();
    formData.append("file", file);
    return this.fetch(
      this.basePath + "/api/templates/validate-file",
      Object.assign({ method: "POST", body: formData }, options),
    ).then((r) => {
      if (r.status >= 200 && r.status < 300) return r.json();
      throw r;
    });
  }
  public templatesControllerValidateMd(
    body: TemplatesValidatemdBody,
    options?: any,
  ) {
    if (!body) throw new RequiredError("body", "Required");
    return this.fetch(
      this.basePath + "/api/templates/validate-md",
      Object.assign(
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        options,
      ),
    ).then((r) => {
      if (r.status >= 200 && r.status < 300) return r.json();
      throw r;
    });
  }
}

// --- Pdf ---
export class PdfApi extends BaseAPI {
  public pdfControllerValidateTemplate(templateId: any, options?: any) {
    if (!templateId) throw new RequiredError("templateId", "Required");
    return this.fetch(
      this.basePath +
        `/api/pdf/validate-template/${encodeURIComponent(String(templateId))}`,
      Object.assign({ method: "GET" }, options),
    ).then((r) => {
      if (r.status >= 200 && r.status < 300) return r.json();
      throw r;
    });
  }
}
