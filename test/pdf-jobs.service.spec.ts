import { Readable } from "node:stream";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Response } from "express";
import type { PdfJobEntity } from "../src/entities/pdf-job.entity";
import type { TemplateEntity } from "../src/entities/template.entity";
import { PdfJobsRepository } from "../src/repository/pdf-jobs.repository";
import { DocumentRenderingService } from "../src/service/document-rendering.service";
import { PdfGenerationService } from "../src/service/pdf-generation.service";
import { PdfJobsService } from "../src/service/pdf-jobs.service";
import { TemplatesService } from "../src/service/templates.service";

// ── helpers ────────────────────────────────────────────────────────────────────
const VALID_TPL_UUID = "789e0123-e89b-12d3-a456-426614174002";
const VALID_JOB_UUID = "456e7890-e89b-12d3-a456-426614174001";

const makeTpl = (overrides: Partial<TemplateEntity> = {}): TemplateEntity => ({
  id: VALID_TPL_UUID,
  name: "Template Test",
  content: "# {{titolo}}",
  description: "",
  category: "offerta",
  tags: [],
  is_active: true,
  version: 1,
  created_by: "system",
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
} as TemplateEntity);

const makeJob = (overrides: Partial<PdfJobEntity> = {}): PdfJobEntity => ({
  id: VALID_JOB_UUID,
  template_id: VALID_TPL_UUID,
  field_values: { titolo: "Ciao" },
  status: "queued",
  filename: null,
  requested_by: "system",
  error_message: null,
  unresolved_fields: [],
  created_at: new Date(),
  started_at: null,
  completed_at: null,
  ...overrides,
} as PdfJobEntity);

const makeMockResponse = (): jest.Mocked<Response> => {
  const listeners: Record<string, Array<() => void>> = {};
  const res = {
    setHeader: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
    writable: true,
    on: jest.fn((event: string, cb: () => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(cb);
      if (event === "finish") setImmediate(() => cb());
      return res;
    }),
    once: jest.fn(),
    emit: jest.fn((event: string) => {
      for (const cb of listeners[event] ?? []) cb();
      return true;
    }),
    pipe: jest.fn(),
  } as unknown as jest.Mocked<Response>;
  return res;
};

// ── factory per il modulo di test ─────────────────────────────────────────────
async function buildModule() {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      PdfJobsService,
      {
        provide: PdfJobsRepository,
        useValue: {
          insertPdfJob: jest.fn(),
          findPdfJobById: jest.fn(),
          findPdfJob: jest.fn(),
          findPdfJobsByTemplate: jest.fn(),
          findLatestCompletedPdfJob: jest.fn(),
          findQueuedPdfJobs: jest.fn().mockResolvedValue([]),
          claimQueuedPdfJob: jest.fn(),
          updatePdfJobCompleted: jest.fn(),
          updatePdfJobFailed: jest.fn(),
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
    ],
  }).compile();
  return module;
}

