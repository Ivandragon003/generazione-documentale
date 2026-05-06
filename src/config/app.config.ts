export interface GithubConfig {
  owner: string;
  repo: string;
  branch: string;
  templatesDir: string;
  catalogPath: string;
  token?: string;
}

export interface AppConfig {
  uploadPath: string;
  maxFileSizeBytes: number;
  maxTemplateContentBytes: number;
  pdfQueueRecoveryRetryMs: number;
  github: GithubConfig;
}

const readPositiveInt = (
  rawValue: string | undefined,
  fallback: number,
  min: number,
): number => {
  const parsed = Number.parseInt(rawValue ?? "", 10);
  if (Number.isInteger(parsed) && parsed >= min) {
    return parsed;
  }
  return fallback;
};

const buildAppConfig = (): AppConfig => {
  const maxFileSizeMb = readPositiveInt(process.env.MAX_FILE_SIZE_MB, 10, 1);

  return {
    uploadPath: process.env.UPLOAD_PATH ?? "./storage/uploads",
    maxFileSizeBytes: maxFileSizeMb * 1024 * 1024,
    maxTemplateContentBytes: readPositiveInt(
      process.env.MAX_TEMPLATE_CONTENT_BYTES,
      200000,
      1000,
    ),
    pdfQueueRecoveryRetryMs: readPositiveInt(
      process.env.PDF_QUEUE_RECOVERY_RETRY_MS,
      10000,
      1000,
    ),
    github: {
      owner: process.env.GITHUB_TEMPLATES_OWNER ?? "",
      repo: process.env.GITHUB_TEMPLATES_REPO ?? "",
      branch: process.env.GITHUB_TEMPLATES_BRANCH ?? "main",
      templatesDir: process.env.GITHUB_TEMPLATES_DIR ?? "templates-catalog",
      catalogPath:
        process.env.GITHUB_TEMPLATES_CATALOG_PATH ??
        "templates-catalog/CATALOG.json",
      token: process.env.GITHUB_TOKEN,
    },
  };
};

export const appConfig: AppConfig = buildAppConfig();
