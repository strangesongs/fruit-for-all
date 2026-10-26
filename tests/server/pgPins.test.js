// Finds on Postgres (server/schemas/pg/pins.js), against a real PostGIS.
// Skipped without TEST_DATABASE_URL (see pgTestDb.js). The shape checks at the
// bottom run everywhere.
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as pgPins from '../../server/schemas/pg/pins.js';
import * as dynamoPins from '../../server/schemas/pins.js';
import { PinsQueryError } from '../../server/schemas/errors.js';
import { openTestSchema, skipReason } from './pgTestDb.js';

const LA = { lat: 34.06, lng: -118.29 };
const SHAPE = [
  'pinId', 'createdAt', 'updatedAt', 'coordinates', 'fruitType', 'fruitTypeDisplay', 'notes',
  'submittedBy', 'geoHash', 'status', 'zone', 'confirmations',
].sort();
const quiet = async (fn) => {
  const realError = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = realError;
  }
};

describe('finds on postgres', { skip: skipReason }, () => {
  let t;
  const zoneCalls = [];
  const addUser = (name) => t.db.query("insert into users (user_name, email) values ($1, $2)", [name, `${name.toLowerCase()}@example.com`]);
  // A find with a chosen creation time (for ordering and paging tests).
  const addRaw = async ({ id, at, lat = LA.lat, lng = LA.lng, by = 'alice', status = 'active', kind = 'fig' }) => {
    await t.db.query(
      `insert into pins (pin_id, created_at, location, fruit_type, fruit_type_display, submitted_by, status, zone)
       values ($1, $2, st_setsrid(st_makepoint($4, $3), 4326)::geography, $5, $5, $6, $7, 10)`,
      [id, at, lat, lng, kind, by, status],
    );
  };
  const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

  before(async () => {
    t = await openTestSchema('pins');
    pgPins.setZoneDetectorForTests(async (lat, lng) => {
      zoneCalls.push([lat, lng]);
      return 10;
    });
  });
  after(async () => {
    pgPins.setZoneDetectorForTests(null);
    await t?.close();
  });
  beforeEach(async () => {
    await t.reset();
    zoneCalls.length = 0;
    await addUser('alice');
    await addUser('Bob');
  });

  test('createPin returns the same shape as DynamoDB, kind stored as typed', async () => {
    const pin = await pgPins.createPin({ coordinates: LA, fruitType: "st. john's wort", notes: ' by the gate ', submittedBy: 'alice' });
    assert.deepEqual(Object.keys(pin).sort(), SHAPE);
    assert.match(pin.pinId, /^[0-9a-f-]{36}$/);
    assert.deepEqual(pin.coordinates, LA);
    assert.equal(pin.fruitType, "st. john's wort");
    assert.equal(pin.notes, 'by the gate');
    assert.equal(pin.zone, 10);
    assert.equal(pin.updatedAt, null);
    assert.deepEqual(pin.confirmations, []);
    assert.equal(pin.geoHash, '340600_-1182900');
    assert.equal(pin.createdAt, new Date(pin.createdAt).toISOString());
    assert.deepEqual(await pgPins.getPinById(pin.pinId), pin);
  });

  test('createPin refuses bad input before touching the database', async () => {
    await assert.rejects(pgPins.createPin({ coordinates: LA, fruitType: 'fig' }), /Missing/);
    await assert.rejects(pgPins.createPin({ coordinates: { lat: '34', lng: 1 }, fruitType: 'fig', submittedBy: 'alice' }), /Invalid coordinates/);
    await assert.rejects(pgPins.createPin({ coordinates: { lat: 95, lng: 1 }, fruitType: 'fig', submittedBy: 'alice' }), /Latitude/);
  });

  test('getPinById: not a UUID or unknown → null; withReports adds reportCount', async () => {
    assert.equal(await pgPins.getPinById('nope'), null);
    assert.equal(await pgPins.getPinById(uuid(99)), null);
    await addRaw({ id: uuid(1), at: '2026-01-01T00:00:00.000Z' });
    assert.equal('reportCount' in (await pgPins.getPinById(uuid(1))), false);
    await pgPins.reportPin({ pinId: uuid(1) }, { reason: 'gone' });
    assert.equal((await pgPins.getPinById(uuid(1), { withReports: true })).reportCount, 1);
  });

  test('a box returns active finds inside it (edges included), newest first', async () => {
    await addRaw({ id: uuid(1), at: '2026-01-01T00:00:00.000Z' });
    await addRaw({ id: uuid(2), at: '2026-02-01T00:00:00.000Z', lat: 34.1, lng: -118.2 }); // on the corner
    await addRaw({ id: uuid(3), at: '2026-03-01T00:00:00.000Z', lat: 37.77, lng: -122.42 }); // san francisco
    await addRaw({ id: uuid(4), at: '2026-04-01T00:00:00.000Z', status: 'removed' });
    const bounds = { minLat: 34.0, maxLat: 34.1, minLng: -118.3, maxLng: -118.2 };
    const { pins, hasMore, cursor } = await pgPins.getAllPins({ bounds, limit: 200 });
    assert.deepEqual(pins.map((p) => p.pinId), [uuid(2), uuid(1)]);
    assert.equal(hasMore, false);
    assert.equal(cursor, null);
  });

  test('a box that cannot match anything is empty, not an error', async () => {
    await addRaw({ id: uuid(1), at: '2026-01-01T00:00:00.000Z' });
    for (const bounds of [
      { minLat: NaN, maxLat: 35, minLng: -119, maxLng: -118 },
      { minLat: 35, maxLat: 34, minLng: -119, maxLng: -118 },
    ]) {
      assert.deepEqual(await pgPins.getAllPins({ bounds }), { pins: [], cursor: null, hasMore: false });
    }
  });

  test('paging walks every find once, newest first, ties broken by id', async () => {
    const at = ['2026-01-01', '2026-01-02', '2026-01-02', '2026-01-03', '2026-01-04'];
    for (let i = 0; i < at.length; i += 1) await addRaw({ id: uuid(i + 1), at: `${at[i]}T00:00:00.000Z` });
    const seen = [];
    let cursor = null;
    let pages = 0;
    do {
      const page = await pgPins.getAllPins({ limit: 2, cursor });
      seen.push(...page.pins.map((p) => p.pinId));
      cursor = page.cursor;
      assert.equal(page.hasMore, !!cursor);
      pages += 1;
    } while (cursor && pages < 10);
    assert.deepEqual(seen, [uuid(5), uuid(4), uuid(3), uuid(2), uuid(1)]);
    assert.equal(pages, 3);
    // A cursor this module didn't make starts the list over.
    assert.equal((await pgPins.getAllPins({ limit: 2, cursor: 'garbage' })).pins[0].pinId, uuid(5));
  });

  test("submittedBy lists that person's finds, removed ones too, newest first", async () => {
    await addRaw({ id: uuid(1), at: '2026-01-01T00:00:00.000Z' });
    await addRaw({ id: uuid(2), at: '2026-02-01T00:00:00.000Z', status: 'removed' });
    await addRaw({ id: uuid(3), at: '2026-03-01T00:00:00.000Z', by: 'Bob' });
    const { pins } = await pgPins.getAllPins({ submittedBy: 'alice', limit: 100 });
    assert.deepEqual(pins.map((p) => p.pinId), [uuid(2), uuid(1)]);
  });

  test('confirmPin adds a confirmation and returns the pin; unknown or bad id → null', async () => {
    await addRaw({ id: uuid(1), at: '2026-01-01T00:00:00.000Z' });
    await pgPins.confirmPin(uuid(1));
    const pin = await pgPins.confirmPin(uuid(1));
    assert.equal(pin.confirmations.length, 2);
    assert.deepEqual(Object.keys(pin.confirmations[0]).sort(), ['anonymous', 'timestamp']);
    assert.ok(pin.confirmations[0].timestamp <= pin.confirmations[1].timestamp);
    assert.equal(await pgPins.confirmPin(uuid(99)), null);
    assert.equal(await pgPins.confirmPin('not-a-uuid'), null);
  });

  test('reportPin stores each report; a deleted find is stored=false', async () => {
    await addRaw({ id: uuid(1), at: '2026-01-01T00:00:00.000Z' });
    assert.deepEqual(await pgPins.reportPin({ pinId: uuid(1) }, { reason: 'gone', note: 'stump' }), { stored: true });
    assert.deepEqual(await pgPins.reportPin({ pinId: uuid(1) }, { reason: 'unsafe' }), { stored: true });
    const { rows } = await t.db.query('select reason, note from pin_reports order by id');
    assert.deepEqual(rows, [{ reason: 'gone', note: 'stump' }, { reason: 'unsafe', note: '' }]);
    assert.deepEqual(await pgPins.reportPin({ pinId: uuid(99) }, { reason: 'gone' }), { stored: false });
  });

  test('updatePin: notes, kind and a move (zone re-detected, updatedAt set)', async () => {
    await addRaw({ id: uuid(1), at: '2026-01-01T00:00:00.000Z' });
    let pin = await pgPins.updatePin(uuid(1), { notes: 'gate code 12' });
    assert.equal(pin.notes, 'gate code 12');
    assert.ok(pin.updatedAt);
    assert.deepEqual(zoneCalls, []);
    pin = await pgPins.updatePin(uuid(1), { fruitType: "lamb's quarters" });
    assert.equal(pin.fruitType, "lamb's quarters");
    pin = await pgPins.updatePin(uuid(1), { coordinates: { lat: 34.0605, lng: -118.2905 } });
    assert.deepEqual(pin.coordinates, { lat: 34.0605, lng: -118.2905 });
    assert.deepEqual(zoneCalls, [[34.0605, -118.2905]]);
    assert.equal(pin.notes, 'gate code 12');
    assert.deepEqual(await pgPins.updatePin(uuid(1), {}), pin);
    await assert.rejects(pgPins.updatePin(uuid(99), { notes: 'x' }), /Pin not found/);
  });

  test('deletePin removes the find with its confirmations and reports', async () => {
    await addRaw({ id: uuid(1), at: '2026-01-01T00:00:00.000Z' });
    await pgPins.confirmPin(uuid(1));
    await pgPins.reportPin({ pinId: uuid(1) }, { reason: 'gone' });
    assert.equal(await pgPins.deletePin(uuid(1)), true);
    assert.equal(await pgPins.getPinById(uuid(1)), null);
    const { rows } = await t.db.query('select (select count(*) from pin_confirmations)::int c, (select count(*) from pin_reports)::int r');
    assert.deepEqual(rows[0], { c: 0, r: 0 });
    await assert.rejects(pgPins.deletePin(uuid(1)), /Pin not found/);
  });

  test('a database failure is PinsQueryError, never an empty map or "no such find"', async () => {
    await t.db.query('alter table pins rename to pins_gone');
    try {
      await quiet(async () => {
        await assert.rejects(pgPins.getAllPins({}), PinsQueryError);
        await assert.rejects(pgPins.getAllPins({ bounds: { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 } }), PinsQueryError);
        await assert.rejects(pgPins.getPinById(uuid(1)), PinsQueryError);
      });
    } finally {
      await t.db.query('alter table pins_gone rename to pins');
    }
  });

  test('the box query uses the planar index', async () => {
    await t.db.query('set enable_seqscan = off');
    try {
      const { rows } = await t.db.query(
        "explain select pin_id from pins where location::geometry && st_makeenvelope(-119, 34, -118, 35, 4326)",
      );
      assert.match(rows.map((r) => r['QUERY PLAN']).join('\n'), /pins_location_geom/);
    } finally {
      await t.db.query('set enable_seqscan = on');
    }
  });
});

describe('finds store contract', () => {
  test('postgres exports every function the dynamo module does', () => {
    const fns = (m) => Object.keys(m).filter((k) => typeof m[k] === 'function').sort();
    for (const name of fns(dynamoPins)) {
      assert.equal(typeof pgPins[name], 'function', `pg/pins.js is missing ${name}`);
    }
  });
  test('cursors round-trip; anything else is null', () => {
    const c = pgPins.encodeCursor({ createdAt: '2026-01-02T03:04:05.678Z', pinId: '00000000-0000-4000-8000-000000000001' });
    assert.deepEqual(pgPins.decodeCursor(c), { createdAt: '2026-01-02T03:04:05.678Z', pinId: '00000000-0000-4000-8000-000000000001' });
    for (const bad of [null, '', 'garbage', Buffer.from('{"c":"x","id":"y"}').toString('base64'), 42]) {
      assert.equal(pgPins.decodeCursor(bad), null);
    }
  });
});
