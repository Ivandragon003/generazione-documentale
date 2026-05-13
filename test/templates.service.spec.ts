import { Test, type TestingModule } from "@nestjs/testing";
import { DataSource, type EntityManager } from "typeorm";
import type { TemplateEntity } from "../src/entities/template.entity";
import { TemplatesRepository } from "../src/repository/templates.repository";
import type { GitHubTemplateFile } from "../src/service/github-storage.service";
import { GitHubStorageService } from "../src/service/github-storage.service";
import { TemplatesService } from "../src/service/templates.service";

// ── helpers ────────────────────────────────────────────────────────────────────
const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

const makeTemplate = (
  overrides: Partial<TemplateEntity & { content: string }> = {},
): TemplateEntity & { content: string } =>
  ({
    id: VALID_UUID,
    name: "Template di Test",
    description: "Descrizione di test",
    content: "# {{titolo}}\n\nTesto con {{nome}}.",
    content_path: `${VALID_UUID}`,
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
      {
        name: "nome",
        label: "Nome",
        type: "text",
        required: true,
        defaultValue: "",
      },
    ],
    created_at: new Date("2024-01-01"),
    updated_at: new Date("2024-01-01"),
    ...overrides,
  }) as TemplateEntity & { content: string };

const normalizeGitHubId = (raw: string): string => {
  let normalized = raw.replace(/^github:/, "").replace(/^templates\//, "");
  if (normalized.endsWith(".md")) normalized = normalized.slice(0, -3);
  return normalized;
};

const makeGitHubTemplate = (
  raw: string,
  content = "# {{titolo}}",
): GitHubTemplateFile => {
  const id = normalizeGitHubId(raw);
  const parts = id.split("/");
  const now = new Date("2024-01-01");
  return {
    id: `github:${id}`,
    name: parts.at(-1) ?? id,
    description: null,
    content_path: id,
    githubPath: `templates/${id}.md`,
    category: parts.length >= 3 ? parts[0] : null,
    section: parts.length >= 3 ? parts[1] : null,
    status: "published",
    fields: [],
    created_by: "github",
    created_at: now,
    updated_at: now,
    content,
  };
};

describe("TemplatesService", () => {
  let service: TemplatesService;
  let templatesRepository: jest.Mocked<TemplatesRepository>;
  let dataSource: jest.Mocked<DataSource>;
  let githubStorage: jest.Mocked<GitHubStorageService>;

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
    jest.spyOn(console, "error").mockImplementation(() => {});

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
            findByContentPaths: jest.fn(),
            findOneByContentPaths: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: { transaction: jest.fn() },
        },
        {
          provide: GitHubStorageService,
          useValue: {
            readTemplate: jest.fn(),
            getTemplate: jest.fn(),
            writeTemplate: jest.fn(),
            deleteTemplate: jest.fn(),
            listTemplates: jest.fn().mockResolvedValue([]),
            normalizeTemplateId: jest.fn(normalizeGitHubId),
            contentPathCandidates: jest.fn((raw: string) => {
              const id = normalizeGitHubId(raw);
              return [id, `${id}.md`, `templates/${id}.md`];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<TemplatesService>(TemplatesService);
    templatesRepository = module.get(
      TemplatesRepository,
    ) as jest.Mocked<TemplatesRepository>;
    dataSource = module.get(DataSource) as jest.Mocked<DataSource>;
    githubStorage = module.get(
      GitHubStorageService,
    ) as jest.Mocked<GitHubStorageService>;

    templatesRepository.findByContentPaths.mockResolvedValue([]);
    templatesRepository.findOneByContentPaths.mockResolvedValue(null);
    githubStorage.getTemplate.mockImplementation(async (raw: string) => {
      const content = await githubStorage.readTemplate(raw);
      return content === null ? null : makeGitHubTemplate(raw, content);
    });
  });

  afterEach(() => jest.resetAllMocks());

  // ── create() ──────────────────────────────────────────────────────────────

  describe("create() - casi nominali", () => {
    it("crea un template con contenuto valido", async () => {
      const template = makeTemplate();
      templatesRepository.insertTemplate.mockResolvedValue(template);
      dataSource.transaction.mockImplementation(runTransaction as never);
      githubStorage.writeTemplate.mockResolvedValue(undefined);
      githubStorage.readTemplate.mockResolvedValue(
        "# {{titolo}}\n\nTesto con {{nome}}.",
      );

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
      githubStorage.writeTemplate.mockResolvedValue(undefined);
      githubStorage.readTemplate.mockResolvedValue("# {{titolo}}");

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
      githubStorage.writeTemplate.mockResolvedValue(undefined);
      githubStorage.readTemplate.mockResolvedValue("# {{titolo}}");

      await service.create({ name: "  Trimmed  ", content: "# {{titolo}}" });

      expect(templatesRepository.insertTemplate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ name: "Trimmed" }),
      );
    });

    it("usa il path fornito come contentPath (sovrascrittura GitHub)", async () => {
      const template = makeTemplate({ content_path: "category/section/name" });
      templatesRepository.insertTemplate.mockResolvedValue(template);
      dataSource.transaction.mockImplementation(runTransaction as never);
      githubStorage.writeTemplate.mockResolvedValue(undefined);
      githubStorage.readTemplate.mockResolvedValue("# Content");

      await service.create({
        name: "Overwrite",
        content: "# Content",
        path: "github:category/section/name.md",
      });

      expect(githubStorage.writeTemplate).toHaveBeenCalledWith(
        "category/section/name",
        "# Content",
      );
      expect(templatesRepository.insertTemplate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ contentPath: "category/section/name" }),
      );
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

    it("lancia 400 per contenuto con tag <script>", async () => {
      await expect(
        service.create({
          name: "T",
          content: "# {{titolo}}<script>alert(1)</script>",
        }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it("lancia 400 per contenuto con tag <iframe>", async () => {
      await expect(
        service.create({ name: "T", content: '# {{titolo}}<iframe src="x"/>' }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it("lancia 400 per comandi LaTeX pericolosi", async () => {
      await expect(
        service.create({
          name: "T",
          content: "# {{titolo}}\\input{/etc/passwd}",
        }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it("tenta rollback GitHub se la transazione DB fallisce", async () => {
      githubStorage.writeTemplate.mockResolvedValue(undefined);
      githubStorage.deleteTemplate.mockResolvedValue(undefined);
      dataSource.transaction.mockRejectedValue(new Error("DB error"));

      await expect(
        service.create({ name: "T", content: "# {{titolo}}" }),
      ).rejects.toThrow("DB error");

      expect(githubStorage.deleteTemplate).toHaveBeenCalled();
    });
  });

  // ── findOne() ──────────────────────────────────────────────────────────────

  describe("findOne() - casi nominali e limite", () => {
    it("ritorna il template idratato se esiste", async () => {
      templatesRepository.findById.mockResolvedValue(makeTemplate());
      githubStorage.readTemplate.mockResolvedValue(
        "# {{titolo}}\n\nTesto con {{nome}}.",
      );

      const result = await service.findOne(VALID_UUID);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(VALID_UUID);
    });

    it("ritorna null se il template non esiste nel DB", async () => {
      templatesRepository.findById.mockResolvedValue(null);

      const result = await service.findOne(VALID_UUID);

      expect(result).toBeNull();
    });

    it("lancia 400 per UUID non valido", async () => {
      await expect(service.findOne("not-a-uuid")).rejects.toMatchObject({
        status: 400,
      });
    });

    it("lancia 404 se il contenuto non e disponibile su GitHub", async () => {
      templatesRepository.findById.mockResolvedValue(makeTemplate());
      githubStorage.readTemplate.mockResolvedValue(null);

      await expect(service.findOne(VALID_UUID)).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  // ── findAll() ─────────────────────────────────────────────────────────────

  describe("findAll() - casi nominali e limite", () => {
    it("ritorna lista paginata di template", async () => {
      githubStorage.listTemplates.mockResolvedValue([
        makeGitHubTemplate("category/section/one"),
        makeGitHubTemplate("category/section/two"),
      ]);

      const result = await service.findAll({ limit: 20, offset: 0 });

      expect(result.total).toBe(2);
    });

    it("gestisce lista vuota", async () => {
      githubStorage.listTemplates.mockResolvedValue([]);

      const result = await service.findAll({ limit: 20, offset: 0 });

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("filtra per status", async () => {
      githubStorage.listTemplates.mockResolvedValue([]);

      await service.findAll({ status: "published", limit: 10, offset: 0 });

      expect(githubStorage.listTemplates).toHaveBeenCalled();
    });

    it("applica i default di paginazione (limit=20, offset=0)", async () => {
      githubStorage.listTemplates.mockResolvedValue([]);

      const result = await service.findAll({});

      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });

    it("template DB senza corrispondente GitHub non viene incluso nella lista", async () => {
      const tpl = makeTemplate();
      githubStorage.listTemplates.mockResolvedValue([]);
      templatesRepository.findByContentPaths.mockResolvedValue([tpl]);

      const result = await service.findAll({ limit: 20, offset: 0 });

      expect(result.data).toHaveLength(0);
    });
  });

  // ── update() ──────────────────────────────────────────────────────────────

  describe("update() - casi nominali", () => {
    it("aggiorna nome e contenuto", async () => {
      const existing = makeTemplate();
      templatesRepository.findById.mockResolvedValue(existing);
      githubStorage.readTemplate.mockResolvedValue(existing.content);
      githubStorage.writeTemplate.mockResolvedValue(undefined);
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
  });

  // ── delete() ──────────────────────────────────────────────────────────────

  describe("delete() - casi nominali", () => {
    it("elimina il template se non ha documenti attivi", async () => {
      templatesRepository.findById.mockResolvedValue(makeTemplate());
      githubStorage.readTemplate.mockResolvedValue("# {{titolo}}");
      templatesRepository.countActiveDocuments.mockResolvedValue(0);
      githubStorage.deleteTemplate.mockResolvedValue(undefined);

      const result = await service.delete(VALID_UUID);

      expect(result).toEqual({ deleted: true });
      expect(templatesRepository.deleteTemplate).toHaveBeenCalledWith(
        VALID_UUID,
      );
    });
  });

  describe("delete() - casi limite", () => {
    it("lancia 404 se il template non esiste", async () => {
      templatesRepository.findById.mockResolvedValue(null);

      await expect(service.delete(VALID_UUID)).rejects.toMatchObject({
        status: 404,
      });
    });

    it("lancia 409 se esistono documenti attivi", async () => {
      templatesRepository.findById.mockResolvedValue(makeTemplate());
      githubStorage.readTemplate.mockResolvedValue("# {{titolo}}");
      templatesRepository.countActiveDocuments.mockResolvedValue(3);

      await expect(service.delete(VALID_UUID)).rejects.toMatchObject({
        status: 409,
      });
    });

    it("lancia 400 per UUID non valido", async () => {
      await expect(service.delete("not-a-uuid")).rejects.toMatchObject({
        status: 400,
      });
    });
  });

  // ── validateMarkdown() ────────────────────────────────────────────────────

  describe("validateMarkdown() - casi limite", () => {
    it("valida correttamente un template corretto", () => {
      const result = service.validateMarkdown(
        "# {{titolo}}\n\nTesto {{nome}}.",
      );
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
      const result = service.validateMarkdown(
        "# {{t}}<script>alert(1)</script>",
      );
      expect(result.valid).toBe(false);
    });
  });
});
