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

  parsePort(dbPortRaw, "DB_PORT");

  return {
    ...env,
    DB_HOST: dbHost,
    DB_PORT: dbPortRaw,
    DB_USER: dbUser,
    DB_PASSWORD: dbPassword,
    DB_NAME: dbName,
  };
};
