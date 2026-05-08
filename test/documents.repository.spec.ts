import { Test, type TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import type { DeleteResult, EntityManager, Repository } from "typeorm";
import { DocumentEntity } from "../src/entities/document.entity";
import { PdfJobEntity } from "../src/entities/pdf-job.entity";
import { DocumentsRepository } from "../src/repository/documents.repository";

describe("DocumentsRepository", () => {
  let repository: DocumentsRepository;
  let documentRepository: jest.Mocked<Repository<DocumentEntity>>;
  let pdfJobRepository: jest.Mocked<Repository<PdfJobEntity>>;

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

  beforeEach(async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsRepository,
        {
          provide: getRepositoryToken(DocumentEntity),
          useValue: {
            findAndCount: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(PdfJobEntity),
          useValue: {
            find: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    repository = module.get<DocumentsRepository>(DocumentsRepository);
    documentRepository = module.get(
      getRepositoryToken(DocumentEntity),
    ) as jest.Mocked<Repository<DocumentEntity>>;
    pdfJobRepository = module.get(
      getRepositoryToken(PdfJobEntity),
    ) as jest.Mocked<Repository<PdfJobEntity>>;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("findAll() - Black-box tests", () => {
    it("deve ritornare documenti con paginazione", async () => {
      const documents = [mockDocument, { ...mockDocument, id: "456" }];
      documentRepository.findAndCount.mockResolvedValue([documents, 2]);

      const result = await repository.findAll({
        limit: 20,
        offset: 0,
      });

      expect(result.data).toEqual(documents);
      expect(result.total).toBe(2);
    });

    it("deve filtrare per status", async () => {
      const drafts = [{ ...mockDocument, status: "draft" as const }];
      documentRepository.findAndCount.mockResolvedValue([drafts, 1]);

      const result = await repository.findAll({
        status: "draft",
        limit: 20,
        offset: 0,
      });

      expect(documentRepository.findAndCount).toHaveBeenCalledWith({
        where: { status: "draft" },
        order: { updated_at: "DESC" },
        take: 20,
        skip: 0,
      });
      expect(result.total).toBe(1);
    });

    it("deve ordinare per updated_at descending", async () => {
      documentRepository.findAndCount.mockResolvedValue([[], 0]);

      await repository.findAll({
        limit: 20,
        offset: 0,
      });

      expect(documentRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { updated_at: "DESC" },
        }),
      );
    });

    it("deve gestire lista vuota", async () => {
      documentRepository.findAndCount.mockResolvedValue([[], 0]);

      const result = await repository.findAll({
        limit: 20,
        offset: 0,
      });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe("findAll() - Boundary cases", () => {
    it("deve gestire limite molto grande", async () => {
      const documents = Array(9999).fill(mockDocument);
      documentRepository.findAndCount.mockResolvedValue([documents, 9999]);

      await repository.findAll({
        limit: 9999,
        offset: 0,
      });

      expect(documentRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 9999,
        }),
      );
    });

    it("deve gestire offset oltre i risultati", async () => {
      documentRepository.findAndCount.mockResolvedValue([[], 50]);

      const result = await repository.findAll({
        limit: 20,
        offset: 1000,
      });

      expect(documentRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 1000,
        }),
      );
      expect(result.data).toEqual([]);
    });

    it("deve applicare tutti gli status come where vuoto", async () => {
      documentRepository.findAndCount.mockResolvedValue([[mockDocument], 1]);

      await repository.findAll({
        status: undefined,
        limit: 20,
        offset: 0,
      });

      expect(documentRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        }),
      );
    });
  });

  describe("findAll() - Failure modes", () => {
    it("deve gestire errori di database", async () => {
      documentRepository.findAndCount.mockRejectedValue(
        new Error("Database connection failed"),
      );

      await expect(
        repository.findAll({
          limit: 20,
          offset: 0,
        }),
      ).rejects.toThrow("Database connection failed");
    });

    it("deve gestire timeout di query", async () => {
      documentRepository.findAndCount.mockRejectedValue(
        new Error("Query timeout"),
      );

      await expect(
        repository.findAll({
          limit: 20,
          offset: 0,
        }),
      ).rejects.toThrow("Query timeout");
    });
  });

  describe("findById() - Black-box tests", () => {
    it("deve ritornare un documento per ID", async () => {
      documentRepository.findOne.mockResolvedValue(mockDocument);

      const result = await repository.findById(mockDocument.id);

      expect(result).toEqual(mockDocument);
      expect(documentRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockDocument.id },
      });
    });

    it("deve ritornare null se non trovato", async () => {
      documentRepository.findOne.mockResolvedValue(null);

      const result = await repository.findById("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("findById() - Boundary cases", () => {
    it("deve gestire UUID validi", async () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      documentRepository.findOne.mockResolvedValue(mockDocument);

      await repository.findById(uuid);

      expect(documentRepository.findOne).toHaveBeenCalledWith({
        where: { id: uuid },
      });
    });

    it("deve gestire query di ID malformati", async () => {
      const malformedId = "not-a-uuid";
      documentRepository.findOne.mockResolvedValue(null);

      const result = await repository.findById(malformedId);

      expect(result).toBeNull();
    });
  });

  describe("findById() - Failure modes", () => {
    it("deve gestire errori di database", async () => {
      documentRepository.findOne.mockRejectedValue(
        new Error("Connection lost"),
      );

      await expect(repository.findById(mockDocument.id)).rejects.toThrow(
        "Connection lost",
      );
    });
  });

  describe("insertDocument() - Black-box tests", () => {
    it("deve creare e salvare un documento", async () => {
      const mockManager = {
        create: jest.fn().mockReturnValue(mockDocument),
        save: jest.fn().mockResolvedValue(mockDocument),
      } as unknown as EntityManager;

      const result = await repository.insertDocument(mockManager, {
        name: "Test",
        templateId: "template-id",
        content: "# Content",
        createdBy: "user",
      });

      expect(result).toEqual(mockDocument);
      expect(mockManager.create).toHaveBeenCalledWith(
        DocumentEntity,
        expect.objectContaining({
          name: "Test",
          template_id: "template-id",
          content: "# Content",
          created_by: "user",
          status: "draft",
          field_values: {},
        }),
      );
      expect(mockManager.save).toHaveBeenCalled();
    });

    it("deve gestire campi obbligatori", async () => {
      const mockManager = {
        create: jest.fn().mockReturnValue(mockDocument),
        save: jest.fn().mockResolvedValue(mockDocument),
      } as unknown as EntityManager;

      await repository.insertDocument(mockManager, {
        name: "Test",
        templateId: "template-id",
        content: "# Content",
        createdBy: "system",
      });

      expect(mockManager.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          name: "Test",
          template_id: "template-id",
          content: "# Content",
          created_by: "system",
          status: "draft",
        }),
      );
    });
  });

  describe("insertDocument() - Boundary cases", () => {
    it("deve gestire nomi molto lunghi", async () => {
      const longName = "A".repeat(500);
      const mockManager = {
        create: jest.fn().mockReturnValue({ ...mockDocument, name: longName }),
        save: jest.fn().mockResolvedValue({ ...mockDocument, name: longName }),
      } as unknown as EntityManager;

      await repository.insertDocument(mockManager, {
        name: longName,
        templateId: "template-id",
        content: "# Content",
        createdBy: "system",
      });

      expect(mockManager.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ name: longName }),
      );
    });

    it("deve inizializzare field_values come oggetto vuoto", async () => {
      const mockManager = {
        create: jest.fn().mockReturnValue(mockDocument),
        save: jest.fn().mockResolvedValue(mockDocument),
      } as unknown as EntityManager;

      await repository.insertDocument(mockManager, {
        name: "Test",
        templateId: "template-id",
        content: "# Content",
        createdBy: "system",
      });

      expect(mockManager.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ field_values: {} }),
      );
    });
  });

  describe("insertDocument() - Failure modes", () => {
    it("deve gestire errori di database durante save", async () => {
      const mockManager = {
        create: jest.fn().mockReturnValue(mockDocument),
        save: jest
          .fn()
          .mockRejectedValue(new Error("Unique constraint violation")),
      } as unknown as EntityManager;

      await expect(
        repository.insertDocument(mockManager, {
          name: "Test",
          templateId: "template-id",
          content: "# Content",
          createdBy: "system",
        }),
      ).rejects.toThrow("Unique constraint violation");
    });

    it("deve gestire errori di creazione", async () => {
      const mockManager = {
        create: jest.fn().mockImplementation(() => {
          throw new Error("Invalid entity");
        }),
        save: jest.fn(),
      } as unknown as EntityManager;

      await expect(
        repository.insertDocument(mockManager, {
          name: "Test",
          templateId: "template-id",
          content: "# Content",
          createdBy: "system",
        }),
      ).rejects.toThrow("Invalid entity");
    });
  });

  describe("updateDocument() - Black-box tests", () => {
    it("deve aggiornare un documento", async () => {
      const mockManager = {
        update: jest.fn().mockResolvedValue({}),
        findOne: jest.fn().mockResolvedValue(mockDocument),
      } as unknown as EntityManager;

      await repository.updateDocument(mockManager, {
        id: mockDocument.id,
        name: "Updated",
        content: "# Updated",
        fieldValues: { titolo: "New" },
      });

      expect(mockManager.update).toHaveBeenCalledWith(
        DocumentEntity,
        { id: mockDocument.id },
        expect.objectContaining({
          name: "Updated",
          content: "# Updated",
          field_values: { titolo: "New" },
        }),
      );
    });
  });

  describe("updateDocument() - Failure modes", () => {
    it("deve gestire errori di database durante update", async () => {
      const mockManager = {
        update: jest.fn().mockRejectedValue(new Error("Update failed")),
        findOne: jest.fn(),
      } as unknown as EntityManager;

      await expect(
        repository.updateDocument(mockManager, {
          id: mockDocument.id,
          name: "Updated",
          content: "# Content",
          fieldValues: {},
        }),
      ).rejects.toThrow("Update failed");
    });
  });

  describe("deleteDocument() - Black-box tests", () => {
    it("deve eliminare un documento", async () => {
      documentRepository.delete.mockResolvedValue({
        affected: 1,
        raw: [],
      } satisfies DeleteResult);

      await repository.deleteDocument(mockDocument.id);

      expect(documentRepository.delete).toHaveBeenCalledWith({
        id: mockDocument.id,
      });
    });

    it("deve gestire cancellazione di documento inesistente", async () => {
      documentRepository.delete.mockResolvedValue({
        affected: 0,
        raw: [],
      } satisfies DeleteResult);

      await repository.deleteDocument("non-existent");

      expect(documentRepository.delete).toHaveBeenCalledWith({
        id: "non-existent",
      });
    });
  });

  describe("deleteDocument() - Failure modes", () => {
    it("deve gestire errori di database durante delete", async () => {
      documentRepository.delete.mockRejectedValue(new Error("Delete failed"));

      await expect(repository.deleteDocument(mockDocument.id)).rejects.toThrow(
        "Delete failed",
      );
    });

    it("deve gestire vincoli di integrità referenziale", async () => {
      documentRepository.delete.mockRejectedValue(
        new Error("Foreign key constraint violation"),
      );

      await expect(repository.deleteDocument(mockDocument.id)).rejects.toThrow(
        "Foreign key constraint violation",
      );
    });
  });

  describe("Integration - Flusso completo CRUD", () => {
    it("deve eseguire un ciclo completo di create-read-update-delete", async () => {
      const mockManager = {
        create: jest.fn().mockReturnValue(mockDocument),
        save: jest.fn().mockResolvedValue(mockDocument),
        update: jest.fn().mockResolvedValue({}),
        findOne: jest.fn().mockResolvedValue(mockDocument),
      } as unknown as EntityManager;

      documentRepository.findOne.mockResolvedValue(mockDocument);
      documentRepository.delete.mockResolvedValue({
        affected: 1,
        raw: [],
      } satisfies DeleteResult);

      const created = await repository.insertDocument(mockManager, {
        name: "New",
        templateId: "template-id",
        content: "# Content",
        createdBy: "system",
      });
      expect(created).toBeDefined();

      const found = await repository.findById(created.id);
      expect(found).toEqual(mockDocument);

      await repository.updateDocument(mockManager, {
        id: created.id,
        name: "Updated",
        content: "# Updated",
        fieldValues: { titolo: "New" },
      });
      expect(mockManager.update).toHaveBeenCalled();

      await repository.deleteDocument(created.id);
      expect(documentRepository.delete).toHaveBeenCalledWith({
        id: created.id,
      });
    });

    it("deve gestire errori in qualsiasi fase del CRUD", async () => {
      const mockManager = {
        create: jest.fn().mockReturnValue(mockDocument),
        save: jest.fn().mockRejectedValue(new Error("DB Error")),
      } as unknown as EntityManager;

      await expect(
        repository.insertDocument(mockManager, {
          name: "Test",
          templateId: "template-id",
          content: "# Content",
          createdBy: "system",
        }),
      ).rejects.toThrow("DB Error");
    });
  });

  describe("Edge cases - Race conditions", () => {
    it("deve gestire multiple operazioni concorrenti su stesso ID", async () => {
      const mockManager = {
        update: jest.fn().mockResolvedValue({}),
        findOne: jest.fn().mockResolvedValue(mockDocument),
      } as unknown as EntityManager;

      const promises = Array(5)
        .fill(0)
        .map(() =>
          repository.updateDocument(mockManager, {
            id: mockDocument.id,
            name: "Updated",
            content: "# Content",
            fieldValues: {},
          }),
        );

      await Promise.all(promises);

      expect(mockManager.update).toHaveBeenCalledTimes(5);
    });
  });

  describe("Data validation at repository level", () => {
    it("deve preservare la struttura dei field_values", async () => {
      const complexFieldValues = {
        string: "text",
        number: 123,
        boolean: true,
        null: null,
      };

      const mockManager = {
        update: jest.fn().mockResolvedValue({}),
        findOne: jest.fn().mockResolvedValue(mockDocument),
      } as unknown as EntityManager;

      await repository.updateDocument(mockManager, {
        id: mockDocument.id,
        name: "Test",
        content: "# Content",
        fieldValues: complexFieldValues,
      });

      expect(mockManager.update).toHaveBeenCalledWith(
        DocumentEntity,
        expect.anything(),
        expect.objectContaining({
          field_values: complexFieldValues,
        }),
      );
    });

    it("deve gestire field_values molto grande", async () => {
      const largeFieldValues = Object.fromEntries(
        Array(1000)
          .fill(0)
          .map((_, i) => [`campo${i}`, `value${i}`]),
      );

      const mockManager = {
        update: jest.fn().mockResolvedValue({}),
        findOne: jest.fn().mockResolvedValue(mockDocument),
      } as unknown as EntityManager;

      await repository.updateDocument(mockManager, {
        id: mockDocument.id,
        name: "Test",
        content: "# Content",
        fieldValues: largeFieldValues,
      });

      expect(mockManager.update).toHaveBeenCalled();
    });
  });
});
