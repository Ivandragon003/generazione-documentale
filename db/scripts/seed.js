'use strict';

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { getPool } = require('../../src/database/database');

const isFixtures = process.argv.includes('--fixtures');

const sqlFile = isFixtures
  ? path.join(__dirname, '..', 'seeds', 'fixtures', '001_dev_fixtures.sql')
  : path.join(__dirname, '..', 'seeds', '001_seed_sample.sql');

async function runSeed() {
  const pool   = getPool();
  const client = await pool.connect();
  try {
    console.log(`▶ Seed: ${path.basename(sqlFile)}`);
    if (isFixtures) {
      console.warn('  ⚠️  Fixtures: TRUNCATE CASCADE su tutte le tabelle!');
    }
    const sql = fs.readFileSync(sqlFile, 'utf8');
    await client.query(sql);
    console.log('✅ Seed completato.');
  } catch (err) {
    console.error('❌ Errore seed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runSeed();
