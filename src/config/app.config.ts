import { Logger } from "@nestjs/common";

export interface AppConfig {
  maxTemplateContentBytes: number;
  pdfQueueRecoveryRetryMs: number;
  pdfJobsRetentionDays: number;
  pdfFailedJobsRetentionDays: number;
  pdfRetentionRunEveryMs: number;
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
  logger.warn(`${varName}="${rawValue}" invalid, using default ${fallback}`);
  return fallback;
};

const buildAppConfig = (): AppConfig => {
  return {
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
    pdfJobsRetentionDays: readPositiveInt(
      process.env.PDF_JOBS_RETENTION_DAYS,
      "PDF_JOBS_RETENTION_DAYS",
      30,
      1,
    ),
    pdfFailedJobsRetentionDays: readPositiveInt(
      process.env.PDF_FAILED_JOBS_RETENTION_DAYS,
      "PDF_FAILED_JOBS_RETENTION_DAYS",
      7,
      1,
    ),
    pdfRetentionRunEveryMs: readPositiveInt(
      process.env.PDF_RETENTION_RUN_EVERY_MS,
      "PDF_RETENTION_RUN_EVERY_MS",
      3600000,
      60000,
    ),
  };
};

export const appConfig: AppConfig = buildAppConfig();
