import { Injectable } from "@nestjs/common";
import type { DataSource } from "typeorm";
import { makeError } from "../common/utils/errors";
import { appConfig } from "../config/app.config";
import type { DocumentsRepository } from "../repository/documents.repository";
import {
  generatePdf,
  getMissingRequiredFields,
  type PdfGenerateOptions,
} from "./pdf.service";
import type { TemplatesService } from "./templates.service";

const PDF_JOB_CONCURRENCY = 1;
const QUEUE_RECOVERY_RETRY_MS = appConfig.pdfQueueRecoveryRetryMs;

let activePdfJobs = 0;
const queuedPdfJobs: Array<() => Promise<void>> = [];
let queueRecoveryStarted = false;
let queueRecoveryTimer: NodeJS.Timeout | null = null;

const enqueuePdfJob = (task: () => Promise<void>): void => {
  queuedPdfJobs.push(task);
  drainPdfQueue();
};

const drainPdfQueue = (): void => {
  while (activePdfJobs < PDF_JOB_CONCURRENCY && queuedPdfJobs.length > 0) {
    const task = queuedPdfJobs.shift();
    if (!task) return;
    activePdfJobs += 1;
    setImmediate(async () => {
      try {
        await task();
      } finally {
        activePdfJobs -= 1;
        drainPdfQueue();
      }
    });
  }
};

export interface CreateDocumentInput {
  name: string;
  templateId: string;
  created_by?: string;
}

