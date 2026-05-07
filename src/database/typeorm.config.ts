import type { ConfigService } from "@nestjs/config";
import type { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { CategoryEntity } from "./entities/category.entity";
import { DocumentEntity } from "./entities/document.entity";
import { PdfJobEntity } from "./entities/pdf-job.entity";
import { SectionEntity } from "./entities/section.entity";
import { TemplateEntity } from "./entities/template.entity";

const parsePort = (value: string): number => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error("Invalid DB_PORT: must be an integer between 1 and 65535");
  }
  return parsed;
};

export const buildTypeOrmOptions = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: "postgres",
  host: configService.getOrThrow<string>("DB_HOST"),
  port: parsePort(configService.getOrThrow<string>("DB_PORT")),
  username: configService.getOrThrow<string>("DB_USER"),
  password: configService.getOrThrow<string>("DB_PASSWORD"),
  database: configService.getOrThrow<string>("DB_NAME"),
  entities: [
    CategoryEntity,
    SectionEntity,
    TemplateEntity,
    DocumentEntity,
    PdfJobEntity,
  ],
  synchronize: false,
  autoLoadEntities: false,
});
