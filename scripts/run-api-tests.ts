import { config } from "dotenv";

config();

const baseUrl = (process.env.API_BASE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

const main = async (): Promise<void> => {
  const response = await fetch(`${baseUrl}/api/dev/test-runs/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ suite: "api-regression" }),
  });

  const body = (await response.json()) as { ok?: boolean };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(body, null, 2));

  if (!response.ok || body.ok !== true) {
    process.exit(1);
  }
};

main().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : "Errore test API");
  process.exit(1);
});