export interface UpdateDocumentInput {
  name?: string;
  content?: string;
  fieldValues?: Record<string, string | number | boolean | null>;
  created_by?: string;
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly documentsRepository: DocumentsRepository,
    private readonly templatesService: TemplatesService,
  ) {
    setImmediate(() => {
      this.ensureQueueRecovery().catch(() => undefined);
    });
  }

  private async findOneOrThrow(id: string) {
    const document = await this.findOne(id);
    if (!document) throw makeError("Documento non trovato", 404);
    return document;
  }

  private async ensureQueueRecovery(): Promise<void> {
    if (queueRecoveryStarted) return;
    queueRecoveryStarted = true;
    try {
      const queuedJobs = await this.documentsRepository.findQueuedPdfJobs();
      for (const job of queuedJobs) {
        enqueuePdfJob(async () => this.processPdfJob(job.id));
      }
    } catch {
      queueRecoveryStarted = false;
      if (!queueRecoveryTimer) {
        queueRecoveryTimer = setTimeout(() => {
          queueRecoveryTimer = null;
          this.ensureQueueRecovery().catch(() => undefined);
        }, QUEUE_RECOVERY_RETRY_MS);
      }
    }
  }

  async findAll({
    status,
    limit = 20,
    offset = 0,
  }: {
    status?: "draft" | "generated" | "published" | "archived";
    limit?: number;
    offset?: number;
  }) {
    const { data, total } = await this.documentsRepository.findAll({
      status,
      limit,
      offset,
    });
    return { data, total, limit, offset };
  }

  async findOne(id: string) {
    return this.documentsRepository.findById(id);
  }

  async create({
    name,
    templateId,
    created_by = "system",
  }: CreateDocumentInput) {
    if (!name || name.trim().length === 0) {
      throw makeError("Il nome documento e obbligatorio", 400);
    }
    const template = await this.templatesService.findOne(templateId);
    if (!template) throw makeError("Template non trovato", 404);
    const document = await this.dataSource.transaction(async (manager) => {
      const created = await this.documentsRepository.insertDocument(manager, {
        name: name.trim(),
        templateId,
        templateVersion: template.version,
        content: template.content,
        createdBy: created_by,
      });
      await this.documentsRepository.insertDocumentVersion(manager, {
        documentId: created.id,
        version: 1,
        content: template.content,
        fieldValues: {},
        action: "create",
        createdBy: created_by,
      });
      return created;
    });
    return document;
  }

  private async getFieldDefinitions(document: { template_id: string | null }) {
    if (!document.template_id) return [];
    const template = await this.templatesService.findOne(document.template_id);
    return template?.fields ?? [];
  }

  async update(
    id: string,
    { name, content, fieldValues, created_by = "system" }: UpdateDocumentInput,
  ) {
    const existing = await this.findOneOrThrow(id);
    if (
      fieldValues !== undefined &&
      (fieldValues === null || Array.isArray(fieldValues))
    ) {
      throw makeError("fieldValues deve essere un oggetto", 400);
    }
    const maxVersion = await this.documentsRepository.getMaxVersion(id);
    const nextVersion = maxVersion + 1;
    const nextContent = content ?? existing.content;
    const nextFieldValues = fieldValues ?? existing.field_values;
    const updated = await this.dataSource.transaction(async (manager) => {
      const row = await this.documentsRepository.updateDocument(manager, {
        id,
        name: name?.trim() || existing.name,
        content: nextContent,
        fieldValues: nextFieldValues,
        version: nextVersion,
      });
      await this.documentsRepository.insertDocumentVersion(manager, {
        documentId: id,
        version: nextVersion,
        content: nextContent,
        fieldValues: nextFieldValues,
        action: "update",
        createdBy: created_by,
      });
      return row;
    });
    return updated;
  }

  private async getMissingRequiredFields(document: {
    template_id: string | null;
    field_values: Record<string, string | number | boolean | null>;
  }): Promise<string[]> {
    const fields = await this.getFieldDefinitions(document);
    return getMissingRequiredFields(fields, document.field_values ?? {});
  }

  async enqueuePdfGeneration(id: string, actor = "system") {
    await this.ensureQueueRecovery();
    const document = await this.findOneOrThrow(id);
    const missing = await this.getMissingRequiredFields(document);
    if (missing.length > 0) {
      throw makeError(
        `Campi obbligatori non compilati: ${missing.join(", ")}`,
        422,
      );
    }
    const job = await this.documentsRepository.insertPdfJob(id, actor);
    enqueuePdfJob(async () => this.processPdfJob(job.id));
    return job;
  }

  async processPdfJob(jobId: string): Promise<void> {
    const job = await this.documentsRepository.findPdfJobById(jobId);
    if (!job || job.status !== "queued") return;
    await this.documentsRepository.updatePdfJobRunning(jobId);
    try {
      const document = await this.findOneOrThrow(job.document_id);
      const fields = await this.getFieldDefinitions(document);
      const options: PdfGenerateOptions = {
        title: document.name,
        strict: true,
        fields,
      };
      const { filename, unresolvedFields } = await generatePdf(
        document.content,
        document.field_values ?? {},
        options,
      );
      await this.documentsRepository.updatePdfJobCompleted(
        jobId,
        filename,
        unresolvedFields,
      );
      await this.documentsRepository.updateDocumentStatusGenerated(document.id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Errore generazione PDF";
      await this.documentsRepository.updatePdfJobFailed(jobId, message);
    }
  }

  async getPdfJob(documentId: string, jobId: string) {
    return this.documentsRepository.findPdfJob(documentId, jobId);
  }

  async getPdfJobs(documentId: string) {
    return this.documentsRepository.findPdfJobsByDocument(documentId);
  }

  async getCompletedPdfJob(documentId: string, jobId: string) {
    const job = await this.getPdfJob(documentId, jobId);
    if (!job) throw makeError("Job PDF non trovato", 404);
    if (job.status !== "completed" || !job.filename)
      throw makeError("PDF non ancora disponibile", 409);
    return job;
  }

  async getLatestCompletedPdfJob(documentId: string) {
    const job =
      await this.documentsRepository.findLatestCompletedPdfJob(documentId);
    if (!job)
      throw makeError("Nessun PDF completato per questo documento", 404);
    return job;
  }

  async previewPdf(id: string) {
    const document = await this.findOneOrThrow(id);
    const fields = await this.getFieldDefinitions(document);
    const { filename } = await generatePdf(
      document.content,
      document.field_values ?? {},
      { title: document.name, strict: false, fields },
    );
    return { filename };
  }

  async restore(id: string, targetVersion: number, actor = "system") {
    const existing = await this.findOneOrThrow(id);
    const versionRow = await this.documentsRepository.findVersionById(
      id,
      targetVersion,
    );
    if (!versionRow)
      throw makeError(`Versione ${targetVersion} non trovata`, 404);
    const nextVersion = (await this.documentsRepository.getMaxVersion(id)) + 1;
    const updated = await this.dataSource.transaction(async (manager) => {
      const row = await this.documentsRepository.updateDocument(manager, {
        id,
        name: existing.name,
        content: versionRow.content,
        fieldValues: versionRow.field_values,
        version: nextVersion,
      });
      await this.documentsRepository.insertDocumentVersion(manager, {
        documentId: id,
        version: nextVersion,
        content: versionRow.content,
        fieldValues: versionRow.field_values,
        action: `restore_from_v${targetVersion}`,
        createdBy: actor,
      });
      return row;
    });
    return updated;
  }

  async getVersions(id: string) {
    await this.findOneOrThrow(id);
    return this.documentsRepository.findVersions(id);
  }

  async getVersionContent(id: string, version: number) {
    await this.findOneOrThrow(id);
    return this.documentsRepository.findVersionById(id, version);
  }

  async delete(id: string, actor = "system") {
    await this.findOneOrThrow(id);
    await this.documentsRepository.deleteDocument(id);
    return { deleted: true };
  }
}
