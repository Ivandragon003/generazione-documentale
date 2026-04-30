'use strict';

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { getPool } = require('../src/database/database');

const isFixtures = process.argv.includes('--fixtures');

const sqlFile = isFixtures
  ? path.join(__dirname, '..', 'db', 'seeds', 'fixtures', '001_dev_fixtures.sql')
  : path.join(__dirname, '..', 'db', 'seeds', '001_seed_sample.sql');

async function runSeed() {
  const pool   = getPool();
  const client = await pool.connect();
  try {
    console.log(`\u25b6 Seed: ${path.basename(sqlFile)}`);
    if (isFixtures) {
      console.warn('  \u26a0\ufe0f  Fixtures: TRUNCATE CASCADE su tutte le tabelle!');
    }
    const sql = fs.readFileSync(sqlFile, 'utf8');
    await client.query(sql);
    console.log('\u2705 Seed completato.');
  } catch (err) {
    console.error('\u274c Errore seed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runSeed();
