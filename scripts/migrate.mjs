#!/usr/bin/env node
// Applies pending server/db/migrations/*.sql to DATABASE_URL.
//   npm run db:migrate              (uses .env when present)
//   DATABASE_URL=… node scripts/migrate.mjs
// Prints the target host/database first, so a run against the wrong one is obvious.
import { describeDatabaseUrl, getPool, closePool } from '../server/db/postgres.js';
import { migrate } from '../server/db/migrate.js';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}
console.log(`[migrate] database ${describeDatabaseUrl(url)}`);

try {
  const pool = await getPool();
  const client = await pool.connect();
  try {
    const applied = await migrate(client, { log: (m) => console.log(`[migrate] ${m}`) });
    console.log(applied.length ? `[migrate] done: ${applied.length} applied` : '[migrate] up to date');
  } finally {
    client.release();
  }
} catch (err) {
  console.error(`[migrate] ${err.message}`);
  process.exitCode = 1;
} finally {
  await closePool();
}
