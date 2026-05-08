import { Test, type TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { TemplatesRepository } from "../src/repository/templates.repository";
import { TemplateEntity } from "../src/entities/template.entity";
import { DocumentEntity } from "../src/entities/document.entity";
import { SectionEntity } from "../src/entities/section.entity";

const makeTplRepo = () => ({
  findOne: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const makeDocRepo = () => ({ count: jest.fn() });
const makeSecRepo = () => ({ count: jest.fn() });

describe("TemplatesRepository", () => {
  let repo: TemplatesRepository;
  let tplRepo: ReturnType<typeof makeTplRepo>;
  let docRepo: ReturnType<typeof makeDocRepo>;
  let secRepo: ReturnType<typeof makeSecRepo>;

  const fakeTpl = (): TemplateEntity => ({
    id: "tpl-1",
    name: "Template Test",
    description: "Desc",
    content_path: "/storage/tpl-1.md",
    fields: [],
    status: "draft",
    section_id: null,
    created_by: "user1",
    created_at: new Date(),
    updated_at: new Date(),
  } as TemplateEntity);

  function makeQb(data: TemplateEntity[] = [], total = 0) {
    const qb: any = {
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([data, total]),
    };
    tplRepo.createQueryBuilder.mockReturnValue(qb);
    return qb;
  }

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

  describe("findAll()", () => {
    it("deve restituire template e totale senza filtri", async () => {
      const tpls = [fakeTpl()];
      makeQb(tpls, 1);
      const result = await repo.findAll({ limit: 10, offset: 0 });
      expect(result.data).toEqual(tpls);
      expect(result.total).toBe(1);
    });

    it("deve applicare il filtro status", async () => {
      const qb = makeQb([], 0);
      await repo.findAll({ status: "draft", limit: 10, offset: 0 });
      expect(qb.andWhere).toHaveBeenCalledWith(
        "template.status = :status",
        { status: "draft" },
      );
    });

    it("deve applicare il filtro sectionId", async () => {
      const qb = makeQb([], 0);
      await repo.findAll({ sectionId: "sec-1", limit: 10, offset: 0 });
      expect(qb.andWhere).toHaveBeenCalledWith(
        "template.section_id = :sectionId",
        { sectionId: "sec-1" },
      );
    });

    it("deve applicare il filtro categoryId con innerJoin", async () => {
      const qb = makeQb([], 0);
      await repo.findAll({ categoryId: "cat-1", limit: 10, offset: 0 });
      expect(qb.innerJoin).toHaveBeenCalledWith("template.section", "section");
      expect(qb.andWhere).toHaveBeenCalledWith(
        "section.category_id = :categoryId",
        { categoryId: "cat-1" },
      );
    });

    it("deve applicare paginazione", async () => {
      const qb = makeQb([], 0);
      await repo.findAll({ limit: 5, offset: 15 });
      expect(qb.take).toHaveBeenCalledWith(5);
      expect(qb.skip).toHaveBeenCalledWith(15);
    });

    it("deve applicare tutti i filtri contemporaneamente", async () => {
      const qb = makeQb([], 0);
      await repo.findAll({
        status: "published",
        sectionId: "sec-2",
        categoryId: "cat-2",
        limit: 10,
        offset: 0,
      });
      expect(qb.andWhere).toHaveBeenCalledTimes(3);
    });
  });

  describe("findById()", () => {
    it("deve restituire template per id", async () => {
      const tpl = fakeTpl();
      tplRepo.findOne.mockResolvedValue(tpl);
      expect(await repo.findById("tpl-1")).toEqual(tpl);
    });

    it("deve restituire null se non trovato", async () => {
      tplRepo.findOne.mockResolvedValue(null);
      expect(await repo.findById("x")).toBeNull();
    });
  });

  describe("insertTemplate()", () => {
    it("deve creare e salvare un template con tutti i campi", async () => {
      const tpl = fakeTpl();
      const manager: any = {
        create: jest.fn().mockReturnValue(tpl),
        save: jest.fn().mockResolvedValue(tpl),
      };
      const result = await repo.insertTemplate(manager, {
        id: "tpl-1",
        name: "Template Test",
        contentPath: "/storage/tpl-1.md",
        fields: [],
        createdBy: "user1",
      });
      expect(result).toEqual(tpl);
      expect(manager.create).toHaveBeenCalledWith(
        TemplateEntity,
        expect.objectContaining({ id: "tpl-1", status: "draft", section_id: null }),
      );
    });

    it("deve usare sectionId e status forniti", async () => {
      const tpl = fakeTpl();
      const manager: any = {
        create: jest.fn().mockReturnValue(tpl),
        save: jest.fn().mockResolvedValue(tpl),
      };
      await repo.insertTemplate(manager, {
        id: "tpl-1",
        sectionId: "sec-1",
        name: "T",
        contentPath: "/x",
        fields: [],
        createdBy: "u",
        status: "published",
      });
      expect(manager.create).toHaveBeenCalledWith(
        TemplateEntity,
        expect.objectContaining({ section_id: "sec-1", status: "published" }),
      );
    });
  });

  describe("updateTemplate()", () => {
    it("deve aggiornare e restituire il template", async () => {
      const tpl = fakeTpl();
      const manager: any = {
        update: jest.fn().mockResolvedValue(undefined),
        findOne: jest.fn().mockResolvedValue(tpl),
      };
      const result = await repo.updateTemplate(manager, {
        id: "tpl-1",
        sectionId: null,
        name: "Updated",
        description: null,
        contentPath: "/x",
        fields: [],
        status: "published",
      });
      expect(result).toEqual(tpl);
    });

    it("deve lanciare errore se template non trovato dopo update", async () => {
      const manager: any = {
        update: jest.fn().mockResolvedValue(undefined),
        findOne: jest.fn().mockResolvedValue(null),
      };
      await expect(
        repo.updateTemplate(manager, {
          id: "x",
          sectionId: null,
          name: "T",
          description: null,
          contentPath: "/x",
          fields: [],
          status: "draft",
        }),
      ).rejects.toThrow(/non trovato dopo update/);
    });
  });

  describe("countActiveDocuments()", () => {
    it("deve restituire il numero di documenti attivi", async () => {
      docRepo.count.mockResolvedValue(3);
      expect(await repo.countActiveDocuments("tpl-1")).toBe(3);
      expect(docRepo.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: { template_id: "tpl-1" } }),
      );
    });

    it("deve restituire 0 se nessun documento", async () => {
      docRepo.count.mockResolvedValue(0);
      expect(await repo.countActiveDocuments("tpl-vuoto")).toBe(0);
    });
  });

  describe("deleteTemplate()", () => {
    it("deve eliminare un template", async () => {
      tplRepo.delete.mockResolvedValue(undefined);
      await expect(repo.deleteTemplate("tpl-1")).resolves.not.toThrow();
      expect(tplRepo.delete).toHaveBeenCalledWith({ id: "tpl-1" });
    });
  });

  describe("sectionExists()", () => {
    it("deve restituire true se la sezione esiste", async () => {
      secRepo.count.mockResolvedValue(1);
      expect(await repo.sectionExists("sec-1")).toBe(true);
    });

    it("deve restituire false se la sezione non esiste", async () => {
      secRepo.count.mockResolvedValue(0);
      expect(await repo.sectionExists("sec-x")).toBe(false);
    });
  });
});
