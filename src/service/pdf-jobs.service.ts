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
import type { FieldValueMap } from "./document-rendering.service";
import { PdfGenerationService } from "./pdf-generation.service";
import { TemplatesService } from "./templates.service";

const QUEUE_RECOVERY_RETRY_MS = appConfig.pdfQueueRecoveryRetryMs;
const PDF_JOBS_RETENTION_DAYS = appConfig.pdfJobsRetentionDays;
const PDF_FAILED_JOBS_RETENTION_DAYS = appConfig.pdfFailedJobsRetentionDays;
const PDF_RETENTION_RUN_EVERY_MS = appConfig.pdfRetentionRunEveryMs;
const MAX_TEMPLATE_CONTENT_BYTES = appConfig.maxTemplateContentBytes;

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
      for (const job of queuedJobs) {
        await this.processJob(job.id).catch(() => undefined);
      }
    } finally {
      this.processorRunning = false;
    }
  }

  async enqueue(
    templateId: string,
    fieldValues: FieldValueMap,
    actor = "system",
  ) {
    await this.ensureQueueRecovery();

    const persistedTemplateId =
      await this.templatesService.resolveTemplateIdForPdfJob(
        templateId,
        actor,
        true,
      );
    if (!persistedTemplateId) throw makeError("Template not found", 404);

    const template = await this.templatesService.findOne(persistedTemplateId);
    if (!template) throw makeError("Template not found", 404);

    const templateContentHash = sha256Signature(template.content);
    const fieldValuesHash = sha256Signature(fieldValues ?? {});
    const job = await this.pdfJobsRepository.insert(
      persistedTemplateId,
      fieldValues,
      actor,
      templateContentHash,
      fieldValuesHash,
    );
    this.triggerQueueProcessor().catch(() => undefined);
    return job;
  }

  async processJob(jobId: string): Promise<void> {
    const claimed = await this.pdfJobsRepository.claim(jobId);
    if (!claimed) return;

    const job = await this.pdfJobsRepository.findById(jobId);
    if (!job || job.status !== "running") return;

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
        });

      await this.pdfJobsRepository.markCompleted(
        jobId,
        filename,
        unresolvedFields ?? [],
        templateContentHash,
        renderedContentHash,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "PDF generation error";
      await this.pdfJobsRepository.markFailed(jobId, message);
    }
  }

  async getJob(templateId: string, jobId: string) {
    const persistedTemplateId =
      await this.templatesService.resolveTemplateIdForPdfJob(templateId);
    if (!persistedTemplateId) throw makeError("PDF job not found", 404);

    const job = await this.pdfJobsRepository.findById(jobId);
    if (!job || job.template_id !== persistedTemplateId) {
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

  async getLatestCompleted(templateId: string, fieldValues: FieldValueMap) {
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
    const stream = await this.pdfGenerationService.getPdfStream(
      this.requirePdfFilename(job),
    );
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${job.filename}"`,
    );
    await pipeToResponse(stream, response);
  }

  async streamLatest(
    templateId: string,
    response: Response,
    fieldValues: FieldValueMap,
  ): Promise<void> {
    const job = await this.getLatestCompleted(templateId, fieldValues);
    const stream = await this.pdfGenerationService.getPdfStream(
      this.requirePdfFilename(job),
    );
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${job.filename}"`,
    );
    await pipeToResponse(stream, response);
  }
}