describe("PdfJobsService", () => {
  let service: PdfJobsService;
  let pdfJobsRepository: jest.Mocked<PdfJobsRepository>;
  let templatesService: jest.Mocked<TemplatesService>;
  let pdfGenerationService: jest.Mocked<PdfGenerationService>;
  let documentRenderingService: jest.Mocked<DocumentRenderingService>;

  beforeEach(async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    const module = await buildModule();
    service = module.get<PdfJobsService>(PdfJobsService);
    pdfJobsRepository = module.get(PdfJobsRepository) as jest.Mocked<PdfJobsRepository>;
    templatesService = module.get(TemplatesService) as jest.Mocked<TemplatesService>;
    pdfGenerationService = module.get(PdfGenerationService) as jest.Mocked<PdfGenerationService>;
    documentRenderingService = module.get(DocumentRenderingService) as jest.Mocked<DocumentRenderingService>;
  });

  afterEach(() => jest.restoreAllMocks());

  // ── enqueuePdfGeneration() ────────────────────────────────────────────────

  describe("enqueuePdfGeneration() - casi nominali", () => {
    it("accoda un PDF job con tutti i campi obbligatori compilati", async () => {
      const tpl = makeTpl();
      const job = makeJob();
      templatesService.findOne.mockResolvedValue(tpl);
      documentRenderingService.getMissingRequiredFields.mockReturnValue([]);
      pdfJobsRepository.insertPdfJob.mockResolvedValue(job);

      const result = await service.enqueuePdfGeneration(
        VALID_TPL_UUID,
        { titolo: "Ciao" },
        "user1",
      );

      expect(result).toEqual(job);
      expect(pdfJobsRepository.insertPdfJob).toHaveBeenCalledWith(
        VALID_TPL_UUID,
        { titolo: "Ciao" },
        "user1",
      );
    });

    it("usa 'system' come actor di default", async () => {
      templatesService.findOne.mockResolvedValue(makeTpl());
      documentRenderingService.getMissingRequiredFields.mockReturnValue([]);
      pdfJobsRepository.insertPdfJob.mockResolvedValue(makeJob());

      await service.enqueuePdfGeneration(VALID_TPL_UUID, {});

      expect(pdfJobsRepository.insertPdfJob).toHaveBeenCalledWith(
        VALID_TPL_UUID,
        {},
        "system",
      );
    });
  });

  describe("enqueuePdfGeneration() - casi limite ed errori", () => {
    it("lancia 404 se il template non esiste", async () => {
      templatesService.findOne.mockResolvedValue(null);

      await expect(
        service.enqueuePdfGeneration(VALID_TPL_UUID, {}),
      ).rejects.toMatchObject({ status: 404 });
    });

    it("lancia 422 se mancano campi obbligatori", async () => {
      templatesService.findOne.mockResolvedValue(makeTpl());
      documentRenderingService.getMissingRequiredFields.mockReturnValue(["Titolo", "Nome"]);

      await expect(
        service.enqueuePdfGeneration(VALID_TPL_UUID, {}),
      ).rejects.toMatchObject({ status: 422 });
    });

    it("il messaggio 422 elenca i campi mancanti", async () => {
      templatesService.findOne.mockResolvedValue(makeTpl());
      documentRenderingService.getMissingRequiredFields.mockReturnValue(["Titolo"]);

      await expect(
        service.enqueuePdfGeneration(VALID_TPL_UUID, {}),
      ).rejects.toThrow("Titolo");
    });
  });

  // ── getPdfJob() ──────────────────────────────────────────────────────────

  describe("getPdfJob()", () => {
    it("ritorna il job se esiste", async () => {
      const job = makeJob({ status: "completed", filename: "output.pdf" });
      pdfJobsRepository.findPdfJob.mockResolvedValue(job);

      const result = await service.getPdfJob(VALID_TPL_UUID, VALID_JOB_UUID);

      expect(result).toEqual(job);
    });

    it("ritorna null se il job non esiste", async () => {
      pdfJobsRepository.findPdfJob.mockResolvedValue(null);

      const result = await service.getPdfJob(VALID_TPL_UUID, VALID_JOB_UUID);

      expect(result).toBeNull();
    });
  });

  // ── getPdfJobs() ─────────────────────────────────────────────────────────

  describe("getPdfJobs()", () => {
    it("ritorna tutti i job del template", async () => {
      const jobs = [
        makeJob({ status: "completed", filename: "a.pdf" }),
        makeJob(),
      ];
      pdfJobsRepository.findPdfJobsByTemplate.mockResolvedValue(jobs);

      const result = await service.getPdfJobs(VALID_TPL_UUID);

      expect(result).toEqual(jobs);
      expect(pdfJobsRepository.findPdfJobsByTemplate).toHaveBeenCalledWith(VALID_TPL_UUID);
    });

    it("ritorna array vuoto se non ci sono job", async () => {
      pdfJobsRepository.findPdfJobsByTemplate.mockResolvedValue([]);

      const result = await service.getPdfJobs(VALID_TPL_UUID);

      expect(result).toEqual([]);
    });
  });

  // ── getCompletedPdfJob() ─────────────────────────────────────────────────

  describe("getCompletedPdfJob() - casi limite", () => {
    it("ritorna il job completato con filename", async () => {
      const job = makeJob({ status: "completed", filename: "output.pdf" });
      pdfJobsRepository.findPdfJob.mockResolvedValue(job);

      const result = await service.getCompletedPdfJob(VALID_TPL_UUID, VALID_JOB_UUID);

      expect(result.filename).toBe("output.pdf");
    });

    it("lancia 404 se il job non esiste", async () => {
      pdfJobsRepository.findPdfJob.mockResolvedValue(null);

      await expect(
        service.getCompletedPdfJob(VALID_TPL_UUID, VALID_JOB_UUID),
      ).rejects.toMatchObject({ status: 404 });
    });

    it("lancia 409 se il job non è ancora completato (status: queued)", async () => {
      pdfJobsRepository.findPdfJob.mockResolvedValue(makeJob({ status: "queued" }));

      await expect(
        service.getCompletedPdfJob(VALID_TPL_UUID, VALID_JOB_UUID),
      ).rejects.toMatchObject({ status: 409 });
    });

    it("lancia 409 se il job è running", async () => {
      pdfJobsRepository.findPdfJob.mockResolvedValue(makeJob({ status: "running" }));

      await expect(
        service.getCompletedPdfJob(VALID_TPL_UUID, VALID_JOB_UUID),
      ).rejects.toMatchObject({ status: 409 });
    });

    it("lancia 409 se il job è failed", async () => {
      pdfJobsRepository.findPdfJob.mockResolvedValue(makeJob({ status: "failed", filename: null }));

      await expect(
        service.getCompletedPdfJob(VALID_TPL_UUID, VALID_JOB_UUID),
      ).rejects.toMatchObject({ status: 409 });
    });

    it("lancia 409 se completato ma filename è null", async () => {
      pdfJobsRepository.findPdfJob.mockResolvedValue(makeJob({ status: "completed", filename: null }));

      await expect(
        service.getCompletedPdfJob(VALID_TPL_UUID, VALID_JOB_UUID),
      ).rejects.toMatchObject({ status: 409 });
    });
  });

  // ── getLatestCompletedPdfJob() ────────────────────────────────────────────

  describe("getLatestCompletedPdfJob()", () => {
    it("ritorna l'ultimo job completato", async () => {
      const job = makeJob({ status: "completed", filename: "latest.pdf" });
      pdfJobsRepository.findLatestCompletedPdfJob.mockResolvedValue(job);

      const result = await service.getLatestCompletedPdfJob(VALID_TPL_UUID);

      expect(result.filename).toBe("latest.pdf");
    });

    it("lancia 404 se non esiste nessun PDF completato", async () => {
      pdfJobsRepository.findLatestCompletedPdfJob.mockResolvedValue(null);

      await expect(
        service.getLatestCompletedPdfJob(VALID_TPL_UUID),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  // ── streamPdfJobDownload() ────────────────────────────────────────────────

  describe("streamPdfJobDownload()", () => {
    it("streamma il PDF e imposta gli header corretti", async () => {
      const job = makeJob({ status: "completed", filename: "output.pdf" });
      pdfJobsRepository.findPdfJob.mockResolvedValue(job);
      const readable = new Readable({ read() { this.push(null); } });
      pdfGenerationService.getPdfStream.mockResolvedValue(readable as never);
      const res = makeMockResponse();

      await service.streamPdfJobDownload(VALID_TPL_UUID, VALID_JOB_UUID, res);

      expect(pdfGenerationService.getPdfStream).toHaveBeenCalledWith("output.pdf");
      expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Disposition",
        `attachment; filename="output.pdf"`,
      );
    });

    it("lancia 404 se il job non esiste", async () => {
      pdfJobsRepository.findPdfJob.mockResolvedValue(null);
      const res = makeMockResponse();

      await expect(
        service.streamPdfJobDownload(VALID_TPL_UUID, VALID_JOB_UUID, res),
      ).rejects.toMatchObject({ status: 404 });
    });

    it("lancia 409 se il job non è completato", async () => {
      pdfJobsRepository.findPdfJob.mockResolvedValue(makeJob({ status: "running" }));
      const res = makeMockResponse();

      await expect(
        service.streamPdfJobDownload(VALID_TPL_UUID, VALID_JOB_UUID, res),
      ).rejects.toMatchObject({ status: 409 });
    });
  });

  // ── streamLatestPdfDownload() ─────────────────────────────────────────────

  describe("streamLatestPdfDownload()", () => {
    it("streamma l'ultimo PDF completato", async () => {
      const job = makeJob({ status: "completed", filename: "latest.pdf" });
      pdfJobsRepository.findLatestCompletedPdfJob.mockResolvedValue(job);
      const readable = new Readable({ read() { this.push(null); } });
      pdfGenerationService.getPdfStream.mockResolvedValue(readable as never);
      const res = makeMockResponse();

      await service.streamLatestPdfDownload(VALID_TPL_UUID, res);

      expect(pdfGenerationService.getPdfStream).toHaveBeenCalledWith("latest.pdf");
      expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
    });

    it("lancia 404 se non esiste nessun PDF completato", async () => {
      pdfJobsRepository.findLatestCompletedPdfJob.mockResolvedValue(null);
      const res = makeMockResponse();

      await expect(
        service.streamLatestPdfDownload(VALID_TPL_UUID, res),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  // ── deleteGeneratedPdf() ──────────────────────────────────────────────────

  describe("deleteGeneratedPdf()", () => {
    it("elimina il PDF del job specificato", async () => {
      const job = makeJob({ status: "completed", filename: "to-delete.pdf" });
      pdfJobsRepository.findPdfJob.mockResolvedValue(job);

      await service.deleteGeneratedPdf(VALID_TPL_UUID, VALID_JOB_UUID);

      expect(pdfGenerationService.deletePdf).toHaveBeenCalledWith("to-delete.pdf");
    });

    it("lancia 404 se il job non esiste", async () => {
      pdfJobsRepository.findPdfJob.mockResolvedValue(null);

      await expect(
        service.deleteGeneratedPdf(VALID_TPL_UUID, VALID_JOB_UUID),
      ).rejects.toMatchObject({ status: 404 });
    });

    it("lancia 409 se il job non è completato", async () => {
      pdfJobsRepository.findPdfJob.mockResolvedValue(makeJob({ status: "queued" }));

      await expect(
        service.deleteGeneratedPdf(VALID_TPL_UUID, VALID_JOB_UUID),
      ).rejects.toMatchObject({ status: 409 });
    });
  });

  // ── deleteGeneratedPdfsForTemplate() ─────────────────────────────────────

  describe("deleteGeneratedPdfsForTemplate()", () => {
    it("non fa nulla se non ci sono jobs con filename", async () => {
      pdfJobsRepository.findPdfJobsByTemplate.mockResolvedValue([makeJob({ filename: null })]);

      await service.deleteGeneratedPdfsForTemplate(VALID_TPL_UUID);

      expect(pdfGenerationService.deletePdf).not.toHaveBeenCalled();
    });

    it("chiama deletePdf per ogni filename unico", async () => {
      pdfJobsRepository.findPdfJobsByTemplate.mockResolvedValue([
        makeJob({ filename: "a.pdf" }),
        makeJob({ filename: "b.pdf" }),
      ]);

      await service.deleteGeneratedPdfsForTemplate(VALID_TPL_UUID);

      expect(pdfGenerationService.deletePdf).toHaveBeenCalledWith("a.pdf");
      expect(pdfGenerationService.deletePdf).toHaveBeenCalledWith("b.pdf");
    });

    it("deduplica i filename prima di eliminare", async () => {
      pdfJobsRepository.findPdfJobsByTemplate.mockResolvedValue([
        makeJob({ filename: "same.pdf" }),
        makeJob({ filename: "same.pdf" }),
        makeJob({ filename: "other.pdf" }),
      ]);

      await service.deleteGeneratedPdfsForTemplate(VALID_TPL_UUID);

      expect(pdfGenerationService.deletePdf).toHaveBeenCalledTimes(2);
    });
  });

  // ── processPdfJob() ───────────────────────────────────────────────────────

  describe("processPdfJob()", () => {
    it("non fa nulla se il job non viene claimed", async () => {
      pdfJobsRepository.claimQueuedPdfJob.mockResolvedValue(false);

      await service.processPdfJob(VALID_JOB_UUID);

      expect(pdfJobsRepository.findPdfJobById).not.toHaveBeenCalled();
    });

    it("non fa nulla se il job non è in stato running dopo claim", async () => {
      pdfJobsRepository.claimQueuedPdfJob.mockResolvedValue(true);
      pdfJobsRepository.findPdfJobById.mockResolvedValue(makeJob({ status: "queued" }));

      await service.processPdfJob(VALID_JOB_UUID);

      expect(pdfGenerationService.generatePdf).not.toHaveBeenCalled();
    });

    it("non fa nulla se findPdfJobById ritorna null", async () => {
      pdfJobsRepository.claimQueuedPdfJob.mockResolvedValue(true);
      pdfJobsRepository.findPdfJobById.mockResolvedValue(null);

      await service.processPdfJob(VALID_JOB_UUID);

      expect(pdfGenerationService.generatePdf).not.toHaveBeenCalled();
    });

    it("marca il job come completato dopo generazione riuscita", async () => {
      pdfJobsRepository.claimQueuedPdfJob.mockResolvedValue(true);
      pdfJobsRepository.findPdfJobById.mockResolvedValue(makeJob({ status: "running" }));
      templatesService.findOne.mockResolvedValue(makeTpl());
      pdfGenerationService.generatePdf.mockResolvedValue({
        filename: "out.pdf",
        unresolvedFields: [],
      } as never);

      await service.processPdfJob(VALID_JOB_UUID);

      expect(pdfJobsRepository.updatePdfJobCompleted).toHaveBeenCalledWith(
        VALID_JOB_UUID,
        "out.pdf",
        [],
      );
    });

    it("marca il job come fallito se generatePdf lancia", async () => {
      pdfJobsRepository.claimQueuedPdfJob.mockResolvedValue(true);
      pdfJobsRepository.findPdfJobById.mockResolvedValue(makeJob({ status: "running" }));
      templatesService.findOne.mockResolvedValue(makeTpl());
      pdfGenerationService.generatePdf.mockRejectedValue(new Error("Pandoc crashed"));

      await service.processPdfJob(VALID_JOB_UUID);

      expect(pdfJobsRepository.updatePdfJobFailed).toHaveBeenCalledWith(
        VALID_JOB_UUID,
        "Pandoc crashed",
      );
    });

    it("usa messaggio generico se l'errore non è un Error", async () => {
      pdfJobsRepository.claimQueuedPdfJob.mockResolvedValue(true);
      pdfJobsRepository.findPdfJobById.mockResolvedValue(makeJob({ status: "running" }));
      templatesService.findOne.mockResolvedValue(makeTpl());
      pdfGenerationService.generatePdf.mockRejectedValue("stringa non Error");

      await service.processPdfJob(VALID_JOB_UUID);

      expect(pdfJobsRepository.updatePdfJobFailed).toHaveBeenCalledWith(
        VALID_JOB_UUID,
        "Errore generazione PDF",
      );
    });
  });

  // ── triggerQueueProcessor() — processo la coda con jobs ──────────────────

  describe("triggerQueueProcessor() — jobs in coda", () => {
    it("processa i job in coda al bootstrap", async () => {
      const mod = await Test.createTestingModule({
        providers: [
          PdfJobsService,
          {
            provide: PdfJobsRepository,
            useValue: {
              insertPdfJob: jest.fn(),
              findPdfJobById: jest.fn(),
              findPdfJob: jest.fn(),
              findPdfJobsByTemplate: jest.fn(),
              findLatestCompletedPdfJob: jest.fn(),
              findQueuedPdfJobs: jest.fn().mockResolvedValue([makeJob({ id: "queued-job-id" })]),
              claimQueuedPdfJob: jest.fn().mockResolvedValue(false),
              updatePdfJobCompleted: jest.fn(),
              updatePdfJobFailed: jest.fn(),
            },
          },
          { provide: TemplatesService, useValue: { findOne: jest.fn() } },
          {
            provide: PdfGenerationService,
            useValue: { generatePdf: jest.fn(), getPdfStream: jest.fn(), deletePdf: jest.fn() },
          },
          {
            provide: DocumentRenderingService,
            useValue: { getMissingRequiredFields: jest.fn() },
          },
        ],
      }).compile();

      const repo = mod.get(PdfJobsRepository) as jest.Mocked<PdfJobsRepository>;
      await new Promise<void>((resolve) => setImmediate(resolve));
      await Promise.resolve();
      expect(repo.findQueuedPdfJobs).toHaveBeenCalled();
    });

    it("non lancia se processPdfJob fallisce durante recovery", async () => {
      const mod = await Test.createTestingModule({
        providers: [
          PdfJobsService,
          {
            provide: PdfJobsRepository,
            useValue: {
              insertPdfJob: jest.fn(),
              findPdfJobById: jest.fn(),
              findPdfJob: jest.fn(),
              findPdfJobsByTemplate: jest.fn(),
              findLatestCompletedPdfJob: jest.fn(),
              findQueuedPdfJobs: jest.fn().mockResolvedValue([makeJob({ id: "bad-job-id" })]),
              claimQueuedPdfJob: jest.fn().mockRejectedValue(new Error("DB error")),
              updatePdfJobCompleted: jest.fn(),
              updatePdfJobFailed: jest.fn(),
            },
          },
          { provide: TemplatesService, useValue: { findOne: jest.fn() } },
          {
            provide: PdfGenerationService,
            useValue: { generatePdf: jest.fn(), getPdfStream: jest.fn(), deletePdf: jest.fn() },
          },
          {
            provide: DocumentRenderingService,
            useValue: { getMissingRequiredFields: jest.fn() },
          },
        ],
      }).compile();

      await new Promise<void>((resolve) => setImmediate(resolve));
      await Promise.resolve();
      await expect(Promise.resolve()).resolves.not.toThrow();
      await mod.close();
    });
  });

  // ── onModuleDestroy() ─────────────────────────────────────────────────────

  describe("onModuleDestroy()", () => {
    it("esegue senza errori se chiamato", () => {
      expect(() => service.onModuleDestroy()).not.toThrow();
    });

    it("cancella il timer recovery se attivo", () => {
      (service as unknown as Record<string, unknown>).queueRecoveryTimer = setTimeout(() => {}, 99999);
      expect(() => service.onModuleDestroy()).not.toThrow();
      expect((service as unknown as Record<string, unknown>).queueRecoveryTimer).toBeNull();
    });
  });
});
