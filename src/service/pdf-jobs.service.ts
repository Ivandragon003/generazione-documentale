import type { Readable } from "node:stream";
import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import type { Response } from "express";
import { makeError } from "../common/utils/errors";
import { appConfig } from "../config/app.config";
import { DocumentsRepository } from "../repository/documents.repository";
import { DocumentEventsService } from "./document-events.service";
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
    @Inject(DocumentsRepository)
    private readonly documentsRepository: DocumentsRepository,
    @Inject(TemplatesService)
    private readonly templatesService: TemplatesService,
    @Inject(PdfGenerationService)
    private readonly pdfGenerationService: PdfGenerationService,
    @Inject(DocumentRenderingService)
    private readonly documentRenderingService: DocumentRenderingService,
    @Inject(DocumentEventsService)
    private readonly documentEventsService: DocumentEventsService,
  ) {
    this.documentEventsService.onDocumentFinalized(({ jobId }) => {
      this.processPdfJob(jobId).catch(() => undefined);
    });

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

  private async findDocumentOrThrow(id: string) {
    const document = await this.documentsRepository.findById(id);
    if (!document) throw makeError("Documento non trovato", 404);
    return document;
  }

  private async getFieldDefinitions(document: { template_id: string | null }) {
    if (!document.template_id) return [];
    const template = await this.templatesService.findOne(document.template_id);
    return template?.fields ?? [];
  }

  private async getMissingRequiredFields(document: {
    template_id: string | null;
    field_values: Record<string, string | number | boolean | null>;
  }): Promise<string[]> {
    const fields = await this.getFieldDefinitions(document);
    return this.documentRenderingService.getMissingRequiredFields(
      fields,
      document.field_values ?? {},
    );
  }

  private async ensureQueueRecovery(): Promise<void> {
    if (this.queueRecoveryStarted) return;
    this.queueRecoveryStarted = true;
    try {
      await this.triggerQueueProcessor();
    } catch {
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
      const queuedJobs = await this.documentsRepository.findQueuedPdfJobs();
      for (const job of queuedJobs) {
        await this.processPdfJob(job.id).catch(() => undefined);
      }
    } finally {
      this.processorRunning = false;
    }
  }

  async enqueuePdfGeneration(id: string, actor = "system") {
    await this.ensureQueueRecovery();
    const document = await this.findDocumentOrThrow(id);
    const missing = await this.getMissingRequiredFields(document);
    if (missing.length > 0) {
      throw makeError(
        `Campi obbligatori non compilati: ${missing.join(", ")}`,
        422,
      );
    }
    const job = await this.documentsRepository.insertPdfJob(id, actor);
    this.documentEventsService.emitDocumentFinalized({ jobId: job.id });
    this.triggerQueueProcessor().catch(() => undefined);
    return job;
  }

  async processPdfJob(jobId: string): Promise<void> {
    const claimed = await this.documentsRepository.claimQueuedPdfJob(jobId);
    if (!claimed) return;

    const job = await this.documentsRepository.findPdfJobById(jobId);
    if (!job || job.status !== "running") return;

    try {
      const document = await this.findDocumentOrThrow(job.document_id);
      const { filename, unresolvedFields } =
        await this.pdfGenerationService.generatePdf({
          title: document.name,
          content: document.content,
          fieldValues: document.field_values ?? {},
          strict: true,
        });
      await this.documentsRepository.updatePdfJobCompleted(
        jobId,
        filename,
        unresolvedFields ?? [],
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

  async streamPdfJobDownload(
    documentId: string,
    jobId: string,
    response: Response,
  ): Promise<void> {
    const job = await this.getCompletedPdfJob(documentId, jobId);
    if (!job.filename) throw makeError("PDF non ancora disponibile", 409);
    const stream = await this.pdfGenerationService.getPdfStream(job.filename);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${job.filename}"`,
    );
    await pipeToResponse(stream, response);
  }

  async streamLatestPdfDownload(
    documentId: string,
    response: Response,
  ): Promise<void> {
    const job = await this.getLatestCompletedPdfJob(documentId);
    if (!job.filename) throw makeError("PDF non ancora disponibile", 409);
    const stream = await this.pdfGenerationService.getPdfStream(job.filename);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${job.filename}"`,
    );
    await pipeToResponse(stream, response);
  }

  async deleteGeneratedPdf(documentId: string, jobId: string): Promise<void> {
    const job = await this.getCompletedPdfJob(documentId, jobId);
    if (!job.filename) throw makeError("PDF non ancora disponibile", 409);
    await this.pdfGenerationService.deletePdf(job.filename);
  }

  async deleteGeneratedPdfsForDocument(documentId: string): Promise<void> {
    const jobs =
      await this.documentsRepository.findPdfJobsByDocument(documentId);
    const filenames = Array.from(
      new Set(
        jobs
          .map((job) => job.filename)
          .filter((filename): filename is string => Boolean(filename)),
      ),
    );
    await Promise.all(
      filenames.map((filename) =>
        this.pdfGenerationService.deletePdf(filename),
      ),
    );
  }
}
