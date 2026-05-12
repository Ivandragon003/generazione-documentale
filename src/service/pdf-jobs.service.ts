import type { Readable } from "node:stream";
import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import type { Response } from "express";
import { makeError } from "../common/utils/errors";
import { appConfig } from "../config/app.config";
import { PdfJobsRepository } from "../repository/pdf-jobs.repository";
import { DocumentRenderingService } from "./document-rendering.service";
import { PdfGenerationService } from "./pdf-generation.service";
import { TemplatesService } from "./templates.service";

const QUEUE_RECOVERY_RETRY_MS = appConfig.pdfQueueRecoveryRetryMs;

function pipeToResponse(readable: Readable, response: Response): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    readable.on("error", reject);
    response.on("error", reject);
    response.on("finish", resolve);
    readable.pipe(response as unknown as NodeJS.WritableStream);
  });
}

@Injectable()
export class PdfJobsService implements OnModuleDestroy {
  private queueRecoveryStarted = false;
  private queueRecoveryTimer: NodeJS.Timeout | null = null;
  private processorRunning = false;

  constructor(
    @Inject(PdfJobsRepository)
    private readonly pdfJobsRepository: PdfJobsRepository,
    @Inject(TemplatesService)
    private readonly templatesService: TemplatesService,
    @Inject(PdfGenerationService)
    private readonly pdfGenerationService: PdfGenerationService,
    @Inject(DocumentRenderingService)
    private readonly documentRenderingService: DocumentRenderingService,
  ) {
    setImmediate(() => {
      this.ensureQueueRecovery().catch(() => undefined);
    });
  }

  onModuleDestroy(): void {
    if (this.queueRecoveryTimer) {
      clearTimeout(this.queueRecoveryTimer);
      this.queueRecoveryTimer = null;
    }
  }

  private async ensureQueueRecovery(): Promise<void> {
    if (this.queueRecoveryStarted) return;
    this.queueRecoveryStarted = true;
    try {
      await this.triggerQueueProcessor();
    } catch (_error) {
      this.queueRecoveryStarted = false;
      if (!this.queueRecoveryTimer) {
        this.queueRecoveryTimer = setTimeout(() => {
          this.queueRecoveryTimer = null;
          this.ensureQueueRecovery().catch(() => undefined);
        }, QUEUE_RECOVERY_RETRY_MS);
      }
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
    fieldValues: Record<string, string | number | boolean | null>,
    actor = "system",
  ) {
    await this.ensureQueueRecovery();

    const template = await this.templatesService.findOne(templateId);
    if (!template) throw makeError("Template non trovato", 404);

    const missing = this.documentRenderingService.getMissingRequiredFields(
      template.fields ?? [],
      fieldValues,
    );
    if (missing.length > 0) {
      throw makeError(
        `Campi obbligatori non compilati: ${missing.join(", ")}`,
        422,
      );
    }

    const job = await this.pdfJobsRepository.insert(
      templateId,
      fieldValues,
      actor,
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
      if (!template) throw new Error("Template non trovato");

      const { filename, unresolvedFields } =
        await this.pdfGenerationService.generatePdf({
          title: template.name,
          content: template.content,
          fieldValues: job.field_values ?? {},
          strict: true,
        });

      await this.pdfJobsRepository.markCompleted(
        jobId,
        filename,
        unresolvedFields ?? [],
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Errore generazione PDF";
      await this.pdfJobsRepository.markFailed(jobId, message);
    }
  }

  async getJob(templateId: string, jobId: string) {
    const job = await this.pdfJobsRepository.findById(jobId);
    if (!job || job.template_id !== templateId)
      throw makeError("Job PDF non trovato", 404);
    return job;
  }

  async getJobs(templateId: string) {
    return this.pdfJobsRepository.findByTemplate(templateId);
  }

  private async getCompletedJob(templateId: string, jobId: string) {
    const job = await this.getJob(templateId, jobId);
    if (job.status !== "completed" || !job.filename)
      throw makeError("PDF non ancora disponibile", 409);
    return job;
  }

  async getLatestCompleted(templateId: string) {
    const job = await this.pdfJobsRepository.findLatestCompleted(templateId);
    if (!job) throw makeError("Nessun PDF completato per questo template", 404);
    return job;
  }

  async streamDownload(
    templateId: string,
    jobId: string,
    response: Response,
  ): Promise<void> {
    const job = await this.getCompletedJob(templateId, jobId);
    const stream = await this.pdfGenerationService.getPdfStream(job.filename!);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${job.filename}"`,
    );
    await pipeToResponse(stream, response);
  }

  async streamLatest(templateId: string, response: Response): Promise<void> {
    const job = await this.getLatestCompleted(templateId);
    const stream = await this.pdfGenerationService.getPdfStream(job.filename!);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${job.filename}"`,
    );
    await pipeToResponse(stream, response);
  }
}
