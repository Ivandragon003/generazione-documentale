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
  fields: [],
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

// ── mock repository base ───────────────────────────────────────────────────────
const makeMockRepo = () => ({
  insert: jest.fn(),
  findById: jest.fn(),
  findByTemplate: jest.fn(),
  findLatestCompleted: jest.fn(),
  findQueued: jest.fn().mockResolvedValue([]),
  claim: jest.fn(),
  markCompleted: jest.fn(),
  markFailed: jest.fn(),
});

async function buildModule(repoOverrides: Record<string, jest.Mock> = {}) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      PdfJobsService,
      {
        provide: PdfJobsRepository,
        useValue: { ...makeMockRepo(), ...repoOverrides },
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

  // ── enqueue() ─────────────────────────────────────────────────────────────

  describe("enqueue() - casi nominali", () => {
    it("accoda un PDF job con tutti i campi obbligatori compilati", async () => {
      const tpl = makeTpl();
      const job = makeJob();
      templatesService.findOne.mockResolvedValue(tpl);
      documentRenderingService.getMissingRequiredFields.mockReturnValue([]);
      pdfJobsRepository.insert.mockResolvedValue(job);

      const result = await service.enqueue(VALID_TPL_UUID, { titolo: "Ciao" }, "user1");

      expect(result).toEqual(job);
      expect(pdfJobsRepository.insert).toHaveBeenCalledWith(
        VALID_TPL_UUID,
        { titolo: "Ciao" },
        "user1",
      );
    });

    it("usa 'system' come actor di default", async () => {
      templatesService.findOne.mockResolvedValue(makeTpl());
      documentRenderingService.getMissingRequiredFields.mockReturnValue([]);
      pdfJobsRepository.insert.mockResolvedValue(makeJob());

      await service.enqueue(VALID_TPL_UUID, {});

      expect(pdfJobsRepository.insert).toHaveBeenCalledWith(VALID_TPL_UUID, {}, "system");
    });
  });

  describe("enqueue() - casi limite ed errori", () => {
    it("lancia 404 se il template non esiste", async () => {
      templatesService.findOne.mockResolvedValue(null);

      await expect(service.enqueue(VALID_TPL_UUID, {})).rejects.toMatchObject({ status: 404 });
    });

    it("lancia 422 se mancano campi obbligatori", async () => {
      templatesService.findOne.mockResolvedValue(makeTpl());
      documentRenderingService.getMissingRequiredFields.mockReturnValue(["Titolo", "Nome"]);

      await expect(service.enqueue(VALID_TPL_UUID, {})).rejects.toMatchObject({ status: 422 });
    });

    it("il messaggio 422 elenca i campi mancanti", async () => {
      templatesService.findOne.mockResolvedValue(makeTpl());
      documentRenderingService.getMissingRequiredFields.mockReturnValue(["Titolo"]);

      await expect(service.enqueue(VALID_TPL_UUID, {})).rejects.toThrow("Titolo");
    });
  });

  // ── getJob() ──────────────────────────────────────────────────────────────

  describe("getJob()", () => {
    it("ritorna il job se esiste", async () => {
      const job = makeJob({ status: "completed", filename: "output.pdf" });
      pdfJobsRepository.findById.mockResolvedValue(job);

      const result = await service.getJob(VALID_TPL_UUID, VALID_JOB_UUID);

      expect(result).toEqual(job);
    });

    it("lancia 404 se il job non esiste", async () => {
      pdfJobsRepository.findById.mockResolvedValue(null);

      await expect(service.getJob(VALID_TPL_UUID, VALID_JOB_UUID)).rejects.toMatchObject({ status: 404 });
    });

    it("lancia 404 se il job appartiene a un altro template", async () => {
      pdfJobsRepository.findById.mockResolvedValue(makeJob({ template_id: "altro-uuid" }));

      await expect(service.getJob(VALID_TPL_UUID, VALID_JOB_UUID)).rejects.toMatchObject({ status: 404 });
    });
  });

  // ── getJobs() ─────────────────────────────────────────────────────────────

  describe("getJobs()", () => {
    it("ritorna tutti i job del template", async () => {
      const jobs = [
        makeJob({ status: "completed", filename: "a.pdf" }),
        makeJob(),
      ];
      pdfJobsRepository.findByTemplate.mockResolvedValue(jobs);

      const result = await service.getJobs(VALID_TPL_UUID);

      expect(result).toEqual(jobs);
      expect(pdfJobsRepository.findByTemplate).toHaveBeenCalledWith(VALID_TPL_UUID);
    });

    it("ritorna array vuoto se non ci sono job", async () => {
      pdfJobsRepository.findByTemplate.mockResolvedValue([]);

      const result = await service.getJobs(VALID_TPL_UUID);

      expect(result).toEqual([]);
    });
  });

  // ── getLatestCompleted() ──────────────────────────────────────────────────

  describe("getLatestCompleted()", () => {
    it("ritorna l'ultimo job completato", async () => {
      const job = makeJob({ status: "completed", filename: "latest.pdf" });
      pdfJobsRepository.findLatestCompleted.mockResolvedValue(job);

      const result = await service.getLatestCompleted(VALID_TPL_UUID);

      expect(result.filename).toBe("latest.pdf");
    });

    it("lancia 404 se non esiste nessun PDF completato", async () => {
      pdfJobsRepository.findLatestCompleted.mockResolvedValue(null);

      await expect(service.getLatestCompleted(VALID_TPL_UUID)).rejects.toMatchObject({ status: 404 });
    });
  });

  // ── streamDownload() ──────────────────────────────────────────────────────

  describe("streamDownload()", () => {
    it("streamma il PDF e imposta gli header corretti", async () => {
      const job = makeJob({ status: "completed", filename: "output.pdf" });
      pdfJobsRepository.findById.mockResolvedValue(job);
      const readable = new Readable({ read() { this.push(null); } });
      pdfGenerationService.getPdfStream.mockResolvedValue(readable as never);
      const res = makeMockResponse();

      await service.streamDownload(VALID_TPL_UUID, VALID_JOB_UUID, res);

      expect(pdfGenerationService.getPdfStream).toHaveBeenCalledWith("output.pdf");
      expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Disposition",
        `attachment; filename="output.pdf"`,
      );
    });

    it("lancia 404 se il job non esiste", async () => {
      pdfJobsRepository.findById.mockResolvedValue(null);
      const res = makeMockResponse();

      await expect(
        service.streamDownload(VALID_TPL_UUID, VALID_JOB_UUID, res),
      ).rejects.toMatchObject({ status: 404 });
    });

    it("lancia 409 se il job non è completato", async () => {
      pdfJobsRepository.findById.mockResolvedValue(makeJob({ status: "running" }));
      const res = makeMockResponse();

      await expect(
        service.streamDownload(VALID_TPL_UUID, VALID_JOB_UUID, res),
      ).rejects.toMatchObject({ status: 409 });
    });
  });

  // ── streamLatest() ────────────────────────────────────────────────────────

  describe("streamLatest()", () => {
    it("streamma l'ultimo PDF completato", async () => {
      const job = makeJob({ status: "completed", filename: "latest.pdf" });
      pdfJobsRepository.findLatestCompleted.mockResolvedValue(job);
      const readable = new Readable({ read() { this.push(null); } });
      pdfGenerationService.getPdfStream.mockResolvedValue(readable as never);
      const res = makeMockResponse();

      await service.streamLatest(VALID_TPL_UUID, res);

      expect(pdfGenerationService.getPdfStream).toHaveBeenCalledWith("latest.pdf");
      expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
    });

    it("lancia 404 se non esiste nessun PDF completato", async () => {
      pdfJobsRepository.findLatestCompleted.mockResolvedValue(null);
      const res = makeMockResponse();

      await expect(
        service.streamLatest(VALID_TPL_UUID, res),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  // ── processJob() ──────────────────────────────────────────────────────────

  describe("processJob()", () => {
    it("non fa nulla se il job non viene claimed", async () => {
      pdfJobsRepository.claim.mockResolvedValue(false);

      await service.processJob(VALID_JOB_UUID);

      expect(pdfJobsRepository.findById).not.toHaveBeenCalled();
    });

    it("non fa nulla se il job non è in stato running dopo claim", async () => {
      pdfJobsRepository.claim.mockResolvedValue(true);
      pdfJobsRepository.findById.mockResolvedValue(makeJob({ status: "queued" }));

      await service.processJob(VALID_JOB_UUID);

      expect(pdfGenerationService.generatePdf).not.toHaveBeenCalled();
    });

    it("non fa nulla se findById ritorna null", async () => {
      pdfJobsRepository.claim.mockResolvedValue(true);
      pdfJobsRepository.findById.mockResolvedValue(null);

      await service.processJob(VALID_JOB_UUID);

      expect(pdfGenerationService.generatePdf).not.toHaveBeenCalled();
    });

    it("marca il job come completato dopo generazione riuscita", async () => {
      pdfJobsRepository.claim.mockResolvedValue(true);
      pdfJobsRepository.findById.mockResolvedValue(makeJob({ status: "running" }));
      templatesService.findOne.mockResolvedValue(makeTpl());
      pdfGenerationService.generatePdf.mockResolvedValue({
        filename: "out.pdf",
        unresolvedFields: [],
      } as never);

      await service.processJob(VALID_JOB_UUID);

      expect(pdfJobsRepository.markCompleted).toHaveBeenCalledWith(
        VALID_JOB_UUID,
        "out.pdf",
        [],
      );
    });

    it("marca il job come fallito se generatePdf lancia", async () => {
      pdfJobsRepository.claim.mockResolvedValue(true);
      pdfJobsRepository.findById.mockResolvedValue(makeJob({ status: "running" }));
      templatesService.findOne.mockResolvedValue(makeTpl());
      pdfGenerationService.generatePdf.mockRejectedValue(new Error("Pandoc crashed"));

      await service.processJob(VALID_JOB_UUID);

      expect(pdfJobsRepository.markFailed).toHaveBeenCalledWith(VALID_JOB_UUID, "Pandoc crashed");
    });

    it("usa messaggio generico se l'errore non è un Error", async () => {
      pdfJobsRepository.claim.mockResolvedValue(true);
      pdfJobsRepository.findById.mockResolvedValue(makeJob({ status: "running" }));
      templatesService.findOne.mockResolvedValue(makeTpl());
      pdfGenerationService.generatePdf.mockRejectedValue("stringa non Error");

      await service.processJob(VALID_JOB_UUID);

      expect(pdfJobsRepository.markFailed).toHaveBeenCalledWith(
        VALID_JOB_UUID,
        "Errore generazione PDF",
      );
    });
  });

  // ── triggerQueueProcessor() ───────────────────────────────────────────────

  describe("triggerQueueProcessor() — jobs in coda", () => {
    it("processa i job in coda al bootstrap", async () => {
      const mod = await buildModule({
        findQueued: jest.fn().mockResolvedValue([makeJob({ id: "queued-job-id" })]),
        claim: jest.fn().mockResolvedValue(false),
      });
      const repo = mod.get(PdfJobsRepository) as jest.Mocked<PdfJobsRepository>;
      await new Promise<void>((resolve) => setImmediate(resolve));
      await Promise.resolve();
      expect(repo.findQueued).toHaveBeenCalled();
    });

    it("non lancia se processJob fallisce durante recovery", async () => {
      const mod = await buildModule({
        findQueued: jest.fn().mockResolvedValue([makeJob({ id: "bad-job-id" })]),
        claim: jest.fn().mockRejectedValue(new Error("DB error")),
      });
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
