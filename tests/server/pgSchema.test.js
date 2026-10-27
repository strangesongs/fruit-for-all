// The schema against a real Postgres + PostGIS. Runs when TEST_DATABASE_URL is
// set (CI sets it; locally point it at a throwaway database, never dev or prod),
// and is skipped otherwise. Everything happens in a fresh schema that is dropped
// at the end, so the database is left as it was (apart from the postgis extension).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { migrate, listMigrationFiles } from '../../server/db/migrate.js';
import { sslFor, withoutSslMode } from '../../server/db/postgres.js';

const url = process.env.TEST_DATABASE_URL;
const skip = url ? false : 'TEST_DATABASE_URL is not set';

describe('postgres schema (migrations)', { skip }, () => {
  let client;
  const schema = `ffa_test_${process.pid}_${Date.now()}`;

  const fails = async (sql, params, code) => {
    await client.query('savepoint s');
    try {
      await client.query(sql, params);
      assert.fail(`expected ${code}`);
    } catch (err) {
      assert.equal(err.code, code, err.message);
    } finally {
      await client.query('rollback to savepoint s');
    }
  };
  const user = (name, email) =>
    client.query('insert into users (user_name, email, password_hash) values ($1, $2, $3)', [name, email, 'h']);
  const pin = (id, lat, lng, by = 'alice') =>
    client.query(
      `insert into pins (pin_id, location, fruit_type, fruit_type_display, submitted_by, zone)
       values ($1, st_setsrid(st_makepoint($3, $2), 4326)::geography, 'loquat', 'loquat', $4, 10)`,
      [id, lat, lng, by],
    );

  before(async () => {
    const { default: pg } = await import('pg');
    client = new pg.Client({ connectionString: withoutSslMode(url), ssl: sslFor(url) });
    await client.connect();
    // postgis lives in public; our tables go in the throwaway schema.
    await client.query('create extension if not exists postgis');
    await client.query(`create schema ${schema}`);
    await client.query(`set search_path to ${schema}, public`);
  });

  after(async () => {
    if (!client) return;
    await client.query('rollback').catch(() => {});
    await client.query(`drop schema if exists ${schema} cascade`);
    await client.end();
  });

  test('migrate applies every migration once, in order', async () => {
    const files = await listMigrationFiles();
    assert.equal(files[0], '001_init.sql');
    assert.deepEqual(await migrate(client), files);
    assert.deepEqual(await migrate(client), []);
  });

  test('constraints', async () => {
    await client.query('begin');
    try {
      await user('Alice', 'alice@example.com');
      await fails("insert into users (user_name, email) values ('alice', 'x@example.com')", [], '23505');
      await fails("insert into users (user_name, email) values ('bob', 'alice@example.com')", [], '23505');
      await fails("insert into users (user_name, email) values ('bob', 'Bob@example.com')", [], '23514');

      const id = '3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90';
      await pin(id, 34.06, -118.29, 'Alice');
      await fails(
        "insert into pins (pin_id, location, fruit_type, fruit_type_display, submitted_by, zone) values ($1, 'POINT(0 0)', 'fig', 'fig', 'nobody', 10)",
        ['9b1d2c3e-4f5a-4b6c-8d7e-0f1a2b3c4d5e'],
        '23503',
      );
      await fails("insert into pin_reports (pin_id, reason) values ($1, 'spam')", [id], '23514');
      await fails("update pins set fruit_type = 'Fig' where pin_id = $1", [id], '23514');
    } finally {
      await client.query('rollback');
    }
  });

  test('a box query finds what is inside it, using the location index', async () => {
    await client.query('begin');
    try {
      await user('alice', 'alice@example.com');
      await pin('3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90', 34.06, -118.29); // los angeles
      await pin('9b1d2c3e-4f5a-4b6c-8d7e-0f1a2b3c4d5e', 37.77, -122.42); // san francisco
      const box = `select pin_id from pins
                   where status = 'active'
                     and location && st_makeenvelope($1, $2, $3, $4, 4326)::geography
                   order by created_at desc, pin_id desc limit 200`;
      const { rows } = await client.query(box, [-118.5, 33.9, -118.1, 34.2]);
      assert.deepEqual(rows.map((r) => r.pin_id), ['3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90']);
      const { rows: coords } = await client.query(
        'select st_y(location::geometry) as lat, st_x(location::geometry) as lng from pins where pin_id = $1',
        ['3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90'],
      );
      assert.ok(Math.abs(coords[0].lat - 34.06) < 1e-9 && Math.abs(coords[0].lng + 118.29) < 1e-9);
    } finally {
      await client.query('rollback');
    }
  });

  test('deleting a find deletes its confirmations and reports; renaming a user follows to their finds', async () => {
    await client.query('begin');
    try {
      const id = '3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90';
      await user('alice', 'alice@example.com');
      await pin(id, 34.06, -118.29);
      await client.query('insert into pin_confirmations (pin_id) values ($1), ($1)', [id]);
      await client.query("insert into pin_reports (pin_id, reason) values ($1, 'gone')", [id]);
      await client.query("update users set user_name = 'alice2' where user_name = 'alice'");
      const { rows } = await client.query('select submitted_by from pins where pin_id = $1', [id]);
      assert.equal(rows[0].submitted_by, 'alice2');
      await client.query('delete from pins where pin_id = $1', [id]);
      const left = await client.query(
        'select (select count(*) from pin_confirmations)::int as c, (select count(*) from pin_reports)::int as r',
      );
      assert.deepEqual(left.rows[0], { c: 0, r: 0 });
    } finally {
      await client.query('rollback');
    }
  });

  test('003: a handled report has an outcome; history survives its find and its people', async () => {
    await client.query('begin');
    try {
      const id = '3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90';
      await user('alice', 'alice@example.com');
      await pin(id, 34.06, -118.29);
      await client.query("insert into pin_reports (pin_id, reason) values ($1, 'gone')", [id]);
      await fails("update pin_reports set handled_at = now() where pin_id = $1", [id], '23514');
      await fails("update pin_reports set handled_at = now(), outcome = 'deleted' where pin_id = $1", [id], '23514');
      await client.query("update pin_reports set handled_at = now(), outcome = 'kept', handled_by = 'alice' where pin_id = $1", [id]);
      await fails("insert into pin_events (pin_id, kind, fruit_type) values ($1, 'liked', 'fig')", [id], '23514');
      await client.query("insert into pin_events (pin_id, kind, by_user, fruit_type) values ($1, 'deleted', 'alice', 'fig')", [id]);
      await client.query('delete from pins where pin_id = $1', [id]);
      await client.query("update users set user_name = 'alice2' where user_name = 'alice'");
      let { rows } = await client.query('select by_user from pin_events where pin_id = $1', [id]);
      assert.deepEqual(rows, [{ by_user: 'alice2' }]);
      await client.query("delete from users where user_name = 'alice2'");
      ({ rows } = await client.query('select by_user from pin_events where pin_id = $1', [id]));
      assert.deepEqual(rows, [{ by_user: null }]);
    } finally {
      await client.query('rollback');
    }
  });
});
