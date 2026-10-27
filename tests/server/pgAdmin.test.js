// The command center's data (server/schemas/pg/admin.js), against a real Postgres.
// Skipped without TEST_DATABASE_URL (see pgTestDb.js).
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as admin from '../../server/schemas/pg/admin.js';
import * as pgPins from '../../server/schemas/pg/pins.js';
import { PinsQueryError } from '../../server/schemas/errors.js';
import { openTestSchema, skipReason } from './pgTestDb.js';

const quiet = async (fn) => {
  const realError = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = realError;
  }
};

describe('command center on postgres', { skip: skipReason }, () => {
  let t;
  const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const NOW = new Date('2026-10-26T12:00:00.000Z');
  const addUser = (name) =>
    t.db.query('insert into users (user_name, email) values ($1, $2)', [name, `${name.toLowerCase()}@example.com`]);
  const addPin = ({ id, at, by = 'alice', kind = 'fig', status = 'active' }) =>
    t.db.query(
      `insert into pins (pin_id, created_at, location, fruit_type, fruit_type_display, submitted_by, status, zone)
       values ($1, $2, st_setsrid(st_makepoint(-118.29, 34.06), 4326)::geography, $3, $3, $4, $5, 10)`,
      [id, at, kind, by, status],
    );
  const report = async (pinId, reason = 'gone', at = '2026-10-20T00:00:00.000Z') => {
    const { rows } = await t.db.query(
      'insert into pin_reports (pin_id, reason, note, created_at) values ($1, $2, $3, $4) returning id',
      [pinId, reason, `note for ${reason}`, at],
    );
    return Number(rows[0].id);
  };
  const events = async () =>
    (await t.db.query('select pin_id, kind, by_user, fruit_type from pin_events order by id')).rows;

  before(async () => {
    t = await openTestSchema('admin');
    pgPins.setZoneDetectorForTests(async () => 10);
  });
  after(async () => {
    pgPins.setZoneDetectorForTests(null);
    await t?.close();
  });
  beforeEach(async () => {
    await t.reset();
    await addUser('alice');
    await addUser('Admin');
  });

  test('summary counts open reports, visible finds, hidden finds and people', async () => {
    await addPin({ id: uuid(1), at: '2026-10-01T00:00:00.000Z' });
    await addPin({ id: uuid(2), at: '2026-10-02T00:00:00.000Z', status: 'removed' });
    await report(uuid(1));
    const done = await report(uuid(1), 'unsafe');
    await t.db.query("update pin_reports set handled_at = now(), outcome = 'kept' where id = $1", [done]);
    assert.deepEqual(await admin.getSummary(), { openReports: 1, finds: 1, hidden: 1, people: 2 });
  });

  test('overview: open reports newest first, with the find, who added it and its report count; never an email', async () => {
    await addPin({ id: uuid(1), at: '2026-08-02T00:00:00.000Z', kind: 'fig' });
    await addPin({ id: uuid(2), at: '2026-09-18T00:00:00.000Z', kind: 'meyer lemon' });
    await report(uuid(1), 'gone', '2026-10-20T00:00:00.000Z');
    await report(uuid(1), 'gone', '2026-10-25T00:00:00.000Z');
    await report(uuid(2), 'private', '2026-10-23T00:00:00.000Z');
    const o = await admin.getOverview({ now: NOW });
    assert.deepEqual(
      o.reports.map((r) => [r.fruitType, r.reason, r.reportsOnFind, r.addedBy]),
      [['fig', 'gone', 2, 'alice'], ['meyer lemon', 'private', 1, 'alice'], ['fig', 'gone', 2, 'alice']],
    );
    assert.equal(o.reports[0].note, 'note for gone');
    assert.equal(o.counts.openReports, 3);
    assert.doesNotMatch(JSON.stringify(o), /@example\.com/);
  });

  test('handleReport closes one report (kept); the find stays; twice or unknown → false', async () => {
    await addPin({ id: uuid(1), at: '2026-10-01T00:00:00.000Z' });
    const id = await report(uuid(1));
    assert.equal(await admin.handleReport(id, { by: 'admin' }), true);
    assert.equal(await admin.handleReport(id, { by: 'admin' }), false);
    assert.equal(await admin.handleReport(9999, { by: 'admin' }), false);
    assert.equal(await admin.handleReport('nope', { by: 'admin' }), false);
    const { rows } = await t.db.query('select outcome, handled_by from pin_reports');
    assert.deepEqual(rows, [{ outcome: 'kept', handled_by: 'Admin' }]);
    const o = await admin.getOverview({ now: NOW });
    assert.equal(o.reports.length, 0);
    assert.equal(o.handled.count, 1);
    assert.equal(o.handled.recent[0].outcome, 'kept');
    assert.ok(await pgPins.getPinById(uuid(1)));
    assert.deepEqual(await events(), [{ pin_id: uuid(1), kind: 'report-handled', by_user: 'Admin', fruit_type: 'fig' }]);
  });

  test('hidePin: off the map and its link, open reports handled as hidden; restorePin puts it back', async () => {
    await addPin({ id: uuid(1), at: '2026-10-01T00:00:00.000Z' });
    await report(uuid(1), 'unsafe');
    assert.equal(await admin.hidePin(uuid(1), { by: 'Admin' }), true);
    assert.equal(await admin.hidePin(uuid(1), { by: 'Admin' }), false);
    assert.equal(await pgPins.getPinById(uuid(1)), null);
    assert.deepEqual((await pgPins.getAllPins({})).pins, []);
    let o = await admin.getOverview({ now: NOW });
    assert.equal(o.reports.length, 0);
    assert.deepEqual(o.hidden.map((h) => [h.pinId, h.reason]), [[uuid(1), 'unsafe']]);
    assert.ok(o.hidden[0].hiddenAt);
    assert.equal(o.handled.recent[0].outcome, 'hidden');

    assert.equal(await admin.restorePin(uuid(1), { by: 'Admin' }), true);
    assert.equal(await admin.restorePin(uuid(1), { by: 'Admin' }), false);
    assert.ok(await pgPins.getPinById(uuid(1)));
    o = await admin.getOverview({ now: NOW });
    assert.deepEqual(o.hidden, []);
    assert.deepEqual((await events()).map((e) => e.kind), ['hidden', 'restored']);
    assert.equal(await admin.hidePin('not-a-uuid'), false);
    assert.equal(await admin.restorePin(uuid(99)), false);
  });

  test('finds to review: no add or "still good" in six months, oldest first; still there clears it', async () => {
    await addPin({ id: uuid(1), at: '2026-03-01T00:00:00.000Z', kind: 'guava' });
    await addPin({ id: uuid(2), at: '2026-02-01T00:00:00.000Z', kind: 'prickly pear' });
    await addPin({ id: uuid(3), at: '2026-01-01T00:00:00.000Z', kind: 'loquat' });
    await addPin({ id: uuid(4), at: '2026-09-01T00:00:00.000Z', kind: 'fig' });
    await addPin({ id: uuid(5), at: '2026-01-01T00:00:00.000Z', kind: 'olive', status: 'removed' });
    // The loquat had a "still good" in September: not stale.
    await t.db.query("insert into pin_confirmations (pin_id, confirmed_at) values ($1, '2026-09-10T00:00:00Z')", [uuid(3)]);
    let o = await admin.getOverview({ now: NOW });
    assert.deepEqual(o.stale.map((s) => s.fruitType), ['prickly pear', 'guava']);
    assert.equal(o.stale[0].lastSign, '2026-02-01T00:00:00.000Z');

    assert.equal(await admin.markStillThere(uuid(2), { by: 'admin' }), true);
    assert.equal(await admin.markStillThere(uuid(5), { by: 'admin' }), false); // hidden
    o = await admin.getOverview({ now: NOW });
    assert.deepEqual(o.stale.map((s) => s.fruitType), ['guava']);
    // One activity line for it, from the admin, not a second anonymous "still good".
    const lines = o.activity.filter((a) => a.pinId === uuid(2));
    assert.deepEqual(lines.map((a) => [a.kind, a.by]), [['still-there', 'Admin'], ['added', 'alice']]);
  });

  test('recent activity: history, older adds, and visitors\' "still good", newest first', async () => {
    const pin = await pgPins.createPin({ coordinates: { lat: 34.06, lng: -118.29 }, fruitType: 'loquat', submittedBy: 'alice' });
    await addPin({ id: uuid(1), at: '2026-01-01T00:00:00.000Z', kind: 'fig' }); // from before history began
    const tick = () => new Promise((r) => setTimeout(r, 5)); // distinct times, so the order is certain
    await tick();
    await pgPins.confirmPin(pin.pinId);
    await tick();
    await pgPins.updatePin(pin.pinId, { notes: 'by the gate' }, { by: 'alice' });
    await tick();
    await pgPins.deletePin(uuid(1), { by: 'alice' });
    const o = await admin.getOverview({ now: new Date() });
    assert.deepEqual(
      o.activity.map((a) => [a.kind, a.fruitType, a.by, a.onMap]),
      [
        ['deleted', 'fig', 'alice', false],
        ['edited', 'loquat', 'alice', true],
        ['still-good', 'loquat', null, true],
        ['added', 'loquat', 'alice', true],
      ],
    );
    assert.deepEqual(o.activity[1].fields, ['notes']);
  });

  test('a database failure is PinsQueryError', async () => {
    await t.db.query('alter table pin_reports rename to pin_reports_gone');
    try {
      await quiet(async () => {
        await assert.rejects(admin.getSummary(), PinsQueryError);
        await assert.rejects(admin.getOverview(), PinsQueryError);
      });
    } finally {
      await t.db.query('alter table pin_reports_gone rename to pin_reports');
    }
  });
});
