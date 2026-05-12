import "dotenv/config";
import { DataSource } from "typeorm";
import { parsePort } from "../common/utils/parse-port";
import { DocumentEntity } from "../entities/document.entity";
import { PdfJobEntity } from "../entities/pdf-job.entity";
import { TemplateEntity } from "../entities/template.entity";

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export default new DataSource({
  type: "postgres",
  host: requireEnv("DB_HOST"),
  port: parsePort(requireEnv("DB_PORT"), "DB_PORT"),
  username: requireEnv("DB_USER"),
  password: requireEnv("DB_PASSWORD"),
  database: requireEnv("DB_NAME"),
  entities: [TemplateEntity, DocumentEntity, PdfJobEntity],
  migrations: ["src/migrations/*.ts"],
  synchronize: false,
});
