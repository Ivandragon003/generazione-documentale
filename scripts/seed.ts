import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { config } from "dotenv";
import { Pool } from "pg";

config();

const isFixtures = process.argv.includes("--fixtures");
const sqlFile = isFixtures
  ? join(__dirname, "..", "db", "seeds", "fixtures", "001_dev_fixtures.sql")
  : join(__dirname, "..", "db", "seeds", "001_seed_sample.sql");

const pool = new Pool({
  host: process.env.DB_HOST ?? "localhost",
  port: Number.parseInt(process.env.DB_PORT ?? "5432", 10),
  user: process.env.DB_USER ?? "postgres",
  password: process.env.DB_PASSWORD ?? "postgres",
  database: process.env.DB_NAME ?? "mac_documents",
});

const runSeed = async (): Promise<void> => {
  const client = await pool.connect();
  try {
    // eslint-disable-next-line no-console
    console.log(`Seed: ${basename(sqlFile)}`);
    if (isFixtures) {
      // eslint-disable-next-line no-console
      console.warn("Fixtures: TRUNCATE CASCADE su tutte le tabelle");
    }

    const sql = readFileSync(sqlFile, "utf8");
    await client.query(sql);
    // eslint-disable-next-line no-console
    console.log("Seed completato");
  } finally {
    client.release();
    await pool.end();
  }
};

runSeed().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : "Errore seed");
  process.exit(1);
});
