import { config } from "dotenv";

config();

const BASE_URL = (process.env.API_BASE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);
const API_ENDPOINT = `${BASE_URL}/api/dev/test-runs/execute`;

/**
 * Sanitize log message to prevent log injection attacks.
 * Removes newline and carriage return characters.
 */
const sanitizeLog = (text: string): string =>
  text.replaceAll("\n", " ").replaceAll("\r", " ");

const main = async (): Promise<void> => {
  const response = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ suite: "api-regression" }),
  });

  const body = (await response.json()) as { ok?: boolean };
  // eslint-disable-next-line no-console
  console.log(sanitizeLog(JSON.stringify(body, null, 2)));

  if (response.ok && body.ok === true) {
    return;
  }
  process.exit(1);
};

main().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  const message = error instanceof Error ? error.message : "Errore test API";
  console.error(sanitizeLog(message));
  process.exit(1);
});
