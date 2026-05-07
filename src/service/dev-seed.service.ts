import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";

const DEV_CATEGORY_SEEDS = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    type: "portfolio",
    name: "Portfolio Demo",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    type: "programma",
    name: "Programma Demo",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    type: "progetto",
    name: "Progetto Demo",
  },
] as const;

const DEV_SECTION_SEEDS = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    categoryId: "11111111-1111-4111-8111-111111111111",
    name: "Section Portfolio",
    position: 0,
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
    categoryId: "22222222-2222-4222-8222-222222222222",
    name: "Section Programma",
    position: 0,
  },
  {
    id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc3",
    categoryId: "33333333-3333-4333-8333-333333333333",
    name: "Section Progetto",
    position: 0,
  },
] as const;

@Injectable()
export class DevSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DevSeedService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.NODE_ENV === "production") {
      return;
    }

    await this.dataSource.transaction(async (manager) => {
      for (const category of DEV_CATEGORY_SEEDS) {
        await manager.query(
          `
            INSERT INTO categories (id, type, name)
            VALUES ($1, $2, $3)
            ON CONFLICT (id)
            DO UPDATE SET type = EXCLUDED.type, name = EXCLUDED.name
          `,
          [category.id, category.type, category.name],
        );
      }

      for (const section of DEV_SECTION_SEEDS) {
        await manager.query(
          `
            INSERT INTO sections (id, category_id, name, position)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (id)
            DO UPDATE SET
              category_id = EXCLUDED.category_id,
              name = EXCLUDED.name,
              position = EXCLUDED.position
          `,
          [section.id, section.categoryId, section.name, section.position],
        );
      }
    });

    this.logger.log("Dev seed categories/sections applicato");
  }
}
