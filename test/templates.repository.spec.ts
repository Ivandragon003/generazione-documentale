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

describe("TemplatesRepository", () => {
  let repo: TemplatesRepository;
  let tplRepo: ReturnType<typeof makeTplRepo>;

  const fakeTpl = (): TemplateEntity =>
    ({
      id: "tpl-1",
      name: "Template Test",
      description: "Desc",
      content_path: "/storage/tpl-1.md",
      fields: [],
      created_by: "user1",
      created_at: new Date(),
      updated_at: new Date(),
    }) as TemplateEntity;

  function makeQb(data: TemplateEntity[] = [], total = 0) {
    const qb: Record<string, jest.Mock> = {
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([data, total]),
    };
    tplRepo.createQueryBuilder.mockReturnValue(qb);
    return qb;
  }

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

  describe("findAll()", () => {
    it("deve restituire template e totale senza filtri", async () => {
      const tpls = [fakeTpl()];
      makeQb(tpls, 1);
      const result = await repo.findAll({ limit: 10, offset: 0 });
      expect(result.data).toEqual(tpls);
      expect(result.total).toBe(1);
    });

    it("non applica filtri di pubblicazione ai template", async () => {
      const qb = makeQb([], 0);
      await repo.findAll({ limit: 10, offset: 0 });
      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it("deve applicare paginazione", async () => {
      const qb = makeQb([], 0);
      await repo.findAll({ limit: 5, offset: 15 });
      expect(qb.take).toHaveBeenCalledWith(5);
      expect(qb.skip).toHaveBeenCalledWith(15);
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
      const manager = {
        create: jest.fn().mockReturnValue(tpl),
        save: jest.fn().mockResolvedValue(tpl),
      };
      const result = await repo.insertTemplate(
        manager as unknown as Parameters<
          TemplatesRepository["insertTemplate"]
        >[0],
        {
          id: "tpl-1",
          name: "Template Test",
          contentPath: "/storage/tpl-1.md",
          fields: [],
          createdBy: "user1",
        },
      );
      expect(result).toEqual(tpl);
      expect(manager.create).toHaveBeenCalledWith(
        TemplateEntity,
        expect.objectContaining({ id: "tpl-1" }),
      );
    });

    it("ignora lo status fornito", async () => {
      const tpl = fakeTpl();
      const manager = {
        create: jest.fn().mockReturnValue(tpl),
        save: jest.fn().mockResolvedValue(tpl),
      };
      await repo.insertTemplate(
        manager as unknown as Parameters<
          TemplatesRepository["insertTemplate"]
        >[0],
        {
          id: "tpl-1",
          name: "T",
          contentPath: "/x",
          fields: [],
          createdBy: "u",
        },
      );
      expect(manager.create).toHaveBeenCalledWith(
        TemplateEntity,
        expect.not.objectContaining({ status: expect.any(String) }),
      );
    });
  });

  describe("updateTemplate()", () => {
    it("deve aggiornare e restituire il template", async () => {
      const tpl = fakeTpl();
      const manager = {
        update: jest.fn().mockResolvedValue(undefined),
        findOne: jest.fn().mockResolvedValue(tpl),
      };
      const result = await repo.updateTemplate(
        manager as unknown as Parameters<
          TemplatesRepository["updateTemplate"]
        >[0],
        {
          id: "tpl-1",
          name: "Updated",
          description: null,
          contentPath: "/x",
          fields: [],
        },
      );
      expect(result).toEqual(tpl);
    });

    it("deve lanciare errore se template non trovato dopo update", async () => {
      const manager = {
        update: jest.fn().mockResolvedValue(undefined),
        findOne: jest.fn().mockResolvedValue(null),
      };
      await expect(
        repo.updateTemplate(
          manager as unknown as Parameters<
            TemplatesRepository["updateTemplate"]
          >[0],
          {
            id: "x",
            name: "T",
            description: null,
            contentPath: "/x",
            fields: [],
          },
        ),
      ).rejects.toThrow(/non trovato dopo update/);
    });
  });

  describe("countActiveDocuments()", () => {
    it("deve restituire il numero di documenti attivi", async () => {
      await buildModule(makeManagerStub("3"));
      expect(await repo.countActiveDocuments("tpl-1")).toBe(3);
    });

    it("deve restituire 0 se nessun documento", async () => {
      await buildModule(makeManagerStub("0"));
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
});
