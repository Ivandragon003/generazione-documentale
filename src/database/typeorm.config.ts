import type { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { AuditLogEntity } from "../entities/audit-log.entity";
import { DocumentEntity } from "../entities/document.entity";
import { DocumentVersionEntity } from "../entities/document-version.entity";
import { PdfJobEntity } from "../entities/pdf-job.entity";
import { TemplateEntity } from "../entities/template.entity";
import { TemplateVersionEntity } from "../entities/template-version.entity";

const parsePort = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) ? parsed : fallback;
};

export const buildTypeOrmOptions = (): TypeOrmModuleOptions => ({
  type: "postgres",
  host: process.env.DB_HOST ?? "localhost",
  port: parsePort(process.env.DB_PORT, 5432),
  username: process.env.DB_USER ?? "postgres",
  password: process.env.DB_PASSWORD ?? "postgres",
  database: process.env.DB_NAME ?? "mac_documents",
  entities: [
    TemplateEntity,
    TemplateVersionEntity,
    DocumentEntity,
    DocumentVersionEntity,
    PdfJobEntity,
    AuditLogEntity,
  ],
  synchronize: false,
  autoLoadEntities: false,
});
