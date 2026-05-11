import { Test, type TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DocumentEntity } from "../src/entities/document.entity";
import { SectionEntity } from "../src/entities/section.entity";
import { TemplateEntity } from "../src/entities/template.entity";
import { TemplatesRepository } from "../src/repository/templates.repository";

/**
 * Test supplementari per TemplatesRepository.
 * Coprono:
 * - findAll con tutti i filtri insieme (status + sectionId + categoryId)
 * - insertTemplate con description e status opzionali assenti
 * - updateTemplate con sectionId che cambia da valorizzato a null
 * - countActiveDocuments con templateId non esistente (ritorna 0)
 * - sectionExists — comportamento con più section con stessa id
 * - findAll ordina per updated_at DESC
 */

const makeTplRepo = () => ({
  findOne: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const makeDocRepo = () => ({ count: jest.fn() });
const makeSecRepo = () => ({ count: jest.fn() });

const fakeTpl = (overrides: Partial<TemplateEntity> = {}): TemplateEntity =>
  ({
    id: "tpl-1",
    name: "Template",
    description: null,
    content_path: "/storage/tpl-1.md",
    fields: [],
    status: "draft",
    section_id: null,
    created_by: "user1",
    created_at: new Date("2024-01-01"),
    updated_at: new Date("2024-06-01"),
    ...overrides,
  }) as TemplateEntity;

function makeQb(data: TemplateEntity[] = [], total = 0) {
  const qb: Record<string, jest.Mock> = {
    orderBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([data, total]),
  };

  // Ogni metodo deve restituire lo stesso qb per permettere il chaining
  for (const key of Object.keys(qb)) {
    if (key !== "getManyAndCount") {
      (qb[key] as jest.Mock).mockReturnThis();
    }
  }
  return qb;
}

describe("TemplatesRepository — edge cases aggiuntivi", () => {
  let repo: TemplatesRepository;
  let tplRepo: ReturnType<typeof makeTplRepo>;
  let docRepo: ReturnType<typeof makeDocRepo>;
  let secRepo: ReturnType<typeof makeSecRepo>;

  beforeEach(async () => {
    tplRepo = makeTplRepo();
    docRepo = makeDocRepo();
    secRepo = makeSecRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplatesRepository,
        { provide: getRepositoryToken(TemplateEntity), useValue: tplRepo },
        { provide: getRepositoryToken(DocumentEntity), useValue: docRepo },
        { provide: getRepositoryToken(SectionEntity), useValue: secRepo },
      ],
    }).compile();

    repo = module.get<TemplatesRepository>(TemplatesRepository);
  });

  // ── findAll — combinazioni di filtri ─────────────────────────────────────

  describe("findAll() — combinazioni di filtri", () => {
    it("applica status + sectionId + categoryId insieme (tre andWhere)", async () => {
      const qb = makeQb([], 0);
      tplRepo.createQueryBuilder.mockReturnValue(qb);

      await repo.findAll({
        status: "published",
        sectionId: "sec-abc",
        categoryId: "cat-abc",
        limit: 10,
        offset: 0,
      });

      expect(qb.andWhere).toHaveBeenCalledTimes(3);
      expect(qb.innerJoin).toHaveBeenCalledWith("template.section", "section");
    });

    it("con offset grande restituisce array vuoto e total corretto", async () => {
      const qb = makeQb([], 500);
      tplRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await repo.findAll({ limit: 10, offset: 9999 });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(500);
      expect(qb.skip).toHaveBeenCalledWith(9999);
    });

    it("usa orderBy updated_at DESC", async () => {
      const qb = makeQb();
      tplRepo.createQueryBuilder.mockReturnValue(qb);

      await repo.findAll({ limit: 10, offset: 0 });

      expect(qb.orderBy).toHaveBeenCalledWith("template.updated_at", "DESC");
    });

    it("non applica innerJoin se categoryId è undefined", async () => {
      const qb = makeQb();
      tplRepo.createQueryBuilder.mockReturnValue(qb);

      await repo.findAll({ limit: 10, offset: 0 });

      expect(qb.innerJoin).not.toHaveBeenCalled();
    });

    it("non applica andWhere se non ci sono filtri", async () => {
      const qb = makeQb();
      tplRepo.createQueryBuilder.mockReturnValue(qb);

      await repo.findAll({ limit: 10, offset: 0 });

      expect(qb.andWhere).not.toHaveBeenCalled();
    });
  });

  // ── insertTemplate — campi opzionali assenti ──────────────────────────────

  describe("insertTemplate() — campi opzionali", () => {
    it("crea template senza description e senza sectionId", async () => {
      const tpl = fakeTpl();
      const manager = {
        create: jest.fn().mockReturnValue(tpl),
        save: jest.fn().mockResolvedValue(tpl),
      };

      const result = await repo.insertTemplate(manager as never, {
        id: "tpl-new",
        name: "T",
        contentPath: "/x.md",
        fields: [],
        createdBy: "system",
        // nessun sectionId, description, status
      });

      expect(result).toEqual(tpl);
      expect(manager.create).toHaveBeenCalledWith(
        TemplateEntity,
        expect.objectContaining({
          section_id: null,
          description: null,
          status: "draft",
        }),
      );
    });

    it("crea template con status 'published' esplicitamente", async () => {
      const tpl = fakeTpl({ status: "published" });
      const manager = {
        create: jest.fn().mockReturnValue(tpl),
        save: jest.fn().mockResolvedValue(tpl),
      };

      await repo.insertTemplate(manager as never, {
        id: "tpl-pub",
        name: "Pubblicato",
        contentPath: "/pub.md",
        fields: [],
        createdBy: "admin",
        status: "published",
      });

      expect(manager.create).toHaveBeenCalledWith(
        TemplateEntity,
        expect.objectContaining({ status: "published" }),
      );
    });

    it("salva il template dopo averlo creato", async () => {
      const tpl = fakeTpl();
      const manager = {
        create: jest.fn().mockReturnValue(tpl),
        save: jest.fn().mockResolvedValue(tpl),
      };

      await repo.insertTemplate(manager as never, {
        id: "tpl-save",
        name: "T",
        contentPath: "/x.md",
        fields: [],
        createdBy: "u",
      });

      expect(manager.save).toHaveBeenCalledWith(TemplateEntity, tpl);
    });
  });

  // ── updateTemplate — sectionId da valore a null ───────────────────────────

  describe("updateTemplate() — rimozione sectionId", () => {
    it("aggiorna section_id a null quando richiesto", async () => {
      const tpl = fakeTpl({ section_id: null });
      const manager = {
        update: jest.fn().mockResolvedValue(undefined),
        findOne: jest.fn().mockResolvedValue(tpl),
      };

      const result = await repo.updateTemplate(manager as never, {
        id: "tpl-1",
        sectionId: null,
        name: "T",
        description: null,
        contentPath: "/x.md",
        fields: [],
        status: "draft",
      });

      expect(result).toEqual(tpl);
      expect(manager.update).toHaveBeenCalledWith(
        TemplateEntity,
        { id: "tpl-1" },
        expect.objectContaining({ section_id: null }),
      );
    });

    it("lancia errore con messaggio specifico se template non trovato dopo update", async () => {
      const manager = {
        update: jest.fn().mockResolvedValue(undefined),
        findOne: jest.fn().mockResolvedValue(null),
      };

      await expect(
        repo.updateTemplate(manager as never, {
          id: "non-esiste",
          sectionId: null,
          name: "T",
          description: null,
          contentPath: "/x.md",
          fields: [],
          status: "draft",
        }),
      ).rejects.toThrow("non trovato dopo update");
    });
  });

  // ── countActiveDocuments ──────────────────────────────────────────────────

  describe("countActiveDocuments()", () => {
    it("ritorna 0 per un template senza documenti", async () => {
      docRepo.count.mockResolvedValue(0);

      const count = await repo.countActiveDocuments("template-senza-doc");

      expect(count).toBe(0);
    });

    it("filtra per template_id corretto", async () => {
      docRepo.count.mockResolvedValue(5);

      await repo.countActiveDocuments("tpl-specifico");

      expect(docRepo.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: { template_id: "tpl-specifico" } }),
      );
    });
  });

  // ── sectionExists ─────────────────────────────────────────────────────────

  describe("sectionExists()", () => {
    it("ritorna true quando count > 1 (duplicati non dovrebbero esistere ma gestiti)", async () => {
      secRepo.count.mockResolvedValue(2);

      const exists = await repo.sectionExists("sec-dupe");

      expect(exists).toBe(true);
    });

    it("ritorna false esattamente per count=0", async () => {
      secRepo.count.mockResolvedValue(0);

      const exists = await repo.sectionExists("sec-miss");

      expect(exists).toBe(false);
    });

    it("cerca per id corretto", async () => {
      secRepo.count.mockResolvedValue(1);

      await repo.sectionExists("sec-target");

      expect(secRepo.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "sec-target" } }),
      );
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe("findById()", () => {
    it("usa la where clause corretta", async () => {
      tplRepo.findOne.mockResolvedValue(null);

      await repo.findById("search-id");

      expect(tplRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "search-id" } }),
      );
    });
  });

  // ── deleteTemplate ────────────────────────────────────────────────────────

  describe("deleteTemplate()", () => {
    it("chiama delete con where clause { id }", async () => {
      tplRepo.delete.mockResolvedValue(undefined);

      await repo.deleteTemplate("to-delete");

      expect(tplRepo.delete).toHaveBeenCalledWith({ id: "to-delete" });
    });

    it("non lancia se il template non esiste (delete idempotente)", async () => {
      tplRepo.delete.mockResolvedValue({ affected: 0 });

      await expect(repo.deleteTemplate("non-esiste")).resolves.not.toThrow();
    });
  });
});
