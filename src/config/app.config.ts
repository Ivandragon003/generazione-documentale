import { Logger } from "@nestjs/common";

export interface AppConfig {
  maxTemplateContentBytes: number;
  pdfQueueRecoveryRetryMs: number;
  pdfJobsRetentionDays: number;
  pdfFailedJobsRetentionDays: number;
  pdfRetentionRunEveryMs: number;
  auditLogRetentionDays: number | null;
}

const logger = new Logger("app.config");

const readPositiveInt = (
  rawValue: string | undefined,
  varName: string,
  fallback: number,
  min: number,
): number => {
  if (rawValue === undefined) return fallback;

  const normalized = rawValue.trim();
  const parsed = /^\d+$/.test(normalized)
    ? Number.parseInt(normalized, 10)
    : Number.NaN;
  if (Number.isInteger(parsed) && parsed >= min) {
    return parsed;
  }
  logger.warn(`${varName}="${rawValue}" invalid, using default ${fallback}`);
  return fallback;
};

const readRetentionDays = (
  rawValue: string | undefined,
  varName: string,
  fallback: number,
): number | null => {
  if (rawValue === undefined) return fallback;

  const normalized = rawValue.trim();
  const parsed = /^-?\d+$/.test(normalized)
    ? Number.parseInt(normalized, 10)
    : Number.NaN;
  if (Number.isInteger(parsed)) {
    return parsed <= 0 ? null : parsed;
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
    auditLogRetentionDays: readRetentionDays(
      process.env.AUDIT_LOG_RETENTION_DAYS,
      "AUDIT_LOG_RETENTION_DAYS",
      180,
    ),
  };
};

export const appConfig: AppConfig = buildAppConfig();
