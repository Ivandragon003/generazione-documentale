import { readFileSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { config } from "dotenv";
import { Pool, type PoolClient } from "pg";

config();

const SCHEMA_FILE = join(__dirname, "..", "schema.sql");
const MIGRATIONS_DIR = __dirname;
const TEMPLATE_STORAGE_PATH =
  process.env.TEMPLATE_STORAGE_PATH ?? "./storage/templates";

const pool = new Pool({
  host: process.env.DB_HOST ?? "localhost",
  port: Number.parseInt(process.env.DB_PORT ?? "5432", 10),
  user: process.env.DB_USER ?? "postgres",
  password: process.env.DB_PASSWORD ?? "postgres",
  database: process.env.DB_NAME ?? "mac_documents",
});

const columnExists = async (
  client: PoolClient,
  table: string,
  column: string,
): Promise<boolean> => {
  const result = await client.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column],
  );

  return result.rows.length > 0;
};

const writeTemplateFile = async (
  id: string,
  version: number,
  content: string,
): Promise<string> => {
  const directory = join(TEMPLATE_STORAGE_PATH, id);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, `v${version}.md`), content, "utf8");
  return `${id}/v${version}.md`;
};

const backfillTemplateFiles = async (client: PoolClient): Promise<void> => {
  const hasTemplateContent = await columnExists(client, "templates", "content");
  const hasTemplateVersionContent = await columnExists(
    client,
    "template_versions",
    "content",
  );

  if (!hasTemplateContent && !hasTemplateVersionContent) {
    return;
  }

  if (hasTemplateVersionContent) {
    const result = await client.query<{
      template_id: string;
      version: number;
      content: string;
    }>(
      `SELECT template_id, version, content
       FROM template_versions
       WHERE content_path IS NULL AND content IS NOT NULL`,
    );

    for (const row of result.rows) {
      const contentPath = await writeTemplateFile(
        row.template_id,
        row.version,
        row.content,
      );
      await client.query(
        `UPDATE template_versions
         SET content_path = $1
         WHERE template_id = $2 AND version = $3`,
        [contentPath, row.template_id, row.version],
      );
    }
  }

  if (hasTemplateContent) {
    const result = await client.query<{
      id: string;
      version: number;
      content: string;
    }>(
      `SELECT id, version, content
       FROM templates
       WHERE content_path IS NULL AND content IS NOT NULL`,
    );

    for (const row of result.rows) {
      const contentPath = await writeTemplateFile(
        row.id,
        row.version,
        row.content,
      );
      await client.query(
        "UPDATE templates SET content_path = $1 WHERE id = $2",
        [contentPath, row.id],
      );
    }
  }
};

const runIncrementalMigrations = async (client: PoolClient): Promise<void> => {
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((name) => /^\d+.*\.sql$/i.test(name))
    .sort((left, right) => left.localeCompare(right));

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    await client.query(sql);
    // eslint-disable-next-line no-console
    console.log(`Executed migration: ${file}`);
  }
};

const runMigrations = async (): Promise<void> => {
  const client = await pool.connect();
  try {
    // eslint-disable-next-line no-console
    console.log("Starting migrations");
    const schemaSql = readFileSync(SCHEMA_FILE, "utf8");
    await client.query(schemaSql);
    await runIncrementalMigrations(client);
    await backfillTemplateFiles(client);
    // eslint-disable-next-line no-console
    console.log(`Migrations completed from ${basename(MIGRATIONS_DIR)}`);
  } finally {
    client.release();
    await pool.end();
  }
};

runMigrations().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : "Errore migrazione");
  process.exit(1);
});
