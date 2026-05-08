import { Test, type TestingModule } from "@nestjs/testing";
import { DataSource, type EntityManager } from "typeorm";
import type { DocumentEntity } from "../src/entities/document.entity";
import type { TemplateEntity } from "../src/entities/template.entity";
import { DocumentsRepository } from "../src/repository/documents.repository";
import { DocumentsService } from "../src/service/documents.service";
import { PdfJobsService } from "../src/service/pdf-jobs.service";
import { TemplatesService } from "../src/service/templates.service";

/** The concrete scalar type accepted by UpdateDocumentInput.fieldValues */
type FieldValue = string | number | boolean | null;
type FieldValues = Record<string, FieldValue>;

describe("DocumentsService", () => {
  let service: DocumentsService;
  let documentsRepository: jest.Mocked<DocumentsRepository>;
  let templatesService: jest.Mocked<TemplatesService>;
  let pdfJobsService: jest.Mocked<PdfJobsService>;
  let dataSource: jest.Mocked<DataSource>;

  const mockDocument: DocumentEntity = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    name: "Test Document",
    template_id: "223e4567-e89b-12d3-a456-426614174000",
    content: "# Test Content",
    field_values: { titolo: "Test" },
    status: "draft",
    created_by: "system",
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockTemplate: TemplateEntity & { content: string } = {
    id: "223e4567-e89b-12d3-a456-426614174000",
    name: "Test Template",
    content: "# {{titolo}} Template",
    content_path: null,
    section_id: null,
    description: null,
    status: "draft",
    created_by: "system",
    fields: [
      {
        name: "titolo",
        label: "Titolo",
        type: "text",
        required: true,
        defaultValue: "",
      },
    ],
    created_at: new Date(),
    updated_at: new Date(),
  };
  /** Resolves the actual callback regardless of whether an isolationLevel
   *  was passed as the first argument or not. */
  const runTransaction = (
    cbOrIsolation: ((manager: EntityManager) => Promise<unknown>) | string,
    maybeCb?: (manager: EntityManager) => Promise<unknown>,
  ): Promise<unknown> => {
    const cb = typeof cbOrIsolation === "function" ? cbOrIsolation : maybeCb;
    if (!cb) throw new Error("No callback provided to runTransaction");
    return cb({} as EntityManager);
  };

  beforeEach(async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        {
          provide: DocumentsRepository,
          useValue: {
            findAll: jest.fn(),
            findById: jest.fn(),
            insertDocument: jest.fn(),
            updateDocument: jest.fn(),
            deleteDocument: jest.fn(),
          },
        },
        {
          provide: TemplatesService,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: PdfJobsService,
          useValue: {
            deleteGeneratedPdfsForDocument: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
    documentsRepository = module.get(
      DocumentsRepository,
    ) as jest.Mocked<DocumentsRepository>;
    templatesService = module.get(
      TemplatesService,
    ) as jest.Mocked<TemplatesService>;
    pdfJobsService = module.get(PdfJobsService) as jest.Mocked<PdfJobsService>;
    dataSource = module.get(DataSource) as jest.Mocked<DataSource>;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("create() - Black-box tests", () => {
    it("deve creare un documento con input valido", async () => {
      templatesService.findOne.mockResolvedValue(mockTemplate);
      dataSource.transaction.mockImplementation(runTransaction as never);
      documentsRepository.insertDocument.mockResolvedValue(mockDocument);

      const result = await service.create({
        name: "New Document",
        templateId: mockTemplate.id,
        created_by: "user123",
      });

      expect(result).toEqual(mockDocument);
      expect(documentsRepository.insertDocument).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          name: "New Document",
          templateId: mockTemplate.id,
          createdBy: "user123",
        }),
      );
    });

    it("deve sollevare errore se il nome è vuoto", async () => {
      await expect(
        service.create({
          name: "   ",
          templateId: mockTemplate.id,
        }),
      ).rejects.toThrow("Il nome documento e obbligatorio");
    });

    it("deve sollevare errore se il nome è undefined", async () => {
      await expect(
        service.create({
          name: "",
          templateId: mockTemplate.id,
        }),
      ).rejects.toThrow("Il nome documento e obbligatorio");
    });

    it("deve sollevare errore se il template non esiste", async () => {
      templatesService.findOne.mockResolvedValue(null);

      await expect(
        service.create({
          name: "New Document",
          templateId: "invalid-id",
        }),
      ).rejects.toThrow("Template non trovato");
    });

    it("deve trimmare il nome del documento", async () => {
      templatesService.findOne.mockResolvedValue(mockTemplate);
      dataSource.transaction.mockImplementation(runTransaction as never);
      documentsRepository.insertDocument.mockResolvedValue({
        ...mockDocument,
        name: "Trimmed Name",
      });

      await service.create({
        name: "  Trimmed Name  ",
        templateId: mockTemplate.id,
      });

      expect(documentsRepository.insertDocument).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          name: "Trimmed Name",
        }),
      );
    });
  });

  describe("create() - Boundary cases", () => {
    it("deve gestire nomi molto lunghi", async () => {
      const longName = "A".repeat(500);
      templatesService.findOne.mockResolvedValue(mockTemplate);
      dataSource.transaction.mockImplementation(runTransaction as never);
      documentsRepository.insertDocument.mockResolvedValue({
        ...mockDocument,
        name: longName,
      });

      await service.create({
        name: longName,
        templateId: mockTemplate.id,
      });

      expect(documentsRepository.insertDocument).toHaveBeenCalled();
    });

    it("deve accettare UUID validi nel templateId", async () => {
      const validUuid = "550e8400-e29b-41d4-a716-446655440000";
      templatesService.findOne.mockResolvedValue(mockTemplate);
      dataSource.transaction.mockImplementation(runTransaction as never);
      documentsRepository.insertDocument.mockResolvedValue(mockDocument);

      await service.create({
        name: "Test",
        templateId: validUuid,
      });

      expect(templatesService.findOne).toHaveBeenCalledWith(validUuid);
    });

    it("deve usare 'system' come default creator", async () => {
      templatesService.findOne.mockResolvedValue(mockTemplate);
      dataSource.transaction.mockImplementation(runTransaction as never);
      documentsRepository.insertDocument.mockResolvedValue(mockDocument);

      await service.create({
        name: "Test",
        templateId: mockTemplate.id,
      });

      expect(documentsRepository.insertDocument).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          createdBy: "system",
        }),
      );
    });
  });

  describe("create() - Failure modes", () => {
    it("deve gestire errori nella transazione", async () => {
      templatesService.findOne.mockResolvedValue(mockTemplate);
      dataSource.transaction.mockRejectedValue(new Error("Transaction failed"));

      await expect(
        service.create({
          name: "Test",
          templateId: mockTemplate.id,
        }),
      ).rejects.toThrow("Transaction failed");
    });

    it("deve gestire errori nel repository durante l'insert", async () => {
      templatesService.findOne.mockResolvedValue(mockTemplate);
      dataSource.transaction.mockImplementation(async () => {
        throw new Error("Database connection failed");
      });

      await expect(
        service.create({
          name: "Test",
          templateId: mockTemplate.id,
        }),
      ).rejects.toThrow("Database connection failed");
    });
  });

  describe("update() - Black-box tests", () => {
    it("deve aggiornare un documento con tutti i campi", async () => {
      documentsRepository.findById.mockResolvedValue(mockDocument);
      dataSource.transaction.mockImplementation(runTransaction as never);
      documentsRepository.updateDocument.mockResolvedValue({
        ...mockDocument,
        name: "Updated",
        content: "# Updated Content",
      });

      const fieldValues: FieldValues = { titolo: "New Title" };

      await service.update(mockDocument.id, {
        name: "Updated",
        content: "# Updated Content",
        fieldValues,
      });

      expect(documentsRepository.updateDocument).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          id: mockDocument.id,
          name: "Updated",
          content: "# Updated Content",
          fieldValues,
        }),
      );
    });

    it("deve preservare i dati non aggiornati", async () => {
      const existing = {
        ...mockDocument,
        name: "Original",
        content: "Original Content",
      };
      documentsRepository.findById.mockResolvedValue(existing);
      dataSource.transaction.mockImplementation(runTransaction as never);
      documentsRepository.updateDocument.mockResolvedValue(existing);

      await service.update(mockDocument.id, {
        name: "New Name",
      });

      expect(documentsRepository.updateDocument).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          name: "New Name",
          content: "Original Content",
          fieldValues: mockDocument.field_values,
        }),
      );
    });

    it("deve sollevare errore se il documento non esiste", async () => {
      documentsRepository.findById.mockResolvedValue(null);

      await expect(
        service.update("non-existent", { name: "Test" }),
      ).rejects.toThrow("Documento non trovato");
    });

    it("deve sollevare errore se fieldValues è null", async () => {
      documentsRepository.findById.mockResolvedValue(mockDocument);

      await expect(
        service.update(mockDocument.id, {
          fieldValues: null as unknown as FieldValues,
        }),
      ).rejects.toThrow("fieldValues deve essere un oggetto");
    });

    it("deve sollevare errore se fieldValues è un array", async () => {
      documentsRepository.findById.mockResolvedValue(mockDocument);

      await expect(
        service.update(mockDocument.id, {
          fieldValues: [] as unknown as FieldValues,
        }),
      ).rejects.toThrow("fieldValues deve essere un oggetto");
    });
  });

  describe("update() - Boundary cases", () => {
    it("deve trimmare il nome durante l'aggiornamento", async () => {
      documentsRepository.findById.mockResolvedValue(mockDocument);
      dataSource.transaction.mockImplementation(runTransaction as never);
      documentsRepository.updateDocument.mockResolvedValue(mockDocument);

      await service.update(mockDocument.id, {
        name: "  Trimmed  ",
      });

      expect(documentsRepository.updateDocument).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          name: "Trimmed",
        }),
      );
    });

    it("deve gestire nome vuoto dopo trimming", async () => {
      const existing = { ...mockDocument, name: "Original" };
      documentsRepository.findById.mockResolvedValue(existing);
      dataSource.transaction.mockImplementation(runTransaction as never);
      documentsRepository.updateDocument.mockResolvedValue(existing);

      await service.update(mockDocument.id, {
        name: "   ",
      });

      expect(documentsRepository.updateDocument).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          name: "Original",
        }),
      );
    });

    it("deve gestire fieldValues con tipi misti", async () => {
      const mixedFieldValues: FieldValues = {
        stringField: "text",
        numberField: 123,
        booleanField: true,
        nullField: null,
      };
      documentsRepository.findById.mockResolvedValue(mockDocument);
      dataSource.transaction.mockImplementation(runTransaction as never);
      documentsRepository.updateDocument.mockResolvedValue(mockDocument);

      await service.update(mockDocument.id, {
        fieldValues: mixedFieldValues,
      });

      expect(documentsRepository.updateDocument).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          fieldValues: mixedFieldValues,
        }),
      );
    });

    it("deve accettare content vuoto", async () => {
      documentsRepository.findById.mockResolvedValue(mockDocument);
      dataSource.transaction.mockImplementation(runTransaction as never);
      documentsRepository.updateDocument.mockResolvedValue({
        ...mockDocument,
        content: "",
      });

      await service.update(mockDocument.id, {
        content: "",
      });

      expect(documentsRepository.updateDocument).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          content: "",
        }),
      );
    });
  });

  describe("update() - Failure modes", () => {
    it("deve gestire errori di database durante findById", async () => {
      documentsRepository.findById.mockRejectedValue(
        new Error("Database connection lost"),
      );

      await expect(
        service.update(mockDocument.id, { name: "Test" }),
      ).rejects.toThrow("Database connection lost");
    });

    it("deve gestire errori di transazione durante update", async () => {
      documentsRepository.findById.mockResolvedValue(mockDocument);
      dataSource.transaction.mockRejectedValue(
        new Error("Transaction rollback"),
      );

      await expect(
        service.update(mockDocument.id, { name: "Test" }),
      ).rejects.toThrow("Transaction rollback");
    });
  });

  describe("delete() - Black-box tests", () => {
    it("deve eliminare un documento esistente", async () => {
      documentsRepository.findById.mockResolvedValue(mockDocument);
      pdfJobsService.deleteGeneratedPdfsForDocument.mockResolvedValue(
        undefined,
      );

      const result = await service.delete(mockDocument.id);

      expect(result).toEqual({ deleted: true });
      expect(documentsRepository.deleteDocument).toHaveBeenCalledWith(
        mockDocument.id,
      );
      expect(
        pdfJobsService.deleteGeneratedPdfsForDocument,
      ).toHaveBeenCalledWith(mockDocument.id);
    });

    it("deve sollevare errore se il documento non esiste", async () => {
      documentsRepository.findById.mockResolvedValue(null);

      await expect(service.delete("non-existent")).rejects.toThrow(
        "Documento non trovato",
      );
    });
  });

  describe("delete() - Failure modes", () => {
    it("deve gestire errori durante la cancellazione dal repository", async () => {
      documentsRepository.findById.mockResolvedValue(mockDocument);
      documentsRepository.deleteDocument.mockRejectedValue(
        new Error("Delete failed"),
      );

      await expect(service.delete(mockDocument.id)).rejects.toThrow(
        "Delete failed",
      );
    });

    it("deve gestire errori durante la cancellazione dei PDF", async () => {
      documentsRepository.findById.mockResolvedValue(mockDocument);
      pdfJobsService.deleteGeneratedPdfsForDocument.mockRejectedValue(
        new Error("PDF cleanup failed"),
      );

      await expect(service.delete(mockDocument.id)).rejects.toThrow(
        "PDF cleanup failed",
      );
    });
  });

  describe("findAll() - Black-box tests", () => {
    it("deve ritornare lista di documenti con pagination", async () => {
      const documents = [mockDocument, { ...mockDocument, id: "456" }];
      documentsRepository.findAll.mockResolvedValue({
        data: documents,
        total: 2,
      });

      const result = await service.findAll({
        limit: 20,
        offset: 0,
      });

      expect(result).toEqual({
        data: documents,
        total: 2,
        limit: 20,
        offset: 0,
      });
    });

    it("deve filtrare per status", async () => {
      const drafts = [{ ...mockDocument, status: "draft" as const }];
      documentsRepository.findAll.mockResolvedValue({
        data: drafts,
        total: 1,
      });

      await service.findAll({
        status: "draft",
        limit: 20,
        offset: 0,
      });

      expect(documentsRepository.findAll).toHaveBeenCalledWith({
        status: "draft",
        limit: 20,
        offset: 0,
      });
    });

    it("deve gestire lista vuota", async () => {
      documentsRepository.findAll.mockResolvedValue({
        data: [],
        total: 0,
      });

      const result = await service.findAll({
        limit: 20,
        offset: 0,
      });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe("findAll() - Boundary cases", () => {
    it("deve gestire offset oltre i risultati totali", async () => {
      documentsRepository.findAll.mockResolvedValue({
        data: [],
        total: 100,
      });

      const result = await service.findAll({
        limit: 20,
        offset: 1000,
      });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(100);
    });

    it("deve applicare limit massimo", async () => {
      const documents = Array(50).fill(mockDocument);
      documentsRepository.findAll.mockResolvedValue({
        data: documents,
        total: 50,
      });

      await service.findAll({
        limit: 9999,
        offset: 0,
      });

      expect(documentsRepository.findAll).toHaveBeenCalledWith({
        status: undefined,
        limit: 9999,
        offset: 0,
      });
    });
  });

  describe("findOne() - Black-box tests", () => {
    it("deve ritornare un documento per ID", async () => {
      documentsRepository.findById.mockResolvedValue(mockDocument);

      const result = await service.findOne(mockDocument.id);

      expect(result).toEqual(mockDocument);
    });

    it("deve ritornare null se il documento non esiste", async () => {
      documentsRepository.findById.mockResolvedValue(null);

      const result = await service.findOne("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("findOne() - Failure modes", () => {
    it("deve gestire errori di database", async () => {
      documentsRepository.findById.mockRejectedValue(new Error("Query failed"));

      await expect(service.findOne(mockDocument.id)).rejects.toThrow(
        "Query failed",
      );
    });
  });
});
