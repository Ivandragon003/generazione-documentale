import { Test, type TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DocumentEntity } from "../src/entities/document.entity";
import { PdfJobEntity } from "../src/entities/pdf-job.entity";
import { DocumentsRepository } from "../src/repository/documents.repository";

/**
 * Test supplementari per DocumentsRepository.
 * Coprono:
 * - insertDocument con field_values inizializzato a {}
 * - findPdfJobsByDocument ordine DESC per created_at
 * - updatePdfJobCompleted con unresolvedFields non vuoto
 * - findQueuedPdfJobs ordine ASC per created_at
 * - deleteDocument con id non esistente (idempotente)
 * - findPdfJob con documentId errato rispetto al jobId (combinazione non trovata)
 */

const makeDocRepo = () => ({
  findAndCount: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  find: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const makePdfRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const fakeDoc = (): DocumentEntity =>
  ({
    id: "doc-1",
    name: "Documento Test",
    template_id: "tpl-1",
    content: "# {{titolo}}",
    field_values: {},
    status: "draft",
    created_by: "user1",
    created_at: new Date("2024-01-01"),
    updated_at: new Date("2024-06-01"),
  }) as DocumentEntity;

const fakeJob = (overrides: Partial<PdfJobEntity> = {}): PdfJobEntity =>
  ({
    id: "job-1",
    document_id: "doc-1",
    status: "queued",
    filename: null,
    requested_by: "user1",
    unresolved_fields: [],
    error_message: null,
    created_at: new Date(),
    started_at: null,
    completed_at: null,
    ...overrides,
  }) as PdfJobEntity;

describe("DocumentsRepository — edge cases aggiuntivi", () => {
  let repo: DocumentsRepository;
  let docRepo: ReturnType<typeof makeDocRepo>;
  let pdfRepo: ReturnType<typeof makePdfRepo>;

  beforeEach(async () => {
    docRepo = makeDocRepo();
    pdfRepo = makePdfRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsRepository,
        { provide: getRepositoryToken(DocumentEntity), useValue: docRepo },
        { provide: getRepositoryToken(PdfJobEntity), useValue: pdfRepo },
      ],
    }).compile();

    repo = module.get<DocumentsRepository>(DocumentsRepository);
  });

  // ── insertDocument ────────────────────────────────────────────────────────

  describe("insertDocument()", () => {
    it("inizializza field_values come oggetto vuoto {}", async () => {
      const doc = fakeDoc();
      const manager = {
        create: jest.fn().mockReturnValue(doc),
        save: jest.fn().mockResolvedValue(doc),
      };

      await repo.insertDocument(manager as never, {
        name: "Test",
        templateId: "tpl-1",
        content: "# Test",
        createdBy: "user1",
      });

      expect(manager.create).toHaveBeenCalledWith(
        DocumentEntity,
        expect.objectContaining({ field_values: {} }),
      );
    });

    it("imposta status 'draft' al momento della creazione", async () => {
      const doc = fakeDoc();
      const manager = {
        create: jest.fn().mockReturnValue(doc),
        save: jest.fn().mockResolvedValue(doc),
      };

      await repo.insertDocument(manager as never, {
        name: "Draft doc",
        templateId: "tpl-1",
        content: "Contenuto",
        createdBy: "system",
      });

      expect(manager.create).toHaveBeenCalledWith(
        DocumentEntity,
        expect.objectContaining({ status: "draft" }),
      );
    });

    it("usa il createdBy passato come created_by", async () => {
      const doc = fakeDoc();
      const manager = {
        create: jest.fn().mockReturnValue(doc),
        save: jest.fn().mockResolvedValue(doc),
      };

      await repo.insertDocument(manager as never, {
        name: "Doc",
        templateId: "tpl-1",
        content: "C",
        createdBy: "daniele@example.com",
      });

      expect(manager.create).toHaveBeenCalledWith(
        DocumentEntity,
        expect.objectContaining({ created_by: "daniele@example.com" }),
      );
    });
  });

  // ── updateDocument ────────────────────────────────────────────────────────

  describe("updateDocument()", () => {
    it("lancia errore con messaggio specifico se documento non trovato dopo update", async () => {
      const manager = {
        update: jest.fn().mockResolvedValue(undefined),
        findOne: jest.fn().mockResolvedValue(null),
      };

      await expect(
        repo.updateDocument(manager as never, {
          id: "x",
          name: "Y",
          content: "Z",
          fieldValues: {},
        }),
      ).rejects.toThrow("non trovato dopo update");
    });

    it("aggiorna tutti e tre i campi: name, content, field_values", async () => {
      const doc = fakeDoc();
      const manager = {
        update: jest.fn().mockResolvedValue(undefined),
        findOne: jest.fn().mockResolvedValue(doc),
      };

      await repo.updateDocument(manager as never, {
        id: "doc-1",
        name: "Nuovo nome",
        content: "Nuovo contenuto",
        fieldValues: { titolo: "T", importo: 100 },
      });

      expect(manager.update).toHaveBeenCalledWith(
        DocumentEntity,
        { id: "doc-1" },
        expect.objectContaining({
          name: "Nuovo nome",
          content: "Nuovo contenuto",
          field_values: { titolo: "T", importo: 100 },
        }),
      );
    });
  });

  // ── findPdfJobsByDocument — ordine ────────────────────────────────────────

  describe("findPdfJobsByDocument()", () => {
    it("richiede ordine DESC per created_at", async () => {
      pdfRepo.find.mockResolvedValue([]);

      await repo.findPdfJobsByDocument("doc-1");

      expect(pdfRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { created_at: "DESC" },
        }),
      );
    });

    it("filtra per document_id corretto", async () => {
      pdfRepo.find.mockResolvedValue([]);

      await repo.findPdfJobsByDocument("target-doc-id");

      expect(pdfRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { document_id: "target-doc-id" },
        }),
      );
    });
  });

  // ── findQueuedPdfJobs — ordine ────────────────────────────────────────────

  describe("findQueuedPdfJobs()", () => {
    it("richiede ordine ASC per created_at (FIFO)", async () => {
      pdfRepo.find.mockResolvedValue([]);

      await repo.findQueuedPdfJobs();

      expect(pdfRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { created_at: "ASC" },
        }),
      );
    });

    it("filtra solo status 'queued'", async () => {
      pdfRepo.find.mockResolvedValue([]);

      await repo.findQueuedPdfJobs();

      expect(pdfRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: "queued" },
        }),
      );
    });

    it("ritorna array vuoto se nessun job in coda", async () => {
      pdfRepo.find.mockResolvedValue([]);

      const result = await repo.findQueuedPdfJobs();

      expect(result).toEqual([]);
    });
  });

  // ── updatePdfJobCompleted — unresolvedFields non vuoto ────────────────────

  describe("updatePdfJobCompleted()", () => {
    it("salva correttamente unresolvedFields non vuoto", async () => {
      pdfRepo.update.mockResolvedValue(undefined);

      await repo.updatePdfJobCompleted("job-1", "output.pdf", [
        "Titolo",
        "Importo",
      ]);

      expect(pdfRepo.update).toHaveBeenCalledWith(
        { id: "job-1" },
        expect.objectContaining({
          unresolved_fields: ["Titolo", "Importo"],
        }),
      );
    });

    it("imposta status 'completed' e completed_at", async () => {
      pdfRepo.update.mockResolvedValue(undefined);

      await repo.updatePdfJobCompleted("job-x", "file.pdf", []);

      expect(pdfRepo.update).toHaveBeenCalledWith(
        { id: "job-x" },
        expect.objectContaining({
          status: "completed",
          filename: "file.pdf",
          completed_at: expect.any(Date),
        }),
      );
    });
  });

  // ── updatePdfJobFailed ────────────────────────────────────────────────────

  describe("updatePdfJobFailed()", () => {
    it("imposta status 'failed', error_message e completed_at", async () => {
      pdfRepo.update.mockResolvedValue(undefined);

      await repo.updatePdfJobFailed("job-fail", "Pandoc timeout");

      expect(pdfRepo.update).toHaveBeenCalledWith(
        { id: "job-fail" },
        expect.objectContaining({
          status: "failed",
          error_message: "Pandoc timeout",
          completed_at: expect.any(Date),
        }),
      );
    });
  });

  // ── deleteDocument — idempotenza ──────────────────────────────────────────

  describe("deleteDocument()", () => {
    it("non lancia se l'id non esiste nel DB", async () => {
      docRepo.delete.mockResolvedValue({ affected: 0 });

      await expect(repo.deleteDocument("non-esiste")).resolves.not.toThrow();
    });

    it("chiama delete con where { id } corretto", async () => {
      docRepo.delete.mockResolvedValue({ affected: 1 });

      await repo.deleteDocument("target-id");

      expect(docRepo.delete).toHaveBeenCalledWith({ id: "target-id" });
    });
  });

  // ── findPdfJob — combinazione documentId/jobId errata ────────────────────

  describe("findPdfJob() — combinazione errata", () => {
    it("ritorna null se il jobId appartiene a un altro documento", async () => {
      pdfRepo.findOne.mockResolvedValue(null);

      const result = await repo.findPdfJob("doc-sbagliato", "job-1");

      expect(result).toBeNull();
      expect(pdfRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "job-1", document_id: "doc-sbagliato" },
        }),
      );
    });
  });

  // ── findAll — ordinamento ─────────────────────────────────────────────────

  describe("findAll()", () => {
    it("ordina per updated_at DESC", async () => {
      docRepo.findAndCount.mockResolvedValue([[], 0]);

      await repo.findAll({ limit: 10, offset: 0 });

      expect(docRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { updated_at: "DESC" },
        }),
      );
    });

    it("applica take e skip corretti", async () => {
      docRepo.findAndCount.mockResolvedValue([[], 0]);

      await repo.findAll({ limit: 5, offset: 30 });

      expect(docRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5, skip: 30 }),
      );
    });
  });

  // ── updateDocumentStatusGenerated ────────────────────────────────────────

  describe("updateDocumentStatusGenerated()", () => {
    it("aggiorna solo il campo status a 'generated'", async () => {
      docRepo.update.mockResolvedValue(undefined);

      await repo.updateDocumentStatusGenerated("doc-gen");

      expect(docRepo.update).toHaveBeenCalledWith(
        { id: "doc-gen" },
        { status: "generated" },
      );
    });
  });
});
