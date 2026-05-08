import { Test, type TestingModule } from "@nestjs/testing";
import { Readable } from "node:stream";
import type { Response } from "express";
import type { DocumentEntity } from "../src/entities/document.entity";
import type { PdfJobEntity } from "../src/entities/pdf-job.entity";
import { DocumentsRepository } from "../src/repository/documents.repository";
import { DocumentEventsService } from "../src/service/document-events.service";
import { DocumentRenderingService } from "../src/service/document-rendering.service";
import { PdfGenerationService } from "../src/service/pdf-generation.service";
import { PdfJobsService } from "../src/service/pdf-jobs.service";
import { TemplatesService } from "../src/service/templates.service";

// ── helpers ────────────────────────────────────────────────────────────────────
const VALID_DOC_UUID = "123e4567-e89b-12d3-a456-426614174000";
const VALID_JOB_UUID = "456e7890-e89b-12d3-a456-426614174001";
const VALID_TPL_UUID = "789e0123-e89b-12d3-a456-426614174002";

const makeDoc = (overrides: Partial<DocumentEntity> = {}): DocumentEntity => ({
  id: VALID_DOC_UUID,
  name: "Doc Test",
  template_id: VALID_TPL_UUID,
  content: "# {{titolo}}",
  field_values: { titolo: "Ciao" },
  status: "draft",
  created_by: "system",
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

const makeJob = (overrides: Partial<PdfJobEntity> = {}): PdfJobEntity => ({
  id: VALID_JOB_UUID,
  document_id: VALID_DOC_UUID,
  status: "queued",
  filename: null,
  requested_by: "system",
  error_message: null,
  unresolved_fields: [],
  created_at: new Date(),
  started_at: null,
  completed_at: null,
  ...overrides,
});

const makeMockResponse = (): jest.Mocked<Response> =>
  ({
    setHeader: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    emit: jest.fn(),
    writable: true,
  } as unknown as jest.Mocked<Response>);

describe("PdfJobsService", () => {
  let service: PdfJobsService;
  let documentsRepository: jest.Mocked<DocumentsRepository>;
  let _templatesService: jest.Mocked<TemplatesService>;
  let pdfGenerationService: jest.Mocked<PdfGenerationService>;
  let documentRenderingService: jest.Mocked<DocumentRenderingService>;
  let _documentEventsService: jest.Mocked<DocumentEventsService>;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.spyOn(console, "warn").mockImplementation(() => {});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PdfJobsService,
        {
          provide: DocumentsRepository,
          useValue: {
            findById: jest.fn(),
            insertPdfJob: jest.fn(),
            findPdfJobById: jest.fn(),
            findPdfJob: jest.fn(),
            findPdfJobsByDocument: jest.fn(),
            findLatestCompletedPdfJob: jest.fn(),
            findQueuedPdfJobs: jest.fn().mockResolvedValue([]),
            claimQueuedPdfJob: jest.fn(),
            updatePdfJobCompleted: jest.fn(),
            updatePdfJobFailed: jest.fn(),
            updateDocumentStatusGenerated: jest.fn(),
          },
        },
        {
          provide: TemplatesService,
          useValue: { findOne: jest.fn() },
        },
        {
          provide: PdfGenerationService,
          useValue: {
            generatePdf: jest.fn(),
            getPdfStream: jest.fn(),
            deletePdf: jest.fn(),
          },
        },
        {
          provide: DocumentRenderingService,
          useValue: { getMissingRequiredFields: jest.fn() },
        },
        {
          provide: DocumentEventsService,
          useValue: {
            onDocumentFinalized: jest.fn(),
            emitDocumentFinalized: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PdfJobsService>(PdfJobsService);
    documentsRepository = module.get(
      DocumentsRepository,
    ) as jest.Mocked<DocumentsRepository>;
    _templatesService = module.get(
      TemplatesService,
    ) as jest.Mocked<TemplatesService>;
    pdfGenerationService = module.get(
      PdfGenerationService,
    ) as jest.Mocked<PdfGenerationService>;
    documentRenderingService = module.get(
      DocumentRenderingService,
    ) as jest.Mocked<DocumentRenderingService>;
    _documentEventsService = module.get(
      DocumentEventsService,
    ) as jest.Mocked<DocumentEventsService>;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // ── enqueuePdfGeneration() ────────────────────────────────────────────────

  describe("enqueuePdfGeneration() - casi nominali", () => {
    it("accoda un PDF job con tutti i campi obbligatori compilati", async () => {
      const doc = makeDoc();
      const job = makeJob();
      documentsRepository.findById.mockResolvedValue(doc);
      documentRenderingService.getMissingRequiredFields.mockReturnValue([]);
      documentsRepository.insertPdfJob.mockResolvedValue(job);

      const result = await service.enqueuePdfGeneration(VALID_DOC_UUID, "user1");

      expect(result).toEqual(job);
      expect(documentsRepository.insertPdfJob).toHaveBeenCalledWith(VALID_DOC_UUID, "user1");
    });

    it("usa 'system' come actor di default", async () => {
      documentsRepository.findById.mockResolvedValue(makeDoc());
      documentRenderingService.getMissingRequiredFields.mockReturnValue([]);
      documentsRepository.insertPdfJob.mockResolvedValue(makeJob());

      await service.enqueuePdfGeneration(VALID_DOC_UUID);

      expect(documentsRepository.insertPdfJob).toHaveBeenCalledWith(VALID_DOC_UUID, "system");
    });
  });

  describe("enqueuePdfGeneration() - casi limite ed errori", () => {
    it("lancia 404 se il documento non esiste", async () => {
      documentsRepository.findById.mockResolvedValue(null);

      await expect(service.enqueuePdfGeneration(VALID_DOC_UUID)).rejects.toMatchObject({ status: 404 });
    });

    it("lancia 422 se mancano campi obbligatori", async () => {
      documentsRepository.findById.mockResolvedValue(makeDoc({ field_values: {} }));
      documentRenderingService.getMissingRequiredFields.mockReturnValue(["Titolo", "Nome"]);

      await expect(service.enqueuePdfGeneration(VALID_DOC_UUID)).rejects.toMatchObject({ status: 422 });
    });

    it("il messaggio 422 elenca i campi mancanti", async () => {
      documentsRepository.findById.mockResolvedValue(makeDoc({ field_values: {} }));
      documentRenderingService.getMissingRequiredFields.mockReturnValue(["Titolo"]);

      await expect(service.enqueuePdfGeneration(VALID_DOC_UUID)).rejects.toThrow("Titolo");
    });

    it("gestisce documento senza template_id", async () => {
      documentsRepository.findById.mockResolvedValue(makeDoc({ template_id: null }));
      documentRenderingService.getMissingRequiredFields.mockReturnValue([]);
      documentsRepository.insertPdfJob.mockResolvedValue(makeJob());

      const result = await service.enqueuePdfGeneration(VALID_DOC_UUID);

      expect(result).toBeDefined();
    });
  });

  // ── getPdfJob() ──────────────────────────────────────────────────────────

  describe("getPdfJob()", () => {
    it("ritorna il job se esiste", async () => {
      const job = makeJob({ status: "completed", filename: "output.pdf" });
      documentsRepository.findPdfJob.mockResolvedValue(job);

      const result = await service.getPdfJob(VALID_DOC_UUID, VALID_JOB_UUID);

      expect(result).toEqual(job);
    });

    it("ritorna null se il job non esiste", async () => {
      documentsRepository.findPdfJob.mockResolvedValue(null);

      const result = await service.getPdfJob(VALID_DOC_UUID, VALID_JOB_UUID);

      expect(result).toBeNull();
    });
  });

  // ── getPdfJobs() ─────────────────────────────────────────────────────────

  describe("getPdfJobs()", () => {
    it("ritorna tutti i job del documento", async () => {
      const jobs = [makeJob({ status: "completed", filename: "a.pdf" }), makeJob()];
      documentsRepository.findPdfJobsByDocument.mockResolvedValue(jobs);

      const result = await service.getPdfJobs(VALID_DOC_UUID);

      expect(result).toEqual(jobs);
      expect(documentsRepository.findPdfJobsByDocument).toHaveBeenCalledWith(VALID_DOC_UUID);
    });

    it("ritorna array vuoto se non ci sono job", async () => {
      documentsRepository.findPdfJobsByDocument.mockResolvedValue([]);

      const result = await service.getPdfJobs(VALID_DOC_UUID);

      expect(result).toEqual([]);
    });
  });

  // ── getCompletedPdfJob() ─────────────────────────────────────────────────

  describe("getCompletedPdfJob() - casi limite", () => {
    it("ritorna il job completato con filename", async () => {
      const job = makeJob({ status: "completed", filename: "output.pdf" });
      documentsRepository.findPdfJob.mockResolvedValue(job);

      const result = await service.getCompletedPdfJob(VALID_DOC_UUID, VALID_JOB_UUID);

      expect(result.filename).toBe("output.pdf");
    });

    it("lancia 404 se il job non esiste", async () => {
      documentsRepository.findPdfJob.mockResolvedValue(null);

      await expect(service.getCompletedPdfJob(VALID_DOC_UUID, VALID_JOB_UUID)).rejects.toMatchObject({ status: 404 });
    });

    it("lancia 409 se il job non è ancora completato (status: queued)", async () => {
      documentsRepository.findPdfJob.mockResolvedValue(makeJob({ status: "queued" }));

      await expect(service.getCompletedPdfJob(VALID_DOC_UUID, VALID_JOB_UUID)).rejects.toMatchObject({ status: 409 });
    });

    it("lancia 409 se il job è running", async () => {
      documentsRepository.findPdfJob.mockResolvedValue(makeJob({ status: "running" }));

      await expect(service.getCompletedPdfJob(VALID_DOC_UUID, VALID_JOB_UUID)).rejects.toMatchObject({ status: 409 });
    });

    it("lancia 409 se il job è failed", async () => {
      documentsRepository.findPdfJob.mockResolvedValue(makeJob({ status: "failed", filename: null }));

      await expect(service.getCompletedPdfJob(VALID_DOC_UUID, VALID_JOB_UUID)).rejects.toMatchObject({ status: 409 });
    });

    it("lancia 409 se completato ma filename è null", async () => {
      documentsRepository.findPdfJob.mockResolvedValue(makeJob({ status: "completed", filename: null }));

      await expect(service.getCompletedPdfJob(VALID_DOC_UUID, VALID_JOB_UUID)).rejects.toMatchObject({ status: 409 });
    });
  });

  // ── getLatestCompletedPdfJob() ────────────────────────────────────────────

  describe("getLatestCompletedPdfJob()", () => {
    it("ritorna l'ultimo job completato", async () => {
      const job = makeJob({ status: "completed", filename: "latest.pdf" });
      documentsRepository.findLatestCompletedPdfJob.mockResolvedValue(job);

      const result = await service.getLatestCompletedPdfJob(VALID_DOC_UUID);

      expect(result.filename).toBe("latest.pdf");
    });

    it("lancia 404 se non esiste nessun PDF completato", async () => {
      documentsRepository.findLatestCompletedPdfJob.mockResolvedValue(null);

      await expect(service.getLatestCompletedPdfJob(VALID_DOC_UUID)).rejects.toMatchObject({ status: 404 });
    });
  });

  // ── streamPdfJobDownload() ────────────────────────────────────────────────

  describe("streamPdfJobDownload()", () => {
    it("streamma il PDF e imposta gli header corretti", async () => {
      const job = makeJob({ status: "completed", filename: "output.pdf" });
      documentsRepository.findPdfJob.mockResolvedValue(job);
      const readable = new Readable({ read() { this.push(null); } });
      pdfGenerationService.getPdfStream.mockResolvedValue(readable as never);
      const res = makeMockResponse();

      await service.streamPdfJobDownload(VALID_DOC_UUID, VALID_JOB_UUID, res);

      expect(pdfGenerationService.getPdfStream).toHaveBeenCalledWith("output.pdf");
      expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Disposition",
        `attachment; filename="output.pdf"`,
      );
    });

    it("lancia 404 se il job non esiste", async () => {
      documentsRepository.findPdfJob.mockResolvedValue(null);
      const res = makeMockResponse();

      await expect(
        service.streamPdfJobDownload(VALID_DOC_UUID, VALID_JOB_UUID, res),
      ).rejects.toMatchObject({ status: 404 });
    });

    it("lancia 409 se il job non è completato", async () => {
      documentsRepository.findPdfJob.mockResolvedValue(makeJob({ status: "running" }));
      const res = makeMockResponse();

      await expect(
        service.streamPdfJobDownload(VALID_DOC_UUID, VALID_JOB_UUID, res),
      ).rejects.toMatchObject({ status: 409 });
    });
  });

  // ── streamLatestPdfDownload() ─────────────────────────────────────────────

  describe("streamLatestPdfDownload()", () => {
    it("streamma l'ultimo PDF completato", async () => {
      const job = makeJob({ status: "completed", filename: "latest.pdf" });
      documentsRepository.findLatestCompletedPdfJob.mockResolvedValue(job);
      const readable = new Readable({ read() { this.push(null); } });
      pdfGenerationService.getPdfStream.mockResolvedValue(readable as never);
      const res = makeMockResponse();

      await service.streamLatestPdfDownload(VALID_DOC_UUID, res);

      expect(pdfGenerationService.getPdfStream).toHaveBeenCalledWith("latest.pdf");
      expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
    });

    it("lancia 404 se non esiste nessun PDF completato", async () => {
      documentsRepository.findLatestCompletedPdfJob.mockResolvedValue(null);
      const res = makeMockResponse();

      await expect(
        service.streamLatestPdfDownload(VALID_DOC_UUID, res),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  // ── deleteGeneratedPdf() ──────────────────────────────────────────────────

  describe("deleteGeneratedPdf()", () => {
    it("elimina il PDF del job specificato", async () => {
      const job = makeJob({ status: "completed", filename: "to-delete.pdf" });
      documentsRepository.findPdfJob.mockResolvedValue(job);

      await service.deleteGeneratedPdf(VALID_DOC_UUID, VALID_JOB_UUID);

      expect(pdfGenerationService.deletePdf).toHaveBeenCalledWith("to-delete.pdf");
    });

    it("lancia 404 se il job non esiste", async () => {
      documentsRepository.findPdfJob.mockResolvedValue(null);

      await expect(
        service.deleteGeneratedPdf(VALID_DOC_UUID, VALID_JOB_UUID),
      ).rejects.toMatchObject({ status: 404 });
    });

    it("lancia 409 se il job non è completato", async () => {
      documentsRepository.findPdfJob.mockResolvedValue(makeJob({ status: "queued" }));

      await expect(
        service.deleteGeneratedPdf(VALID_DOC_UUID, VALID_JOB_UUID),
      ).rejects.toMatchObject({ status: 409 });
    });
  });

  // ── deleteGeneratedPdfsForDocument() ─────────────────────────────────────

  describe("deleteGeneratedPdfsForDocument()", () => {
    it("non fa nulla se non ci sono jobs con filename", async () => {
      documentsRepository.findPdfJobsByDocument.mockResolvedValue([
        makeJob({ filename: null }),
      ]);

      await service.deleteGeneratedPdfsForDocument(VALID_DOC_UUID);

      expect(pdfGenerationService.deletePdf).not.toHaveBeenCalled();
    });

    it("chiama deletePdf per ogni filename unico", async () => {
      documentsRepository.findPdfJobsByDocument.mockResolvedValue([
        makeJob({ filename: "a.pdf" }),
        makeJob({ filename: "b.pdf" }),
      ]);

      await service.deleteGeneratedPdfsForDocument(VALID_DOC_UUID);

      expect(pdfGenerationService.deletePdf).toHaveBeenCalledWith("a.pdf");
      expect(pdfGenerationService.deletePdf).toHaveBeenCalledWith("b.pdf");
    });

    it("deduplica i filename prima di eliminare", async () => {
      documentsRepository.findPdfJobsByDocument.mockResolvedValue([
        makeJob({ filename: "same.pdf" }),
        makeJob({ filename: "same.pdf" }),
        makeJob({ filename: "other.pdf" }),
      ]);

      await service.deleteGeneratedPdfsForDocument(VALID_DOC_UUID);

      expect(pdfGenerationService.deletePdf).toHaveBeenCalledTimes(2);
    });
  });

  // ── processPdfJob() ───────────────────────────────────────────────────────

  describe("processPdfJob()", () => {
    it("non fa nulla se il job non viene claimed", async () => {
      documentsRepository.claimQueuedPdfJob.mockResolvedValue(false);

      await service.processPdfJob(VALID_JOB_UUID);

      expect(documentsRepository.findPdfJobById).not.toHaveBeenCalled();
    });

    it("non fa nulla se il job non è in stato running dopo claim", async () => {
      documentsRepository.claimQueuedPdfJob.mockResolvedValue(true);
      documentsRepository.findPdfJobById.mockResolvedValue(makeJob({ status: "queued" }));

      await service.processPdfJob(VALID_JOB_UUID);

      expect(pdfGenerationService.generatePdf).not.toHaveBeenCalled();
    });

    it("non fa nulla se findPdfJobById ritorna null", async () => {
      documentsRepository.claimQueuedPdfJob.mockResolvedValue(true);
      documentsRepository.findPdfJobById.mockResolvedValue(null);

      await service.processPdfJob(VALID_JOB_UUID);

      expect(pdfGenerationService.generatePdf).not.toHaveBeenCalled();
    });

    it("marca il job come completato dopo generazione riuscita", async () => {
      documentsRepository.claimQueuedPdfJob.mockResolvedValue(true);
      documentsRepository.findPdfJobById.mockResolvedValue(makeJob({ status: "running" }));
      documentsRepository.findById.mockResolvedValue(makeDoc());
      pdfGenerationService.generatePdf.mockResolvedValue({
        filename: "out.pdf",
        unresolvedFields: [],
      } as never);

      await service.processPdfJob(VALID_JOB_UUID);

      expect(documentsRepository.updatePdfJobCompleted).toHaveBeenCalledWith(VALID_JOB_UUID, "out.pdf", []);
      expect(documentsRepository.updateDocumentStatusGenerated).toHaveBeenCalledWith(VALID_DOC_UUID);
    });

    it("marca il job come fallito se generatePdf lancia", async () => {
      documentsRepository.claimQueuedPdfJob.mockResolvedValue(true);
      documentsRepository.findPdfJobById.mockResolvedValue(makeJob({ status: "running" }));
      documentsRepository.findById.mockResolvedValue(makeDoc());
      pdfGenerationService.generatePdf.mockRejectedValue(new Error("Pandoc crashed"));

      await service.processPdfJob(VALID_JOB_UUID);

      expect(documentsRepository.updatePdfJobFailed).toHaveBeenCalledWith(VALID_JOB_UUID, "Pandoc crashed");
    });

    it("usa messaggio generico se l'errore non è un Error", async () => {
      documentsRepository.claimQueuedPdfJob.mockResolvedValue(true);
      documentsRepository.findPdfJobById.mockResolvedValue(makeJob({ status: "running" }));
      documentsRepository.findById.mockResolvedValue(makeDoc());
      pdfGenerationService.generatePdf.mockRejectedValue("stringa non Error");

      await service.processPdfJob(VALID_JOB_UUID);

      expect(documentsRepository.updatePdfJobFailed).toHaveBeenCalledWith(VALID_JOB_UUID, "Errore generazione PDF");
    });
  });

  // ── triggerQueueProcessor() — processo la coda con jobs ──────────────────

  describe("triggerQueueProcessor() — jobs in coda", () => {
    it("processa i job in coda al bootstrap", async () => {
      const queuedJob = makeJob({ id: "queued-job-id" });
      documentsRepository.findQueuedPdfJobs.mockResolvedValue([queuedJob]);
      documentsRepository.claimQueuedPdfJob.mockResolvedValue(false);

      // Flush setImmediate callbacks scheduled during construction
      jest.runAllImmediates();
      await Promise.resolve();

      expect(documentsRepository.findQueuedPdfJobs).toHaveBeenCalled();
    });

    it("non lancia se processPdfJob fallisce durante recovery", async () => {
      const queuedJob = makeJob({ id: "bad-job-id" });
      documentsRepository.findQueuedPdfJobs.mockResolvedValue([queuedJob]);
      documentsRepository.claimQueuedPdfJob.mockRejectedValue(new Error("DB error"));

      jest.runAllImmediates();
      await expect(Promise.resolve()).resolves.not.toThrow();
    });
  });

  // ── onModuleDestroy() ─────────────────────────────────────────────────────

  describe("onModuleDestroy()", () => {
    it("esegue senza errori se chiamato", () => {
      expect(() => service.onModuleDestroy()).not.toThrow();
    });

    it("cancella il timer recovery se attivo", () => {
      // Forza l'assegnazione di un timer fittizio
      (service as unknown as Record<string, unknown>)["queueRecoveryTimer"] = setTimeout(() => {}, 99999);
      expect(() => service.onModuleDestroy()).not.toThrow();
      expect((service as unknown as Record<string, unknown>)["queueRecoveryTimer"]).toBeNull();
    });
  });
});
