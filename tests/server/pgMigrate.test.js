import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { sortMigrationFiles, pendingMigrations, listMigrationFiles } from '../../server/db/migrate.js';
import { describeDatabaseUrl, sslFor, withoutSslMode } from '../../server/db/postgres.js';

describe('migration files', () => {
  test('sorted by number, non-sql ignored', () => {
    assert.deepEqual(sortMigrationFiles(['002_b.sql', 'README.md', '001_a.sql']), ['001_a.sql', '002_b.sql']);
  });
  test('a misnamed file or a reused number throws', () => {
    assert.throws(() => sortMigrationFiles(['1_a.sql']), /NNN_name/);
    assert.throws(() => sortMigrationFiles(['001_a.sql', '001_b.sql']), /share the number 001/);
  });
  test('pending = files not yet applied', () => {
    assert.deepEqual(pendingMigrations(['001_a.sql', '002_b.sql'], ['001_a.sql']), ['002_b.sql']);
    assert.deepEqual(pendingMigrations(['001_a.sql'], ['001_a.sql']), []);
  });
  test('a database ahead of the checkout throws', () => {
    assert.throws(() => pendingMigrations(['001_a.sql'], ['001_a.sql', '002_b.sql']), /002_b\.sql/);
  });
  test('the repo migrations are well named, starting at 001_init.sql', async () => {
    const files = await listMigrationFiles();
    assert.equal(files[0], '001_init.sql');
  });
});

describe('postgres connection helpers', () => {
  test('describeDatabaseUrl never shows the user or password', () => {
    const d = describeDatabaseUrl('postgresql://postgres:s3cret@roundhouse.proxy.rlwy.net:41234/railway');
    assert.equal(d, 'roundhouse.proxy.rlwy.net:41234/railway');
    assert.equal(d.includes('s3cret'), false);
    assert.equal(describeDatabaseUrl(undefined), '(unset)');
    assert.equal(describeDatabaseUrl('nope'), '(unparseable)');
  });
  test('ssl: off for localhost and Railway internal, on (unverified) for the public proxy', () => {
    assert.equal(sslFor('postgres://u:p@localhost:5432/ffa'), false);
    assert.equal(sslFor('postgres://u:p@postgres.railway.internal:5432/railway'), false);
    assert.deepEqual(sslFor('postgres://u:p@roundhouse.proxy.rlwy.net:41234/railway'), { rejectUnauthorized: false });
  });
  test('ssl: sslmode in the URL wins, then is stripped for pg', () => {
    assert.equal(sslFor('postgres://u:p@db.example.com/x?sslmode=disable'), false);
    assert.equal(sslFor('postgres://u:p@db.example.com/x?sslmode=verify-full'), true);
    assert.equal(withoutSslMode('postgres://u:p@db.example.com/x?sslmode=require'), 'postgres://u:p@db.example.com/x');
  });
});
