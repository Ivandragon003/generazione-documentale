import { Test, type TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { TemplateEntity } from "../src/entities/template.entity";
import { TemplatesRepository } from "../src/repository/templates.repository";

function makeManagerStub(rawCount: string) {
  const qb: Record<string, jest.Mock> = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue({ count: rawCount }),
  };
  return {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
  };
}

const makeTplRepo = (managerStub?: ReturnType<typeof makeManagerStub>) => ({
  findOne: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(),
  manager: managerStub,
});

const fakeTpl = (overrides: Partial<TemplateEntity> = {}): TemplateEntity =>
  ({
    id: "tpl-1",
    name: "Template",
    description: null,
    content_path: "/storage/tpl-1.md",
    fields: [],
    status: "draft",
    created_by: "user1",
    created_at: new Date("2024-01-01"),
    updated_at: new Date("2024-06-01"),
    ...overrides,
  }) as TemplateEntity;

function makeQb(data: TemplateEntity[] = [], total = 0) {
  const qb: Record<string, jest.Mock> = {
    orderBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([data, total]),
  };
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

  async function buildModule(managerStub?: ReturnType<typeof makeManagerStub>) {
    tplRepo = makeTplRepo(managerStub);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplatesRepository,
        { provide: getRepositoryToken(TemplateEntity), useValue: tplRepo },
      ],
    }).compile();
    repo = module.get<TemplatesRepository>(TemplatesRepository);
  }

  beforeEach(async () => {
    await buildModule();
  });

  describe("findAll() — filtri e paginazione", () => {
    it("applica status filter", async () => {
      const qb = makeQb([], 0);
      tplRepo.createQueryBuilder.mockReturnValue(qb);
      await repo.findAll({ status: "published", limit: 10, offset: 0 });
      expect(qb.andWhere).toHaveBeenCalledWith("template.status = :status", {
        status: "published",
      });
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

    it("non applica andWhere se non ci sono filtri", async () => {
      const qb = makeQb();
      tplRepo.createQueryBuilder.mockReturnValue(qb);
      await repo.findAll({ limit: 10, offset: 0 });
      expect(qb.andWhere).not.toHaveBeenCalled();
    });
  });

  describe("insertTemplate() — campi opzionali", () => {
    it("crea template senza description", async () => {
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
      });
      expect(result).toEqual(tpl);
      expect(manager.create).toHaveBeenCalledWith(
        TemplateEntity,
        expect.objectContaining({ description: null, status: "draft" }),
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

  describe("updateTemplate()", () => {
    it("aggiorna e restituisce il template", async () => {
      const tpl = fakeTpl();
      const manager = {
        update: jest.fn().mockResolvedValue(undefined),
        findOne: jest.fn().mockResolvedValue(tpl),
      };
      const result = await repo.updateTemplate(manager as never, {
        id: "tpl-1",
        name: "T",
        description: null,
        contentPath: "/x.md",
        fields: [],
        status: "draft",
      });
      expect(result).toEqual(tpl);
    });

    it("lancia errore con messaggio specifico se template non trovato dopo update", async () => {
      const manager = {
        update: jest.fn().mockResolvedValue(undefined),
        findOne: jest.fn().mockResolvedValue(null),
      };
      await expect(
        repo.updateTemplate(manager as never, {
          id: "non-esiste",
          name: "T",
          description: null,
          contentPath: "/x.md",
          fields: [],
          status: "draft",
        }),
      ).rejects.toThrow("non trovato dopo update");
    });
  });

  describe("countActiveDocuments()", () => {
    it("ritorna 0 per un template senza documenti", async () => {
      await buildModule(makeManagerStub("0"));
      expect(await repo.countActiveDocuments("template-senza-doc")).toBe(0);
    });

    it("filtra per template_id corretto", async () => {
      await buildModule(makeManagerStub("5"));
      expect(await repo.countActiveDocuments("tpl-specifico")).toBe(5);
    });
  });

  describe("findById()", () => {
    it("usa la where clause corretta", async () => {
      tplRepo.findOne.mockResolvedValue(null);
      await repo.findById("search-id");
      expect(tplRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "search-id" } }),
      );
    });
  });

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
