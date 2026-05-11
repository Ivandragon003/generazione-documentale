import "reflect-metadata";
import { config } from "dotenv";
import { DataSource } from "typeorm";
import { CategoryEntity, type CategoryType } from "../src/entities/category.entity";
import { SectionEntity } from "../src/entities/section.entity";
import { parsePort } from "../src/common/utils/parse-port";

config();

const dataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST ?? "localhost",
  port: parsePort(process.env.DB_PORT ?? "5432"),
  username: process.env.DB_USER ?? "postgres",
  password: process.env.DB_PASSWORD ?? "postgres",
  database: process.env.DB_NAME ?? "mac_documents",
  entities: [CategoryEntity, SectionEntity],
  synchronize: false,
});

const CATEGORIES: { id: string; type: CategoryType; name: string }[] = [
  { id: "11111111-1111-4111-8111-111111111111", type: "portfolio", name: "Portfolio Demo" },
  { id: "22222222-2222-4222-8222-222222222222", type: "programma", name: "Programma Demo" },
  { id: "33333333-3333-4333-8333-333333333333", type: "progetto",  name: "Progetto Demo" },
];

const SECTIONS = [
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", categoryId: "11111111-1111-4111-8111-111111111111", name: "Section Portfolio",  position: 0 },
  { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2", categoryId: "22222222-2222-4222-8222-222222222222", name: "Section Programma", position: 0 },
  { id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc3", categoryId: "33333333-3333-4333-8333-333333333333", name: "Section Progetto",  position: 0 },
];

const runSeed = async (): Promise<void> => {
  await dataSource.initialize();
  console.log("Connessione DB ok");

  const categoryRepo = dataSource.getRepository(CategoryEntity);
  const sectionRepo  = dataSource.getRepository(SectionEntity);

  for (const cat of CATEGORIES) {
    await categoryRepo.upsert(cat, ["id"]);
    console.log(`  category: ${cat.name}`);
  }

  for (const sec of SECTIONS) {
    await sectionRepo.upsert(
      { id: sec.id, name: sec.name, position: sec.position, category: { id: sec.categoryId } },
      ["id"],
    );
    console.log(`  section: ${sec.name}`);
  }

  console.log("Seed completato");
  await dataSource.destroy();
};

runSeed().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Errore seed");
  process.exit(1);
});
