import type { Readable } from "node:stream";
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
} from "@nestjs/common";
import type { Response } from "express";
import { makeError } from "../common/utils/errors";
import { validateMarkdownContent } from "../common/utils/markdown.utils";
import { sha256Signature } from "../common/utils/signature.utils";
import { appConfig } from "../config/app.config";
import { PdfJobsRepository } from "../repository/pdf-jobs.repository";
import { AuditLogsService } from "./audit-logs.service";
import type { FieldValueMap } from "./document-rendering.service";
import { PdfGenerationService } from "./pdf-generation.service";
import { TemplatesService } from "./templates.service";

const QUEUE_RECOVERY_RETRY_MS = appConfig.pdfQueueRecoveryRetryMs;
const PDF_JOBS_RETENTION_DAYS = appConfig.pdfJobsRetentionDays;
const PDF_FAILED_JOBS_RETENTION_DAYS = appConfig.pdfFailedJobsRetentionDays;
const PDF_RETENTION_RUN_EVERY_MS = appConfig.pdfRetentionRunEveryMs;
const MAX_TEMPLATE_CONTENT_BYTES = appConfig.maxTemplateContentBytes;
const DOWNLOAD_NAME_SANITIZE_REGEX = /[<>:"/\\|?*]/g;

function pipeToResponse(readable: Readable, response: Response): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    readable.on("error", reject);
    response.on("error", reject);
    response.on("finish", resolve);
    readable.pipe(response);
  });
}

