/**
 * Applies server/db/migrations/NNN_name.sql files in order and records each in
 * schema_migrations. Each file runs in its own transaction, so a failed file
 * leaves nothing half-applied. `client` is anything with pg's `query(sql, params)`.
 *
 * CLI: scripts/migrate.mjs. Tests: tests/server/pgMigrate.test.js (pure parts)
 * and tests/server/pgSchema.test.js (against a real Postgres when TEST_DATABASE_URL is set).
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

export const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

const FILE_RE = /^(\d{3})_[a-z0-9_]+\.sql$/;

/** Migration file names in apply order. Throws on a misnamed file or a reused number. */
export function sortMigrationFiles(names) {
  const sql = names.filter((n) => n.endsWith('.sql'));
  const bad = sql.filter((n) => !FILE_RE.test(n));
  if (bad.length) throw new Error(`Migration files must be named NNN_name.sql: ${bad.join(', ')}`);
  const sorted = [...sql].sort();
  const seen = new Set();
  for (const n of sorted) {
    const num = n.slice(0, 3);
    if (seen.has(num)) throw new Error(`Two migrations share the number ${num}`);
    seen.add(num);
  }
  return sorted;
}

/** Files not yet applied. Throws if the database has one this checkout doesn't (wrong branch). */
export function pendingMigrations(files, applied) {
  const known = new Set(files);
  const unknown = [...applied].filter((a) => !known.has(a));
  if (unknown.length) {
    throw new Error(`The database has migrations this checkout doesn't: ${unknown.join(', ')}`);
  }
  const done = new Set(applied);
  return files.filter((f) => !done.has(f));
}

export async function listMigrationFiles(dir = MIGRATIONS_DIR) {
  return sortMigrationFiles(await fs.readdir(dir));
}

/**
 * @returns {Promise<string[]>} the files applied by this run
 */
export async function migrate(client, { dir = MIGRATIONS_DIR, log = () => {} } = {}) {
  // Two deploys starting at once must not both apply 002.
  await client.query('select pg_advisory_lock($1)', [MIGRATION_LOCK]);
  try {
    return await applyPending(client, dir, log);
  } finally {
    await client.query('select pg_advisory_unlock($1)', [MIGRATION_LOCK]);
  }
}

// Any fixed bigint; "ffa" + 1.
const MIGRATION_LOCK = 0x666661_01;

async function applyPending(client, dir, log) {
  await client.query(
    `create table if not exists schema_migrations (
       name text primary key,
       applied_at timestamptz not null default now()
     )`,
  );
  const { rows } = await client.query('select name from schema_migrations order by name');
  const files = await listMigrationFiles(dir);
  const todo = pendingMigrations(files, rows.map((r) => r.name));
  for (const name of todo) {
    const sql = await fs.readFile(path.join(dir, name), 'utf8');
    await client.query('begin');
    try {
      await client.query(sql);
      await client.query('insert into schema_migrations (name) values ($1)', [name]);
      await client.query('commit');
      log(`applied ${name}`);
    } catch (err) {
      await client.query('rollback');
      throw new Error(`Migration ${name} failed: ${err.message}`, { cause: err });
    }
  }
  return todo;
}
