import { Test, type TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DocumentEntity } from "../src/entities/document.entity";
import { PdfJobEntity } from "../src/entities/pdf-job.entity";
import { DocumentsRepository } from "../src/repository/documents.repository";

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

describe("DocumentsRepository", () => {
  let repo: DocumentsRepository;
  let docRepo: ReturnType<typeof makeDocRepo>;
  let pdfRepo: ReturnType<typeof makePdfRepo>;

  const fakeDoc = (): DocumentEntity =>
    ({
      id: "doc-1",
      name: "Test Doc",
      template_id: "tpl-1",
      content: "# Test",
      field_values: {},
      status: "draft",
      created_by: "user1",
      created_at: new Date(),
      updated_at: new Date(),
    }) as DocumentEntity;

  const fakeJob = (): PdfJobEntity =>
    ({
      id: "job-1",
      document_id: "doc-1",
      status: "queued",
      requested_by: "user1",
      created_at: new Date(),
    }) as PdfJobEntity;

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

  describe("findAll()", () => {
    it("deve restituire documenti e totale senza filtro status", async () => {
      const docs = [fakeDoc()];
      docRepo.findAndCount.mockResolvedValue([docs, 1]);
      const result = await repo.findAll({ limit: 10, offset: 0 });
      expect(result.data).toEqual(docs);
      expect(result.total).toBe(1);
      expect(docRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: {}, take: 10, skip: 0 }),
      );
    });

    it("deve filtrare per status", async () => {
      docRepo.findAndCount.mockResolvedValue([[], 0]);
      await repo.findAll({ status: "draft", limit: 5, offset: 0 });
      expect(docRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: "draft" } }),
      );
    });

    it("deve supportare paginazione con offset", async () => {
      docRepo.findAndCount.mockResolvedValue([[], 0]);
      await repo.findAll({ limit: 10, offset: 20 });
      expect(docRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, skip: 20 }),
      );
    });
  });

  describe("findById()", () => {
    it("deve restituire un documento per id", async () => {
      const doc = fakeDoc();
      docRepo.findOne.mockResolvedValue(doc);
      const result = await repo.findById("doc-1");
      expect(result).toEqual(doc);
    });

    it("deve restituire null se non trovato", async () => {
      docRepo.findOne.mockResolvedValue(null);
      const result = await repo.findById("non-esiste");
      expect(result).toBeNull();
    });
  });

  describe("insertDocument()", () => {
    it("deve creare e salvare un documento", async () => {
      const doc = fakeDoc();
      const manager: any = {
        create: jest.fn().mockReturnValue(doc),
        save: jest.fn().mockResolvedValue(doc),
      };
      const result = await repo.insertDocument(manager, {
        name: "Test",
        templateId: "tpl-1",
        content: "# Test",
        createdBy: "user1",
      });
      expect(result).toEqual(doc);
      expect(manager.create).toHaveBeenCalledWith(
        DocumentEntity,
        expect.objectContaining({ name: "Test", status: "draft" }),
      );
    });
  });

  describe("updateDocument()", () => {
    it("deve aggiornare e restituire il documento", async () => {
      const doc = fakeDoc();
      const manager: any = {
        update: jest.fn().mockResolvedValue(undefined),
        findOne: jest.fn().mockResolvedValue(doc),
      };
      const result = await repo.updateDocument(manager, {
        id: "doc-1",
        name: "Updated",
        content: "# Updated",
        fieldValues: { titolo: "X" },
      });
      expect(result).toEqual(doc);
    });

    it("deve lanciare errore se documento non trovato dopo update", async () => {
      const manager: any = {
        update: jest.fn().mockResolvedValue(undefined),
        findOne: jest.fn().mockResolvedValue(null),
      };
      await expect(
        repo.updateDocument(manager, {
          id: "x",
          name: "Y",
          content: "Z",
          fieldValues: {},
        }),
      ).rejects.toThrow(/non trovato dopo update/);
    });
  });

  describe("insertPdfJob()", () => {
    it("deve creare e salvare un job PDF", async () => {
      const job = fakeJob();
      pdfRepo.create.mockReturnValue(job);
      pdfRepo.save.mockResolvedValue(job);
      const result = await repo.insertPdfJob("doc-1", "user1");
      expect(result).toEqual(job);
      expect(pdfRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ document_id: "doc-1", status: "queued" }),
      );
    });
  });

  describe("findPdfJobById()", () => {
    it("deve trovare un job per id", async () => {
      const job = fakeJob();
      pdfRepo.findOne.mockResolvedValue(job);
      const result = await repo.findPdfJobById("job-1");
      expect(result).toEqual(job);
    });
  });

  describe("findPdfJob()", () => {
    it("deve trovare job per documentId e jobId", async () => {
      const job = fakeJob();
      pdfRepo.findOne.mockResolvedValue(job);
      const result = await repo.findPdfJob("doc-1", "job-1");
      expect(result).toEqual(job);
      expect(pdfRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "job-1", document_id: "doc-1" },
        }),
      );
    });

    it("deve restituire null se non trovato", async () => {
      pdfRepo.findOne.mockResolvedValue(null);
      expect(await repo.findPdfJob("x", "y")).toBeNull();
    });
  });

  describe("findPdfJobsByDocument()", () => {
    it("deve restituire tutti i job di un documento", async () => {
      const jobs = [fakeJob()];
      pdfRepo.find.mockResolvedValue(jobs);
      const result = await repo.findPdfJobsByDocument("doc-1");
      expect(result).toEqual(jobs);
    });
  });

  describe("findQueuedPdfJobs()", () => {
    it("deve restituire i job in coda", async () => {
      pdfRepo.find.mockResolvedValue([fakeJob()]);
      const result = await repo.findQueuedPdfJobs();
      expect(result).toHaveLength(1);
      expect(pdfRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: "queued" } }),
      );
    });
  });

  describe("claimQueuedPdfJob()", () => {
    it("deve restituire true se il job viene aggiornato", async () => {
      const qb: any = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      pdfRepo.createQueryBuilder.mockReturnValue(qb);
      expect(await repo.claimQueuedPdfJob("job-1")).toBe(true);
    });

    it("deve restituire false se nessuna riga aggiornata", async () => {
      const qb: any = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      };
      pdfRepo.createQueryBuilder.mockReturnValue(qb);
      expect(await repo.claimQueuedPdfJob("job-1")).toBe(false);
    });

    it("deve gestire affected=undefined come false", async () => {
      const qb: any = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: undefined }),
      };
      pdfRepo.createQueryBuilder.mockReturnValue(qb);
      expect(await repo.claimQueuedPdfJob("job-1")).toBe(false);
    });
  });

  describe("findLatestCompletedPdfJob()", () => {
    it("deve trovare l'ultimo job completato", async () => {
      const job = { ...fakeJob(), status: "completed" } as PdfJobEntity;
      pdfRepo.findOne.mockResolvedValue(job);
      const result = await repo.findLatestCompletedPdfJob("doc-1");
      expect(result).toEqual(job);
      expect(pdfRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { document_id: "doc-1", status: "completed" },
        }),
      );
    });
  });

  describe("updatePdfJobCompleted()", () => {
    it("deve aggiornare il job come completato", async () => {
      pdfRepo.update.mockResolvedValue(undefined);
      await expect(
        repo.updatePdfJobCompleted("job-1", "file.pdf", ["campo1"]),
      ).resolves.not.toThrow();
      expect(pdfRepo.update).toHaveBeenCalledWith(
        { id: "job-1" },
        expect.objectContaining({ status: "completed", filename: "file.pdf" }),
      );
    });
  });

  describe("updatePdfJobFailed()", () => {
    it("deve aggiornare il job come fallito", async () => {
      pdfRepo.update.mockResolvedValue(undefined);
      await expect(
        repo.updatePdfJobFailed("job-1", "Errore pandoc"),
      ).resolves.not.toThrow();
      expect(pdfRepo.update).toHaveBeenCalledWith(
        { id: "job-1" },
        expect.objectContaining({
          status: "failed",
          error_message: "Errore pandoc",
        }),
      );
    });
  });

  describe("updateDocumentStatusGenerated()", () => {
    it("deve aggiornare lo status del documento a generated", async () => {
      docRepo.update.mockResolvedValue(undefined);
      await expect(
        repo.updateDocumentStatusGenerated("doc-1"),
      ).resolves.not.toThrow();
      expect(docRepo.update).toHaveBeenCalledWith(
        { id: "doc-1" },
        { status: "generated" },
      );
    });
  });

  describe("deleteDocument()", () => {
    it("deve eliminare un documento", async () => {
      docRepo.delete.mockResolvedValue(undefined);
      await expect(repo.deleteDocument("doc-1")).resolves.not.toThrow();
      expect(docRepo.delete).toHaveBeenCalledWith({ id: "doc-1" });
    });
  });
});
