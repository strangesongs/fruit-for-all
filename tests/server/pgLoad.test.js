// The DynamoDB → Postgres load against a real PostGIS (skipped without
// TEST_DATABASE_URL): everything lands in one transaction, matches field by
// field, and reads back through the app's own Postgres code.
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { userRow, pinRow } from '../../server/db/dynamoImport.js';
import { loadRows, readRows, compareStores } from '../../server/db/pgLoad.js';
import * as pgPins from '../../server/schemas/pg/pins.js';
import * as pgUsers from '../../server/schemas/pg/users.js';
import { openTestSchema, skipReason } from './pgTestDb.js';

const ID1 = '3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90';
const ID2 = '9b1d2c3e-4f5a-4b6c-8d7e-0f1a2b3c4d5e';
const rawUser = (name, over = {}) => ({
  userName: { S: name },
  email: { S: `${name.toLowerCase()}@example.com` },
  passwordHash: { S: '$2b$12$abcdefghijklmnopqrstuuAbCdEfGhIjKlMnOpQrStUvWxYz01234' },
  createdAt: { S: '2025-01-02T03:04:05.000Z' },
  lastLogin: { S: '2026-10-01T00:00:00.000Z' },
  isAdmin: { BOOL: false },
  ...over,
});
const rawPin = (id, over = {}) => ({
  pinId: { S: id },
  createdAt: { S: '2026-05-01T12:00:00.000Z' },
  coordinates: { S: JSON.stringify({ lat: 34.06, lng: -118.29 }) },
  fruitType: { S: 'st. john&#039;s wort' },
  fruitTypeDisplay: { S: 'st. john&#039;s wort' },
  notes: { S: 'by the gate' },
  submittedBy: { S: 'Alice' },
  status: { S: 'active' },
  zone: { N: '10' },
  confirmations: { L: [{ M: { timestamp: { S: '2026-07-02T00:00:00Z' } } }, { M: { timestamp: { S: '2026-07-01T00:00:00Z' } } }] },
  reports: { L: [{ M: { reason: { S: 'gone' }, note: { S: 'stump' }, at: { S: '2026-08-01T00:00:00Z' } } }] },
  ...over,
});
const fixture = () => ({
  users: [rawUser('Alice', { isAdmin: { BOOL: true } }), rawUser('bob'), rawUser('testuser', { email: undefined, passwordHash: undefined })].map(userRow),
  pins: [rawPin(ID1), rawPin(ID2, { zone: undefined, submittedBy: { S: 'bob' }, confirmations: undefined, reports: undefined, updatedAt: { S: '2026-06-01T00:00:00Z' } })].map(pinRow),
});

describe('loading DynamoDB rows into postgres', { skip: skipReason }, () => {
  let t;
  const zoneFor = async () => 9;
  before(async () => {
    t = await openTestSchema('load');
  });
  after(async () => {
    await t?.close();
  });
  beforeEach(async () => {
    await t.reset();
  });

  test('everything lands and matches; testuser is left out; missing zones are detected', async () => {
    const src = fixture();
    const counts = await loadRows(t.db, src, { zoneFor });
    assert.deepEqual(counts, { users: 2, finds: 2, confirmations: 2, reports: 1, zonesDetected: 1 });
    assert.deepEqual(compareStores(src, await readRows(t.db)), []);
    const { rows } = await t.db.query("select user_name from users where user_name = 'testuser'");
    assert.equal(rows.length, 0);
  });

  test('the app reads what was loaded: kind unescaped, admin kept, sign-in ignores case', async () => {
    await loadRows(t.db, fixture(), { zoneFor });
    const pin = await pgPins.getPinById(ID1, { withReports: true });
    assert.equal(pin.fruitType, "st. john's wort");
    assert.equal(pin.reportCount, 1);
    assert.deepEqual(pin.confirmations.map((c) => c.timestamp), ['2026-07-01T00:00:00.000Z', '2026-07-02T00:00:00.000Z']);
    assert.equal((await pgPins.getPinById(ID2)).zone, 9);
    assert.equal((await pgUsers.getUser('alice')).isAdmin, true);
    const { pins } = await pgPins.getAllPins({ bounds: { minLat: 34, maxLat: 34.1, minLng: -118.3, maxLng: -118.2 } });
    assert.equal(pins.length, 2);
  });

  test('a database with data is refused unless replace; replace loads again cleanly', async () => {
    await loadRows(t.db, fixture(), { zoneFor });
    await assert.rejects(loadRows(t.db, fixture(), { zoneFor }), /already has 2 users and 2 finds/);
    await loadRows(t.db, fixture(), { zoneFor, replace: true });
    assert.deepEqual(compareStores(fixture(), await readRows(t.db)), []);
  });

  test('a bad row rolls the whole load back', async () => {
    const src = fixture();
    src.pins.push(pinRow(rawPin('5d0f1e2a-3b4c-4d5e-8f60-718293a4b5c6', { submittedBy: { S: 'nobody' } })));
    await assert.rejects(loadRows(t.db, src, { zoneFor }), /foreign key/);
    const { rows } = await t.db.query('select (select count(*) from users)::int u, (select count(*) from pins)::int p');
    assert.deepEqual(rows[0], { u: 0, p: 0 });
  });

  test('compareStores notices a changed field', async () => {
    const src = fixture();
    await loadRows(t.db, src, { zoneFor });
    await t.db.query("update pins set notes = 'changed' where pin_id = $1", [ID1]);
    const diffs = compareStores(src, await readRows(t.db));
    assert.equal(diffs.length, 1);
    assert.match(diffs[0], /notes differs/);
  });
});
