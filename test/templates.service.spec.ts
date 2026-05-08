import { Test, type TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import * as fsPromises from "node:fs/promises";
import { DataSource, type EntityManager } from "typeorm";
import type { TemplateEntity } from "../src/entities/template.entity";
import { TemplatesRepository } from "../src/repository/templates.repository";
import { TemplatesService } from "../src/service/templates.service";

// ── helpers ────────────────────────────────────────────────────────────────────
const uuid = () => randomUUID();
const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const SECTION_UUID = "660e8400-e29b-41d4-a716-446655440001";

const makeTemplate = (overrides: Partial<TemplateEntity & { content: string }> = {}): TemplateEntity & { content: string } => ({
  id: VALID_UUID,
  name: "Template di Test",
  description: "Descrizione di test",
  content: "# {{titolo}}\n\nTesto con {{nome}}.",
  content_path: `${VALID_UUID}.md`,
  section_id: null,
  status: "draft",
  created_by: "system",
  fields: [
    { name: "titolo", label: "Titolo", type: "text", required: true, defaultValue: "" },
    { name: "nome", label: "Nome", type: "text", required: true, defaultValue: "" },
  ],
  created_at: new Date("2024-01-01"),
  updated_at: new Date("2024-01-01"),
  ...overrides,
});

describe("TemplatesService", () => {
  let service: TemplatesService;
  let templatesRepository: jest.Mocked<TemplatesRepository>;
  let dataSource: jest.Mocked<DataSource>;

  const runTransaction = (
    cbOrIsolation: ((manager: EntityManager) => Promise<unknown>) | string,
    maybeCb?: (manager: EntityManager) => Promise<unknown>,
  ): Promise<unknown> => {
    const cb = typeof cbOrIsolation === "function" ? cbOrIsolation : maybeCb;
    if (!cb) throw new Error("No callback provided");
    return cb({} as EntityManager);
  };

  beforeEach(async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(fsPromises, "mkdir").mockResolvedValue(undefined);
    jest.spyOn(fsPromises, "writeFile").mockResolvedValue(undefined);
    jest.spyOn(fsPromises, "rename").mockResolvedValue(undefined);
    jest.spyOn(fsPromises, "unlink").mockResolvedValue(undefined);
    jest.spyOn(fsPromises, "readFile").mockResolvedValue("# {{titolo}}\n\nTesto con {{nome}}." as never);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplatesService,
        {
          provide: TemplatesRepository,
          useValue: {
            findAll: jest.fn(),
            findById: jest.fn(),
            insertTemplate: jest.fn(),
            updateTemplate: jest.fn(),
            deleteTemplate: jest.fn(),
            countActiveDocuments: jest.fn(),
            sectionExists: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: { transaction: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<TemplatesService>(TemplatesService);
    templatesRepository = module.get(TemplatesRepository) as jest.Mocked<TemplatesRepository>;
    dataSource = module.get(DataSource) as jest.Mocked<DataSource>;
  });

  afterEach(() => jest.restoreAllMocks());

  // ── create() ────────────────────────────────────────────────────────────────

  describe("create() - casi nominali", () => {
    it("crea un template con contenuto valido", async () => {
      const template = makeTemplate();
      templatesRepository.insertTemplate.mockResolvedValue(template);
      dataSource.transaction.mockImplementation(runTransaction as never);

      const result = await service.create({
        name: "Template di Test",
        content: "# {{titolo}}\n\nTesto con {{nome}}.",
      });

      expect(result).not.toBeNull();
      expect(result?.name).toBe("Template di Test");
      expect(templatesRepository.insertTemplate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ name: "Template di Test" }),
      );
    });

    it("usa 'system' come creator di default", async () => {
      const template = makeTemplate();
      templatesRepository.insertTemplate.mockResolvedValue(template);
      dataSource.transaction.mockImplementation(runTransaction as never);

      await service.create({ name: "T", content: "# {{titolo}}" });

      expect(templatesRepository.insertTemplate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ createdBy: "system" }),
      );
    });

    it("trimma il nome del template", async () => {
      const template = makeTemplate({ name: "Trimmed" });
      templatesRepository.insertTemplate.mockResolvedValue(template);
      dataSource.transaction.mockImplementation(runTransaction as never);

      await service.create({ name: "  Trimmed  ", content: "# {{titolo}}" });

      expect(templatesRepository.insertTemplate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ name: "Trimmed" }),
      );
    });

    it("verifica section_id se fornito e valido", async () => {
      templatesRepository.sectionExists.mockResolvedValue(true);
      templatesRepository.insertTemplate.mockResolvedValue(makeTemplate());
      dataSource.transaction.mockImplementation(runTransaction as never);

      await service.create({
        name: "T",
        content: "# {{titolo}}",
        section_id: SECTION_UUID,
      });

      expect(templatesRepository.sectionExists).toHaveBeenCalledWith(SECTION_UUID);
    });
  });

  describe("create() - casi limite", () => {
    it("lancia 400 se il nome è vuoto", async () => {
      await expect(
        service.create({ name: "", content: "# {{titolo}}" }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it("lancia 400 se il nome contiene solo spazi", async () => {
      await expect(
        service.create({ name: "   ", content: "# {{titolo}}" }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it("lancia 400 per contenuto vuoto", async () => {
      await expect(
        service.create({ name: "T", content: "" }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it("lancia 400 per contenuto di soli spazi", async () => {
      await expect(
        service.create({ name: "T", content: "   " }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it("lancia 400 per placeholder con sintassi non valida", async () => {
      await expect(
        service.create({ name: "T", content: "# {{ titolo con spazi }}" }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it("lancia 400 per parentesi non bilanciate", async () => {
      await expect(
        service.create({ name: "T", content: "# {{titolo}" }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it("lancia 400 se section_id non è un UUID valido", async () => {
      await expect(
        service.create({ name: "T", content: "# {{titolo}}", section_id: "not-a-uuid" }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it("lancia 400 se section_id non esiste nel DB", async () => {
      templatesRepository.sectionExists.mockResolvedValue(false);

      await expect(
        service.create({ name: "T", content: "# {{titolo}}", section_id: SECTION_UUID }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it("lancia 400 per contenuto con tag <script>", async () => {
      await expect(
        service.create({ name: "T", content: "# {{titolo}}<script>alert(1)</script>" }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it("lancia 400 per contenuto con tag <iframe>", async () => {
      await expect(
        service.create({ name: "T", content: '# {{titolo}}<iframe src="x"/>' }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it("lancia 400 per comandi LaTeX pericolosi", async () => {
      await expect(
        service.create({ name: "T", content: "# {{titolo}}\\input{/etc/passwd}" }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it("elimina il file tmp se la transazione DB fallisce", async () => {
      dataSource.transaction.mockRejectedValue(new Error("DB error"));

      await expect(
        service.create({ name: "T", content: "# {{titolo}}" }),
      ).rejects.toThrow("DB error");

      expect(fsPromises.unlink).toHaveBeenCalled();
    });
  });

  // ── findOne() ───────────────────────────────────────────────────────────────

  describe("findOne() - casi nominali e limite", () => {
    it("ritorna il template idratato se esiste", async () => {
      templatesRepository.findById.mockResolvedValue(makeTemplate());

      const result = await service.findOne(VALID_UUID);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(VALID_UUID);
    });

    it("ritorna null se il template non esiste", async () => {
      templatesRepository.findById.mockResolvedValue(null);

      const result = await service.findOne(VALID_UUID);

      expect(result).toBeNull();
    });

    it("lancia 400 per UUID non valido", async () => {
      await expect(service.findOne("not-a-uuid")).rejects.toMatchObject({ status: 400 });
    });
  });

  // ── findAll() ───────────────────────────────────────────────────────────────

  describe("findAll() - casi nominali e limite", () => {
    it("ritorna lista paginata di template", async () => {
      const templates = [makeTemplate(), makeTemplate({ id: uuid() })];
      templatesRepository.findAll.mockResolvedValue({ data: templates, total: 2 });

      const result = await service.findAll({ limit: 20, offset: 0 });

      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
    });

    it("gestisce lista vuota", async () => {
      templatesRepository.findAll.mockResolvedValue({ data: [], total: 0 });

      const result = await service.findAll({ limit: 20, offset: 0 });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("filtra per status", async () => {
      templatesRepository.findAll.mockResolvedValue({ data: [], total: 0 });

      await service.findAll({ status: "published", limit: 10, offset: 0 });

      expect(templatesRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ status: "published" }),
      );
    });

    it("applica i default di paginazione (limit=20, offset=0)", async () => {
      templatesRepository.findAll.mockResolvedValue({ data: [], total: 0 });

      await service.findAll({});

      expect(templatesRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 20, offset: 0 }),
      );
    });
  });

  // ── update() ────────────────────────────────────────────────────────────────

  describe("update() - casi nominali", () => {
    it("aggiorna nome e contenuto", async () => {
      const existing = makeTemplate();
      templatesRepository.findById.mockResolvedValue(existing);
      templatesRepository.updateTemplate.mockResolvedValue(existing);
      dataSource.transaction.mockImplementation(runTransaction as never);

      await service.update(VALID_UUID, {
        name: "Nuovo Nome",
        content: "# {{titolo}}\n\nNuovo {{testo}}.",
      });

      expect(templatesRepository.updateTemplate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ name: "Nuovo Nome" }),
      );
    });

    it("aggiorna section_id a null quando passato esplicitamente null", async () => {
      const existing = makeTemplate({ section_id: SECTION_UUID });
      templatesRepository.findById.mockResolvedValue(existing);
      templatesRepository.updateTemplate.mockResolvedValue(existing);
      dataSource.transaction.mockImplementation(runTransaction as never);

      await service.update(VALID_UUID, { section_id: null });

      expect(templatesRepository.updateTemplate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ sectionId: null }),
      );
    });
  });

  describe("update() - casi limite", () => {
    it("lancia 404 se il template non esiste", async () => {
      templatesRepository.findById.mockResolvedValue(null);

      await expect(
        service.update(VALID_UUID, { name: "X" }),
      ).rejects.toMatchObject({ status: 404 });
    });

    it("lancia 400 per UUID non valido in id", async () => {
      await expect(
        service.update("not-a-uuid", { name: "X" }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it("lancia 400 se il nuovo section_id non è UUID", async () => {
      templatesRepository.findById.mockResolvedValue(makeTemplate());

      await expect(
        service.update(VALID_UUID, { section_id: "not-a-uuid" }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it("lancia 400 se section_id non esiste nel DB", async () => {
      templatesRepository.findById.mockResolvedValue(makeTemplate());
      templatesRepository.sectionExists.mockResolvedValue(false);

      await expect(
        service.update(VALID_UUID, { section_id: SECTION_UUID }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it("elimina file tmp se transazione fallisce durante update", async () => {
      templatesRepository.findById.mockResolvedValue(makeTemplate());
      dataSource.transaction.mockRejectedValue(new Error("DB rollback"));

      await expect(
        service.update(VALID_UUID, { content: "# {{titolo}}" }),
      ).rejects.toThrow("DB rollback");

      expect(fsPromises.unlink).toHaveBeenCalled();
    });
  });

  // ── delete() ────────────────────────────────────────────────────────────────

  describe("delete() - casi nominali", () => {
    it("elimina il template se non ha documenti attivi", async () => {
      templatesRepository.findById.mockResolvedValue(makeTemplate());
      templatesRepository.countActiveDocuments.mockResolvedValue(0);

      const result = await service.delete(VALID_UUID);

      expect(result).toEqual({ deleted: true });
      expect(templatesRepository.deleteTemplate).toHaveBeenCalledWith(VALID_UUID);
    });

    it("elimina anche il file su disco", async () => {
      templatesRepository.findById.mockResolvedValue(makeTemplate());
      templatesRepository.countActiveDocuments.mockResolvedValue(0);

      await service.delete(VALID_UUID);

      expect(fsPromises.unlink).toHaveBeenCalled();
    });
  });

  describe("delete() - casi limite", () => {
    it("lancia 404 se il template non esiste", async () => {
      templatesRepository.findById.mockResolvedValue(null);

      await expect(service.delete(VALID_UUID)).rejects.toMatchObject({ status: 404 });
    });

    it("lancia 409 se esistono documenti attivi", async () => {
      templatesRepository.findById.mockResolvedValue(makeTemplate());
      templatesRepository.countActiveDocuments.mockResolvedValue(3);

      await expect(service.delete(VALID_UUID)).rejects.toMatchObject({ status: 409 });
    });

    it("lancia 400 per UUID non valido", async () => {
      await expect(service.delete("not-a-uuid")).rejects.toMatchObject({ status: 400 });
    });
  });

  // ── validateMarkdown() ──────────────────────────────────────────────────────

  describe("validateMarkdown() - casi limite", () => {
    it("valida correttamente un template corretto", () => {
      const result = service.validateMarkdown("# {{titolo}}\n\nTesto {{nome}}.");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("rileva template vuoto", () => {
      const result = service.validateMarkdown("");
      expect(result.valid).toBe(false);
    });

    it("rileva placeholder non validi", () => {
      const result = service.validateMarkdown("# {{ titolo con spazi }}");
      expect(result.valid).toBe(false);
    });

    it("rileva tag <script>", () => {
      const result = service.validateMarkdown("# {{t}}<script>alert(1)</script>");
      expect(result.valid).toBe(false);
    });
  });

  // ── importFromMarkdown() ────────────────────────────────────────────────────

  describe("importFromMarkdown()", () => {
    it("delega a create() con i parametri corretti", async () => {
      const createSpy = jest
        .spyOn(service, "create")
        .mockResolvedValue(makeTemplate());

      await service.importFromMarkdown("# {{titolo}}", "Importato", "user1", SECTION_UUID);

      expect(createSpy).toHaveBeenCalledWith({
        section_id: SECTION_UUID,
        name: "Importato",
        content: "# {{titolo}}",
        created_by: "user1",
      });
    });
  });

  // ── getExportContent() ──────────────────────────────────────────────────────

  describe("getExportContent()", () => {
    it("ritorna il contenuto del template", () => {
      const content = service.getExportContent({ content: "# ciao" });
      expect(content).toBe("# ciao");
    });
  });
});
