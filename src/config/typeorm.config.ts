import type { ConfigService } from "@nestjs/config";
import type { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { parsePort } from "../common/utils/parse-port";
import { DocumentEntity } from "../entities/document.entity";
import { PdfJobEntity } from "../entities/pdf-job.entity";
import { TemplateEntity } from "../entities/template.entity";

export const buildTypeOrmOptions = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const nodeEnv = configService.get<string>("NODE_ENV") ?? "development";
  const isProduction = nodeEnv === "production";

  return {
    type: "postgres",
    host: configService.getOrThrow<string>("DB_HOST"),
    port: parsePort(configService.getOrThrow<string>("DB_PORT")),
    username: configService.getOrThrow<string>("DB_USER"),
    password: configService.getOrThrow<string>("DB_PASSWORD"),
    database: configService.getOrThrow<string>("DB_NAME"),
    entities: [TemplateEntity, DocumentEntity, PdfJobEntity],
    // Entity-first policy:
    // - development: direct sync from entities (automatic schema updates)
    // - staging/production: DISABLED - use migrations only (safer for production data)
    // WARNING: Never set synchronize:true in staging or production environments!
    // This can cause data loss when schema changes are deployed.
    synchronize: !isProduction,
    migrationsRun: isProduction,
    migrations: ["dist/migrations/*.js"],
    autoLoadEntities: false,
  };
};
