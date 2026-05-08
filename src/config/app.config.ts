import { Logger } from "@nestjs/common";

export interface AppConfig {
  uploadPath: string;
  templatesStoragePath: string;
  maxFileSizeBytes: number;
  maxTemplateContentBytes: number;
  pdfQueueRecoveryRetryMs: number;
}

const logger = new Logger("app.config");

const readPositiveInt = (
  rawValue: string | undefined,
  varName: string,
  fallback: number,
  min: number,
): number => {
  const parsed = Number.parseInt(rawValue ?? "", 10);
  if (Number.isInteger(parsed) && parsed >= min) {
    return parsed;
  }
  logger.warn(
    `${varName}="${rawValue}" non valido, uso default ${fallback}`,
  );
  return fallback;
};

const buildAppConfig = (): AppConfig => {
  const maxFileSizeMb = readPositiveInt(
    process.env.MAX_FILE_SIZE_MB,
    "MAX_FILE_SIZE_MB",
    10,
    1,
  );

  return {
    uploadPath: process.env.UPLOAD_PATH ?? "./storage/uploads",
    templatesStoragePath:
      process.env.TEMPLATES_STORAGE_PATH ?? "./storage/templates",
    maxFileSizeBytes: maxFileSizeMb * 1024 * 1024,
    maxTemplateContentBytes: readPositiveInt(
      process.env.MAX_TEMPLATE_CONTENT_BYTES,
      "MAX_TEMPLATE_CONTENT_BYTES",
      200000,
      1000,
    ),
    pdfQueueRecoveryRetryMs: readPositiveInt(
      process.env.PDF_QUEUE_RECOVERY_RETRY_MS,
      "PDF_QUEUE_RECOVERY_RETRY_MS",
      10000,
      1000,
    ),
  };
};

export const appConfig: AppConfig = buildAppConfig();