@Injectable()
export class PdfJobsService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfJobsService.name);
  private queueRecoveryStarted = false;
  private queueRecoveryTimer: NodeJS.Timeout | null = null;
  private retentionTimer: NodeJS.Timeout | null = null;
  private retentionRunning = false;
  private processorRunning = false;

  constructor(
    @Inject(PdfJobsRepository)
    private readonly pdfJobsRepository: PdfJobsRepository,
    @Inject(TemplatesService)
    private readonly templatesService: TemplatesService,
    @Inject(PdfGenerationService)
    private readonly pdfGenerationService: PdfGenerationService,
    @Inject(AuditLogsService)
    private readonly auditLogsService: AuditLogsService,
  ) {
    setImmediate(() => {
      this.ensureQueueRecovery().catch(() => undefined);
    });
    this.scheduleRetention();
  }

  onModuleDestroy(): void {
    if (this.queueRecoveryTimer) {
      clearTimeout(this.queueRecoveryTimer);
      this.queueRecoveryTimer = null;
    }
    if (this.retentionTimer) {
      clearTimeout(this.retentionTimer);
      this.retentionTimer = null;
    }
  }

  private scheduleRetention(): void {
    if (this.retentionTimer) return;
    this.retentionTimer = setTimeout(() => {
      this.retentionTimer = null;
      this.runRetention().catch(() => undefined);
    }, PDF_RETENTION_RUN_EVERY_MS);
  }

  private async runRetention(): Promise<void> {
    if (this.retentionRunning) return;
    this.retentionRunning = true;
    try {
      const now = Date.now();
      const completedCutoff = new Date(
        now - PDF_JOBS_RETENTION_DAYS * 24 * 60 * 60 * 1000,
      );
      const failedCutoff = new Date(
        now - PDF_FAILED_JOBS_RETENTION_DAYS * 24 * 60 * 60 * 1000,
      );

      const completed =
        await this.pdfJobsRepository.findCompletedBefore(completedCutoff);
      for (const job of completed) {
        if (job.filename) {
          await this.pdfGenerationService.deletePdf(job.filename);
        }
      }
      const completedDeleted = await this.pdfJobsRepository.deleteByIds(
        completed.map((job) => job.id),
      );

      const failed =
        await this.pdfJobsRepository.findFailedBefore(failedCutoff);
      const failedDeleted = await this.pdfJobsRepository.deleteByIds(
        failed.map((job) => job.id),
      );

      if (completedDeleted > 0 || failedDeleted > 0) {
        this.logger.log(
          `PDF retention deleted jobs: completed=${completedDeleted}, failed=${failedDeleted}`,
        );
      }
    } finally {
      this.retentionRunning = false;
      this.scheduleRetention();
    }
  }

  private async ensureQueueRecovery(): Promise<void> {
    if (this.queueRecoveryStarted) return;
    this.queueRecoveryStarted = true;
    try {
      await this.triggerQueueProcessor();
    } catch (error) {
      this.queueRecoveryStarted = false;
      this.logger.warn(
        `Queue recovery failed, retry scheduled in ${QUEUE_RECOVERY_RETRY_MS}ms: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      this.queueRecoveryTimer ??= setTimeout(() => {
        this.queueRecoveryTimer = null;
        this.ensureQueueRecovery().catch(() => undefined);
      }, QUEUE_RECOVERY_RETRY_MS);
    }
  }

  private async triggerQueueProcessor(): Promise<void> {
    if (this.processorRunning) return;
    this.processorRunning = true;
    try {
      const queuedJobs = await this.pdfJobsRepository.findQueued();
      if (queuedJobs.length > 0) {
        this.logger.log(`Processing queued PDF jobs: ${queuedJobs.length}`);
      }
      for (const job of queuedJobs) {
        try {
          await this.processJob(job.id);
        } catch (error) {
          this.logger.error(
            `Unexpected job processor error for ${job.id}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    } finally {
      this.processorRunning = false;
    }
  }

  async enqueue(
    templateId: string,
    fieldValues: FieldValueMap,
    actor = "system",
    language?: string,
  ) {
    await this.ensureQueueRecovery();

    const persistedTemplateId =
      await this.templatesService.resolveTemplateIdForPdfJob(templateId, true);
    if (!persistedTemplateId) throw makeError("Template not found", 404);

    const template = await this.templatesService.findOne(persistedTemplateId);
    if (!template) throw makeError("Template not found", 404);

    const templateContentHash = sha256Signature(template.content);
    const normalizedLanguage = language?.trim() || null;
    const fieldValuesHash = sha256Signature(fieldValues ?? {});
    const job = await this.pdfJobsRepository.insert(
      persistedTemplateId,
      fieldValues,
      actor,
      templateContentHash,
      fieldValuesHash,
      normalizedLanguage,
    );
    const tenantUuid =
      this.extractTenantUuidFromTemplateId(persistedTemplateId);
    if (tenantUuid) {
      await this.auditLogsService.recordSafe({
        tenantUuid,
        eventType: "pdf.job.queued",
        actor,
        templateId: persistedTemplateId,
        payload: { jobId: job.id, language: normalizedLanguage },
      });
    }
    this.triggerQueueProcessor().catch(() => undefined);
    return job;
  }

  private extractTenantUuidFromTemplateId(templateId: string): string | null {
    const scopedId = templateId.startsWith("github:")
      ? templateId.slice("github:".length)
      : templateId;
    const [tenantUuid] = scopedId.split("/");
    return tenantUuid?.trim() || null;
  }

  async processJob(jobId: string): Promise<void> {
    const startedAtMs = Date.now();
    const claimed = await this.pdfJobsRepository.claim(jobId);
    if (!claimed) return;

    const job = await this.pdfJobsRepository.findById(jobId);
    if (job?.status !== "running") return;
    const tenantUuid = this.extractTenantUuidFromTemplateId(job.template_id);
    if (tenantUuid) {
      await this.auditLogsService.recordSafe({
        tenantUuid,
        eventType: "pdf.job.started",
        actor: job.requested_by,
        templateId: job.template_id,
        payload: { jobId },
      });
    }

    try {
      const template = await this.templatesService.findOne(job.template_id);
      if (!template) throw new Error("Template not found");

      if (!template.content?.trim()) {
        throw new Error(
          "Template content is unavailable. Verify that the Markdown file exists on GitHub.",
        );
      }
      const validation = validateMarkdownContent(
        template.content,
        MAX_TEMPLATE_CONTENT_BYTES,
      );
      if (!validation.valid) {
        throw new Error(
          `Template validation failed before PDF rendering: ${validation.errors.join("; ")}`,
        );
      }

      const templateContentHash = sha256Signature(template.content);
      const { filename, unresolvedFields, renderedContentHash } =
        await this.pdfGenerationService.generatePdf({
          title: template.name,
          content: template.content,
          fieldValues: job.field_values ?? {},
          strict: false,
          language: job.language ?? undefined,
        });

      await this.pdfJobsRepository.markCompleted(
        jobId,
        filename,
        unresolvedFields ?? [],
        templateContentHash,
        renderedContentHash,
      );
      if (tenantUuid) {
        await this.auditLogsService.recordSafe({
          tenantUuid,
          eventType: "pdf.job.completed",
          actor: job.requested_by,
          templateId: job.template_id,
          payload: {
            jobId,
            durationMs: Date.now() - startedAtMs,
            unresolvedFields: unresolvedFields ?? [],
          },
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "PDF generation error";
      await this.pdfJobsRepository.markFailed(jobId, message);
      this.logger.warn(`PDF job ${jobId} failed: ${message}`);
      if (tenantUuid) {
        await this.auditLogsService.recordSafe({
          tenantUuid,
          eventType: "pdf.job.failed",
          actor: job.requested_by,
          templateId: job.template_id,
          payload: { jobId, durationMs: Date.now() - startedAtMs, message },
        });
      }
    }
  }

  async getJob(templateId: string, jobId: string) {
    const persistedTemplateId =
      await this.templatesService.resolveTemplateIdForPdfJob(templateId);
    if (!persistedTemplateId) throw makeError("PDF job not found", 404);

    const job = await this.pdfJobsRepository.findById(jobId);
    if (job?.template_id !== persistedTemplateId) {
      throw makeError("PDF job not found", 404);
    }
    return job;
  }

  async getJobs(templateId: string) {
    const persistedTemplateId =
      await this.templatesService.resolveTemplateIdForPdfJob(templateId);
    if (!persistedTemplateId) return [];
    return this.pdfJobsRepository.findByTemplate(persistedTemplateId);
  }

  private async getCompletedJob(templateId: string, jobId: string) {
    const job = await this.getJob(templateId, jobId);
    if (job.status === "failed") {
      throw makeError(job.error_message || "PDF generation failed", 422);
    }
    if (job.status !== "completed" || !job.filename) {
      throw makeError("PDF not available yet", 409);
    }
    return job;
  }

  private requirePdfFilename(job: { filename: string | null }): string {
    if (!job.filename) throw makeError("PDF not available yet", 409);
    return job.filename;
  }

  private async recordPdfDownload(job: {
    id: string;
    template_id: string;
    filename: string | null;
    requested_by: string;
    template_content_hash: string | null;
    field_values_hash: string | null;
    rendered_content_hash: string | null;
  }): Promise<void> {
    const tenantUuid = this.extractTenantUuidFromTemplateId(job.template_id);
    if (!tenantUuid) return;
    await this.auditLogsService.recordSafe({
      tenantUuid,
      eventType: "pdf.job.downloaded",
      actor: job.requested_by,
      templateId: job.template_id,
      payload: {
        jobId: job.id,
        filename: job.filename,
        templateContentHash: job.template_content_hash,
        fieldValuesHash: job.field_values_hash,
        renderedContentHash: job.rendered_content_hash,
      },
    });
  }

  private buildDownloadFilename(baseName: string, extension: "pdf"): string {
    const withoutControlChars = Array.from(baseName || "document")
      .map((char) => (char.charCodeAt(0) <= 0x1f ? "-" : char))
      .join("");
    const normalized = withoutControlChars
      .trim()
      .replace(DOWNLOAD_NAME_SANITIZE_REGEX, "-")
      .replace(/\s+/g, " ")
      .replace(/\.+$/, "");
    const safe = normalized.length > 0 ? normalized : "document";
    return `${safe}.${extension}`;
  }

  async getLatestCompleted(
    templateId: string,
    fieldValues: FieldValueMap,
    language?: string,
  ) {
    const persistedTemplateId =
      await this.templatesService.resolveTemplateIdForPdfJob(templateId);
    if (!persistedTemplateId) {
      throw makeError("No completed PDF found for this template", 404);
    }

    const template = await this.templatesService.findOne(persistedTemplateId);
    if (!template) throw makeError("Template not found", 404);

    const job = await this.pdfJobsRepository.findLatestCompleted(
      persistedTemplateId,
      sha256Signature(template.content),
      sha256Signature(fieldValues ?? {}),
      language === undefined ? undefined : language.trim() || null,
    );
    if (!job) {
      throw makeError(
        "PDF not generated yet for this template version and these fields",
        404,
      );
    }
    if (!job.filename) throw makeError("PDF not available yet", 409);
    return job;
  }

  async streamDownload(
    templateId: string,
    jobId: string,
    response: Response,
  ): Promise<void> {
    const job = await this.getCompletedJob(templateId, jobId);
    const template = await this.templatesService.findOne(job.template_id);
    const downloadName = this.buildDownloadFilename(
      template?.name ?? "document",
      "pdf",
    );
    const stream = await this.pdfGenerationService.getPdfStream(
      this.requirePdfFilename(job),
    );
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${downloadName}"`,
    );
    await pipeToResponse(stream, response);
    await this.recordPdfDownload(job);
  }

  async streamLatest(
    templateId: string,
    response: Response,
    fieldValues: FieldValueMap,
    language?: string,
  ): Promise<void> {
    const job = await this.getLatestCompleted(
      templateId,
      fieldValues,
      language,
    );
    const template = await this.templatesService.findOne(job.template_id);
    const downloadName = this.buildDownloadFilename(
      template?.name ?? "document",
      "pdf",
    );
    const stream = await this.pdfGenerationService.getPdfStream(
      this.requirePdfFilename(job),
    );
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${downloadName}"`,
    );
    await pipeToResponse(stream, response);
  }
}
