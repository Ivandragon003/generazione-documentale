import { Test, type TestingModule } from "@nestjs/testing";
import { DataSource, type EntityManager } from "typeorm";
import type { DocumentEntity } from "../src/entities/document.entity";
import type { TemplateEntity } from "../src/entities/template.entity";
import { DocumentsRepository } from "../src/repository/documents.repository";
import { DocumentsService } from "../src/service/documents.service";
import { PdfJobsService } from "../src/service/pdf-jobs.service";
import { TemplatesService } from "../src/service/templates.service";

/**
 * Test supplementari per DocumentsService.
 * Coprono:
 * - mancata validazione UUID di templateId in create()
 * - comportamento update() con fieldValues parziale
 * - delete() con PDF cleanup che fallisce silenziosamente
 * - findAll() con tutti i filtri di status
 * - create() con content molto lungo ereditato dal template
 */

const runTransaction = (
  cbOrIsolation: ((manager: EntityManager) => Promise<unknown>) | string,
  maybeCb?: (manager: EntityManager) => Promise<unknown>,
): Promise<unknown> => {
  const cb = typeof cbOrIsolation === "function" ? cbOrIsolation : maybeCb;
  if (!cb) throw new Error("No callback");
  return cb({} as EntityManager);
};

const makeDoc = (overrides: Partial<DocumentEntity> = {}): DocumentEntity => ({
  id: "dddddddd-dddd-4ddd-dddd-dddddddddddd",
  name: "Test",
  template_id: "tttttttt-tttt-4ttt-tttt-tttttttttttt",
  content: "# {{titolo}}",
  field_values: { titolo: "X" },
  status: "draft",
  created_by: "system",
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

const makeTemplate = (): TemplateEntity & { content: string } => ({
  id: "tttttttt-tttt-4ttt-tttt-tttttttttttt",
  name: "Template",
  content: "# {{titolo}}",
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
});

describe("DocumentsService — edge cases aggiuntivi", () => {
  let service: DocumentsService;
  let documentsRepository: jest.Mocked<DocumentsRepository>;
  let templatesService: jest.Mocked<TemplatesService>;
  let pdfJobsService: jest.Mocked<PdfJobsService>;
  let dataSource: jest.Mocked<DataSource>;

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
          useValue: { findOne: jest.fn() },
        },
        {
          provide: PdfJobsService,
          useValue: { deleteGeneratedPdfsForDocument: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: { transaction: jest.fn() },
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

  afterEach(() => jest.resetAllMocks());

  // ── create() — validazione templateId ────────────────────────────────────

  describe("create() — validazione templateId", () => {
    it("propaga il 404 quando il templateId non corrisponde a nessun template", async () => {
      templatesService.findOne.mockResolvedValue(null);

      await expect(
        service.create({
          name: "Doc",
          templateId: "ffffffff-ffff-4fff-ffff-ffffffffffff",
        }),
      ).rejects.toMatchObject({ status: 404 });
    });

    it("copia il content del template nel documento creato", async () => {
      const tpl = makeTemplate();
      tpl.content = "# Titolo personalizzato\n\n{{corpo}}";
      templatesService.findOne.mockResolvedValue(tpl);
      dataSource.transaction.mockImplementation(runTransaction as never);
      documentsRepository.insertDocument.mockResolvedValue(makeDoc());

      await service.create({ name: "Nuovo", templateId: tpl.id });

      expect(documentsRepository.insertDocument).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ content: tpl.content }),
      );
    });

    it("non modifica il template originale dopo la creazione del documento", async () => {
      const tpl = makeTemplate();
      const originalContent = tpl.content;
      templatesService.findOne.mockResolvedValue(tpl);
      dataSource.transaction.mockImplementation(runTransaction as never);
      documentsRepository.insertDocument.mockResolvedValue(makeDoc());

      await service.create({ name: "Doc", templateId: tpl.id });

      expect(tpl.content).toBe(originalContent);
    });
  });

  // ── update() — fieldValues edge ──────────────────────────────────────────

  describe("update() — fieldValues edge cases", () => {
    it("quando fieldValues è undefined, preserva i valori esistenti", async () => {
      const existing = makeDoc({ field_values: { titolo: "Originale" } });
      documentsRepository.findById.mockResolvedValue(existing);
      dataSource.transaction.mockImplementation(runTransaction as never);
      documentsRepository.updateDocument.mockResolvedValue(existing);

      await service.update(existing.id, { name: "Nuovo nome" });

      expect(documentsRepository.updateDocument).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ fieldValues: { titolo: "Originale" } }),
      );
    });

    it("quando fieldValues è oggetto vuoto {}, lo usa (override a vuoto è intenzionale)", async () => {
      const existing = makeDoc({ field_values: { titolo: "Originale" } });
      documentsRepository.findById.mockResolvedValue(existing);
      dataSource.transaction.mockImplementation(runTransaction as never);
      documentsRepository.updateDocument.mockResolvedValue(existing);

      await service.update(existing.id, { fieldValues: {} });

      expect(documentsRepository.updateDocument).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ fieldValues: {} }),
      );
    });

    it("rifiuta fieldValues come stringa (tipo non valido)", async () => {
      documentsRepository.findById.mockResolvedValue(makeDoc());

      await expect(
        service.update(makeDoc().id, {
          fieldValues: "stringa" as unknown as Record<string, string>,
        }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it("accetta fieldValues con chiavi che hanno underscore e numeri", async () => {
      const existing = makeDoc();
      documentsRepository.findById.mockResolvedValue(existing);
      dataSource.transaction.mockImplementation(runTransaction as never);
      documentsRepository.updateDocument.mockResolvedValue(existing);

      const fv = { campo_1: "val", campo_2: 42, flag_ok: true };
      await service.update(existing.id, { fieldValues: fv });

      expect(documentsRepository.updateDocument).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ fieldValues: fv }),
      );
    });
  });

  // ── delete() — pulizia PDF con errori ────────────────────────────────────

  describe("delete() — gestione errori cleanup PDF", () => {
    it("lancia errore se deleteGeneratedPdfsForDocument fallisce", async () => {
      documentsRepository.findById.mockResolvedValue(makeDoc());
      pdfJobsService.deleteGeneratedPdfsForDocument.mockRejectedValue(
        new Error("Storage non raggiungibile"),
      );

      await expect(service.delete(makeDoc().id)).rejects.toThrow(
        "Storage non raggiungibile",
      );
    });

    it("non chiama deleteDocument se il cleanup PDF fallisce", async () => {
      documentsRepository.findById.mockResolvedValue(makeDoc());
      pdfJobsService.deleteGeneratedPdfsForDocument.mockRejectedValue(
        new Error("Cleanup fallito"),
      );

      await expect(service.delete(makeDoc().id)).rejects.toThrow();
      expect(documentsRepository.deleteDocument).not.toHaveBeenCalled();
    });
  });

  // ── findAll() — tutti i valori di status ─────────────────────────────────

  describe("findAll() — filtri status completi", () => {
    const statuses = ["draft", "generated", "published", "archived"] as const;

    for (const status of statuses) {
      it(`filtra correttamente per status "${status}"`, async () => {
        documentsRepository.findAll.mockResolvedValue({ data: [], total: 0 });

        await service.findAll({ status, limit: 10, offset: 0 });

        expect(documentsRepository.findAll).toHaveBeenCalledWith(
          expect.objectContaining({ status }),
        );
      });
    }

    it("passa undefined come status quando non specificato", async () => {
      documentsRepository.findAll.mockResolvedValue({ data: [], total: 0 });

      await service.findAll({ limit: 10, offset: 0 });

      expect(documentsRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ status: undefined }),
      );
    });
  });

  // ── findAll() — paginazione con default ──────────────────────────────────

  describe("findAll() — paginazione default", () => {
    it("usa limit=20 e offset=0 come default se non specificati", async () => {
      documentsRepository.findAll.mockResolvedValue({ data: [], total: 0 });

      const result = await service.findAll({});

      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
      expect(documentsRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 20, offset: 0 }),
      );
    });

    it("propaga limit e offset personalizzati nel result", async () => {
      documentsRepository.findAll.mockResolvedValue({ data: [], total: 100 });

      const result = await service.findAll({ limit: 5, offset: 50 });

      expect(result.limit).toBe(5);
      expect(result.offset).toBe(50);
    });
  });

  // ── findOne() — comportamento su document con template nullato ───────────

  describe("findOne() — document con template eliminato", () => {
    it("restituisce il documento anche se template_id è null (template rimosso)", async () => {
      const doc = makeDoc({ template_id: null });
      documentsRepository.findById.mockResolvedValue(doc);

      const result = await service.findOne(doc.id);

      expect(result).not.toBeNull();
      expect(result?.template_id).toBeNull();
    });
  });
});
