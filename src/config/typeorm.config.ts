import type { ConfigService } from "@nestjs/config";
import type { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { parsePort } from "../common/utils/parse-port";
import { PdfJobEntity } from "../entities/pdf-job.entity";
import { TemplateEntity } from "../entities/template.entity";

export const buildTypeOrmOptions = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  return {
    type: "postgres",
    host: configService.getOrThrow<string>("DB_HOST"),
    port: parsePort(configService.getOrThrow<string>("DB_PORT")),
    username: configService.getOrThrow<string>("DB_USER"),
    password: configService.getOrThrow<string>("DB_PASSWORD"),
    database: configService.getOrThrow<string>("DB_NAME"),
    entities: [TemplateEntity, PdfJobEntity],
    synchronize: false,
    migrationsRun: true,
    migrations: ["dist/migrations/*.js"],
    autoLoadEntities: false,
  };
};
