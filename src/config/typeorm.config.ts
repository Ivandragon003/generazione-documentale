import type { ConfigService } from "@nestjs/config";
import type { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { parsePort } from "../common/utils/parse-port";
import { CategoryEntity } from "../entities/category.entity";
import { DocumentEntity } from "../entities/document.entity";
import { PdfJobEntity } from "../entities/pdf-job.entity";
import { SectionEntity } from "../entities/section.entity";
import { TemplateEntity } from "../entities/template.entity";

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
