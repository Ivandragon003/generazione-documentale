import { Test, type TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import type { DeleteResult, EntityManager, Repository } from "typeorm";
import { DocumentEntity } from "../src/entities/document.entity";
import { PdfJobEntity } from "../src/entities/pdf-job.entity";
import { DocumentsRepository } from "../src/repository/documents.repository";

// Factory: riduce i blocchi mockManager duplicati in ogni test
function makeMockManager(
  overrides: Partial<{
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    findOne: jest.Mock;
  }> = {},
): EntityManager {
  return {
    create: overrides.create ?? jest.fn(),
    save: overrides.save ?? jest.fn(),
    update: overrides.update ?? jest.fn(),
    findOne: overrides.findOne ?? jest.fn(),
  } as unknown as EntityManager;
}

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

      const result = await repository.findAll({ limit: 20, offset: 0 });

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

      await repository.findAll({ limit: 20, offset: 0 });

      expect(documentRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ order: { updated_at: "DESC" } }),
      );
    });

    it("deve gestire lista vuota", async () => {
      documentRepository.findAndCount.mockResolvedValue([[], 0]);

      const result = await repository.findAll({ limit: 20, offset: 0 });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe("findAll() - Boundary cases", () => {
    it("deve gestire limite molto grande", async () => {
      const documents = Array(9999).fill(mockDocument);
      documentRepository.findAndCount.mockResolvedValue([documents, 9999]);

      await repository.findAll({ limit: 9999, offset: 0 });

      expect(documentRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 9999 }),
      );
    });

    it("deve gestire offset oltre i risultati", async () => {
      documentRepository.findAndCount.mockResolvedValue([[], 50]);

      const result = await repository.findAll({ limit: 20, offset: 1000 });

      expect(documentRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 1000 }),
      );
      expect(result.data).toEqual([]);
    });

    it("deve applicare tutti gli status come where vuoto", async () => {
      documentRepository.findAndCount.mockResolvedValue([[mockDocument], 1]);

      await repository.findAll({ status: undefined, limit: 20, offset: 0 });

      expect(documentRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });
  });

  describe("findAll() - Failure modes", () => {
    it("deve gestire errori di database", async () => {
      documentRepository.findAndCount.mockRejectedValue(
        new Error("Database connection failed"),
      );

      await expect(
        repository.findAll({ limit: 20, offset: 0 }),
      ).rejects.toThrow("Database connection failed");
    });

    it("deve gestire timeout di query", async () => {
      documentRepository.findAndCount.mockRejectedValue(
        new Error("Query timeout"),
      );

      await expect(
        repository.findAll({ limit: 20, offset: 0 }),
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

      expect(await repository.findById("non-existent")).toBeNull();
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
      documentRepository.findOne.mockResolvedValue(null);

      expect(await repository.findById("not-a-uuid")).toBeNull();
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

  // Payload base per insertDocument riutilizzato piu volte
  const baseInsertPayload = {
    name: "Test",
    templateId: "template-id",
    content: "# Content",
    createdBy: "system",
  } as const;

  describe("insertDocument() - Black-box tests", () => {
    it("deve creare e salvare un documento", async () => {
      const manager = makeMockManager({
        create: jest.fn().mockReturnValue(mockDocument),
        save: jest.fn().mockResolvedValue(mockDocument),
      });

      const result = await repository.insertDocument(manager, {
        ...baseInsertPayload,
        createdBy: "user",
      });

      expect(result).toEqual(mockDocument);
      expect(manager.create).toHaveBeenCalledWith(
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
      expect(manager.save).toHaveBeenCalled();
    });

    it("deve gestire campi obbligatori", async () => {
      const manager = makeMockManager({
        create: jest.fn().mockReturnValue(mockDocument),
        save: jest.fn().mockResolvedValue(mockDocument),
      });

      await repository.insertDocument(manager, baseInsertPayload);

      expect(manager.create).toHaveBeenCalledWith(
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
      const manager = makeMockManager({
        create: jest.fn().mockReturnValue({ ...mockDocument, name: longName }),
        save: jest.fn().mockResolvedValue({ ...mockDocument, name: longName }),
      });

      await repository.insertDocument(manager, {
        ...baseInsertPayload,
        name: longName,
      });

      expect(manager.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ name: longName }),
      );
    });

    it("deve inizializzare field_values come oggetto vuoto", async () => {
      const manager = makeMockManager({
        create: jest.fn().mockReturnValue(mockDocument),
        save: jest.fn().mockResolvedValue(mockDocument),
      });

      await repository.insertDocument(manager, baseInsertPayload);

      expect(manager.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ field_values: {} }),
      );
    });
  });

  describe("insertDocument() - Failure modes", () => {
    it("deve gestire errori di database durante save", async () => {
      const manager = makeMockManager({
        create: jest.fn().mockReturnValue(mockDocument),
        save: jest.fn().mockRejectedValue(new Error("Unique constraint violation")),
      });

      await expect(
        repository.insertDocument(manager, baseInsertPayload),
      ).rejects.toThrow("Unique constraint violation");
    });

    it("deve gestire errori di creazione", async () => {
      const manager = makeMockManager({
        create: jest.fn().mockImplementation(() => {
          throw new Error("Invalid entity");
        }),
        save: jest.fn(),
      });

      await expect(
        repository.insertDocument(manager, baseInsertPayload),
      ).rejects.toThrow("Invalid entity");
    });
  });

  describe("updateDocument() - Black-box tests", () => {
    it("deve aggiornare un documento", async () => {
      const manager = makeMockManager({
        update: jest.fn().mockResolvedValue({}),
        findOne: jest.fn().mockResolvedValue(mockDocument),
      });

      await repository.updateDocument(manager, {
        id: mockDocument.id,
        name: "Updated",
        content: "# Updated",
        fieldValues: { titolo: "New" },
      });

      expect(manager.update).toHaveBeenCalledWith(
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
      const manager = makeMockManager({
        update: jest.fn().mockRejectedValue(new Error("Update failed")),
        findOne: jest.fn(),
      });

      await expect(
        repository.updateDocument(manager, {
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

    it("deve gestire vincoli di integrita referenziale", async () => {
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
      const manager = makeMockManager({
        create: jest.fn().mockReturnValue(mockDocument),
        save: jest.fn().mockResolvedValue(mockDocument),
        update: jest.fn().mockResolvedValue({}),
        findOne: jest.fn().mockResolvedValue(mockDocument),
      });

      documentRepository.findOne.mockResolvedValue(mockDocument);
      documentRepository.delete.mockResolvedValue({
        affected: 1,
        raw: [],
      } satisfies DeleteResult);

      const created = await repository.insertDocument(manager, baseInsertPayload);
      expect(created).toBeDefined();

      const found = await repository.findById(created.id);
      expect(found).toEqual(mockDocument);

      await repository.updateDocument(manager, {
        id: created.id,
        name: "Updated",
        content: "# Updated",
        fieldValues: { titolo: "New" },
      });
      expect(manager.update).toHaveBeenCalled();

      await repository.deleteDocument(created.id);
      expect(documentRepository.delete).toHaveBeenCalledWith({
        id: created.id,
      });
    });

    it("deve gestire errori in qualsiasi fase del CRUD", async () => {
      const manager = makeMockManager({
        create: jest.fn().mockReturnValue(mockDocument),
        save: jest.fn().mockRejectedValue(new Error("DB Error")),
      });

      await expect(
        repository.insertDocument(manager, baseInsertPayload),
      ).rejects.toThrow("DB Error");
    });
  });

  describe("Edge cases - Race conditions", () => {
    it("deve gestire multiple operazioni concorrenti su stesso ID", async () => {
      const manager = makeMockManager({
        update: jest.fn().mockResolvedValue({}),
        findOne: jest.fn().mockResolvedValue(mockDocument),
      });

      const promises = Array(5)
        .fill(0)
        .map(() =>
          repository.updateDocument(manager, {
            id: mockDocument.id,
            name: "Updated",
            content: "# Content",
            fieldValues: {},
          }),
        );

      await Promise.all(promises);

      expect(manager.update).toHaveBeenCalledTimes(5);
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

      const manager = makeMockManager({
        update: jest.fn().mockResolvedValue({}),
        findOne: jest.fn().mockResolvedValue(mockDocument),
      });

      await repository.updateDocument(manager, {
        id: mockDocument.id,
        name: "Test",
        content: "# Content",
        fieldValues: complexFieldValues,
      });

      expect(manager.update).toHaveBeenCalledWith(
        DocumentEntity,
        expect.anything(),
        expect.objectContaining({ field_values: complexFieldValues }),
      );
    });

    it("deve gestire field_values molto grande", async () => {
      const largeFieldValues = Object.fromEntries(
        Array(1000)
          .fill(0)
          .map((_, i) => [`campo${i}`, `value${i}`]),
      );

      const manager = makeMockManager({
        update: jest.fn().mockResolvedValue({}),
        findOne: jest.fn().mockResolvedValue(mockDocument),
      });

      await repository.updateDocument(manager, {
        id: mockDocument.id,
        name: "Test",
        content: "# Content",
        fieldValues: largeFieldValues,
      });

      expect(manager.update).toHaveBeenCalled();
    });
  });
});
