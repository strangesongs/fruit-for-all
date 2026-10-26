// Helper for tests that run the Postgres data layer for real (not a test file:
// npm test only runs *.test.js). Each suite gets a throwaway schema with every
// migration applied, and DATABASE_URL pointed at it, so server/db/postgres.js
// (and everything built on it) talks only to that schema. Dropped afterwards.
//
// TEST_DATABASE_URL: CI's postgis service, or a throwaway local database.
// TEST_MIGRATIONS_DIR (optional): apply migrations from another folder, e.g. a
// copy with PostGIS stubbed out on a machine without it (users-only checks).
import { migrate, MIGRATIONS_DIR } from '../../server/db/migrate.js';
import { sslFor, withoutSslMode, closePool } from '../../server/db/postgres.js';

export const TEST_URL = process.env.TEST_DATABASE_URL;
export const skipReason = TEST_URL ? false : 'TEST_DATABASE_URL is not set';

export async function openTestSchema(label) {
  const { default: pg } = await import('pg');
  const schema = `ffa_test_${label}_${process.pid}_${Date.now()}`;
  const admin = new pg.Client({ connectionString: withoutSslMode(TEST_URL), ssl: sslFor(TEST_URL) });
  await admin.connect();
  if (!process.env.TEST_MIGRATIONS_DIR) await admin.query('create extension if not exists postgis');
  await admin.query(`create schema ${schema}`);
  await admin.query(`set search_path to ${schema}, public`);
  await migrate(admin, { dir: process.env.TEST_MIGRATIONS_DIR || MIGRATIONS_DIR });

  // Every pooled connection starts in the test schema.
  const u = new URL(TEST_URL);
  u.searchParams.set('options', `-c search_path=${schema},public`);
  await closePool();
  process.env.DATABASE_URL = u.toString();

  return {
    schema,
    db: admin,
    /** Empties every table between tests. */
    async reset() {
      await admin.query('truncate pin_reports, pin_confirmations, pins, password_resets, users restart identity cascade');
    },
    async close() {
      await closePool();
      delete process.env.DATABASE_URL;
      await admin.query(`drop schema if exists ${schema} cascade`);
      await admin.end();
    },
  };
}
