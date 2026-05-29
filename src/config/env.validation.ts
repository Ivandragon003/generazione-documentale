import { parsePort } from "../common/utils/parse-port";

const requireEnv = (value: string | undefined, key: string): string => {
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const validateEnv = (env: NodeJS.ProcessEnv): NodeJS.ProcessEnv => {
  const dbHost = requireEnv(env.DB_HOST, "DB_HOST");
  const dbPortRaw = requireEnv(env.DB_PORT, "DB_PORT");
  const dbUser = requireEnv(env.DB_USER, "DB_USER");
  const dbPassword = requireEnv(env.DB_PASSWORD, "DB_PASSWORD");
  const dbName = requireEnv(env.DB_NAME, "DB_NAME");
  const port = requireEnv(env.PORT, "PORT");
  const nodeEnv = (env.NODE_ENV ?? "development").trim().toLowerCase();
  const pdfServiceUrl = env.PDF_SERVICE_URL?.trim() ?? "";
  const enableLocalPdfFallback =
    env.ENABLE_LOCAL_PDF_FALLBACK?.trim().toLowerCase() ?? "false";
  const aiProvider = env.AI_PROVIDER?.trim().toLowerCase() ?? "mock";

  parsePort(dbPortRaw, "DB_PORT");
  parsePort(port, "PORT");

  if (!["development", "test", "production"].includes(nodeEnv)) {
    throw new Error(
      `Invalid NODE_ENV="${env.NODE_ENV}". Allowed: development, test, production`,
    );
  }

  if (!["true", "false", ""].includes(enableLocalPdfFallback)) {
    throw new Error(
      `Invalid ENABLE_LOCAL_PDF_FALLBACK="${env.ENABLE_LOCAL_PDF_FALLBACK}". Allowed: true, false`,
    );
  }
  if (!["mock", "ollama"].includes(aiProvider)) {
    throw new Error(
      `Invalid AI_PROVIDER="${env.AI_PROVIDER}". Allowed: mock, ollama`,
    );
  }

  if (nodeEnv === "production" && pdfServiceUrl.length === 0) {
    throw new Error(
      "Missing required environment variable: PDF_SERVICE_URL (production mode requires remote pdf-service)",
    );
  }

  return {
    ...env,
    NODE_ENV: nodeEnv,
    DB_HOST: dbHost,
    DB_PORT: dbPortRaw,
    DB_USER: dbUser,
    DB_PASSWORD: dbPassword,
    DB_NAME: dbName,
    PORT: port,
    PDF_SERVICE_URL: pdfServiceUrl,
    ENABLE_LOCAL_PDF_FALLBACK: enableLocalPdfFallback,
    AI_PROVIDER: aiProvider,
    OLLAMA_BASE_URL: env.OLLAMA_BASE_URL?.trim() ?? "",
    OLLAMA_MODEL: env.OLLAMA_MODEL?.trim() ?? "",
    OLLAMA_DRAFT_NUM_PREDICT: env.OLLAMA_DRAFT_NUM_PREDICT?.trim() ?? "",
    OLLAMA_COMPACT_PROMPT_CHARS: env.OLLAMA_COMPACT_PROMPT_CHARS?.trim() ?? "",
    OLLAMA_MAX_PROMPT_CHARS: env.OLLAMA_MAX_PROMPT_CHARS?.trim() ?? "",
    OLLAMA_AUDIT_NUM_PREDICT: env.OLLAMA_AUDIT_NUM_PREDICT?.trim() ?? "",
    OLLAMA_DRAFT_TEMPERATURE: env.OLLAMA_DRAFT_TEMPERATURE?.trim() ?? "",
    OLLAMA_KEEP_ALIVE: env.OLLAMA_KEEP_ALIVE?.trim() ?? "",
  };
};
