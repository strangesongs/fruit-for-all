import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  fromItem,
  unescapeHtml,
  userRow,
  pinRow,
  checkData,
  formatReport,
  REPORT_REASON_IDS,
} from '../../server/db/dynamoImport.js';
import { escapeHtml } from '../../server/utils/html.js';
import { REPORT_REASONS } from '../../client/utils/findLinks.js';

const FRUITS = new Set(['fig', 'loquat', "st. john's wort"]);
const ID1 = '3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90';
const ID2 = '9b1d2c3e-4f5a-4b6c-8d7e-0f1a2b3c4d5e';

const rawUser = (over = {}) => ({
  userName: { S: 'alice' },
  email: { S: ' Alice@Example.com ' },
  passwordHash: { S: '$2b$12$hash' },
  createdAt: { S: '2025-01-02T03:04:05.000Z' },
  lastLogin: { S: '2026-10-01T00:00:00.000Z' },
  isAdmin: { BOOL: false },
  ...over,
});

const rawPin = (over = {}) => ({
  pinId: { S: ID1 },
  createdAt: { S: '2026-05-01T12:00:00.000Z' },
  coordinates: { S: JSON.stringify({ lat: 34.06, lng: -118.29 }) },
  fruitType: { S: 'loquat' },
  fruitTypeDisplay: { S: 'Loquat' },
  notes: { S: 'by the bus stop' },
  submittedBy: { S: 'alice' },
  geoHash: { S: '340600_-1182900' },
  status: { S: 'active' },
  zone: { N: '10' },
  ...over,
});

describe('fromItem', () => {
  test('converts every attribute type the tables use', () => {
    assert.deepEqual(
      fromItem({
        s: { S: 'x' },
        n: { N: '10' },
        b: { BOOL: true },
        z: { NULL: true },
        l: { L: [{ M: { timestamp: { S: 't' }, anonymous: { BOOL: true } } }] },
        ss: { SS: ['a'] },
      }),
      { s: 'x', n: 10, b: true, z: null, l: [{ timestamp: 't', anonymous: true }], ss: ['a'] },
    );
  });
});

describe('unescapeHtml', () => {
  test('undoes escapeHtml exactly', () => {
    for (const s of ["st. john's wort", "lamb's quarters", 'a & b', '<x> "y"', '&amp; already']) {
      assert.equal(unescapeHtml(escapeHtml(s)), s);
    }
  });
  test('accepts both &#039; and &#39;', () => {
    assert.equal(unescapeHtml('lamb&#39;s quarters'), "lamb's quarters");
  });
});

describe('userRow', () => {
  test('trims the name, lowercases the email, keeps the hash', () => {
    const u = userRow(rawUser({ userName: { S: ' Alice ' } }));
    assert.equal(u.user_name, 'Alice');
    assert.equal(u.email, 'alice@example.com');
    assert.equal(u.password_hash, '$2b$12$hash');
    assert.equal(u.is_admin, false);
    assert.equal(u.created_at, '2025-01-02T03:04:05.000Z');
  });
  test('counts savedPins and notes a reset token without keeping it', () => {
    const u = userRow(rawUser({ savedPins: { S: '["a","b"]' }, resetToken: { S: 'secret' } }));
    assert.equal(u._savedPins, 2);
    assert.equal(u._hasResetToken, true);
    assert.equal(JSON.stringify(u).includes('secret'), false);
  });
});

describe('pinRow', () => {
  test('maps the item to a row', () => {
    const p = pinRow(rawPin({ confirmations: { L: [{ M: { timestamp: { S: '2026-06-01T00:00:00Z' } } }] } }));
    assert.equal(p.pin_id, ID1);
    assert.equal(p.lat, 34.06);
    assert.equal(p.lng, -118.29);
    assert.equal(p.fruit_type, 'loquat');
    assert.equal(p.fruit_type_display, 'Loquat');
    assert.equal(p.zone, 10);
    assert.equal(p.updated_at, null);
    assert.deepEqual(p.confirmations, ['2026-06-01T00:00:00.000Z']);
    assert.deepEqual(p.reports, []);
    assert.equal('geoHash' in p || 'geo_hash' in p, false);
  });
  test('unescapes kind names and flags them', () => {
    const p = pinRow(rawPin({ fruitType: { S: 'st. john&#039;s wort' }, fruitTypeDisplay: { S: 'St. John&#039;s wort' } }));
    assert.equal(p.fruit_type, "st. john's wort");
    assert.equal(p.fruit_type_display, "St. John's wort");
    assert.equal(p._escapedKind, true);
  });
  test('carries reports', () => {
    const p = pinRow(rawPin({ reports: { L: [{ M: { reason: { S: 'gone' }, note: { S: '' }, at: { S: '2026-10-24T00:00:00Z' } } }] } }));
    assert.deepEqual(p.reports, [{ reason: 'gone', note: '', at: '2026-10-24T00:00:00.000Z' }]);
  });
});

describe('checkData', () => {
  const run = (users, pins) => checkData({ users: users.map(userRow), pins: pins.map(pinRow) }, { fruitSet: FRUITS });

  test('clean data is ok', () => {
    const r = run([rawUser()], [rawPin()]);
    assert.equal(r.ok, true, JSON.stringify(r.problems));
    assert.deepEqual(r.counts, { users: 1, finds: 1, activeFinds: 1, confirmations: 0, reports: 0, outstandingResetTokens: 0 });
  });

  test('usernames that differ only by case block a load', () => {
    const r = run([rawUser(), rawUser({ userName: { S: 'Alice' }, email: { S: 'other@example.com' } })], []);
    assert.equal(r.ok, false);
    assert.deepEqual(r.problems['usernames that clash ignoring case'], ['alice / Alice']);
  });

  test('a shared email blocks a load and names the accounts, not the email', () => {
    const r = run([rawUser(), rawUser({ userName: { S: 'bob' }, email: { S: 'ALICE@example.com' } })], []);
    assert.deepEqual(r.problems['emails shared by more than one account'], ['alice / bob']);
    assert.equal(formatReport(r).join('\n').includes('example.com'), false);
  });

  test('a find without an account, bad coordinates and an unknown reason block a load', () => {
    const r = run(
      [rawUser()],
      [
        rawPin({ submittedBy: { S: 'ghost' } }),
        rawPin({ pinId: { S: ID2 }, coordinates: { S: '{"lat":95,"lng":0}' }, reports: { L: [{ M: { reason: { S: 'spam' }, at: { S: '2026-10-24T00:00:00Z' } } }] } }),
      ],
    );
    assert.deepEqual(r.problems['finds whose submittedBy has no account'], [`${ID1} (ghost)`]);
    assert.deepEqual(r.problems['finds with missing or out-of-range coordinates'], [ID2]);
    assert.deepEqual(r.problems['reports with an unknown reason'], [`${ID2} (spam)`]);
  });

  test('duplicate and non-UUID ids block a load', () => {
    const r = run([rawUser()], [rawPin(), rawPin(), rawPin({ pinId: { S: 'not-a-uuid' } })]);
    assert.deepEqual(r.problems['finds with a duplicate id'], [ID1]);
    assert.deepEqual(r.problems['finds with an id that is not a UUID'], ['not-a-uuid']);
  });

  test('escaped kinds, missing zones, unknown kinds and savedPins are notes, not problems', () => {
    const r = run(
      [rawUser({ savedPins: { S: '["x"]' } })],
      [rawPin({ fruitType: { S: 'st. john&#039;s wort' }, zone: undefined }), rawPin({ pinId: { S: ID2 }, fruitType: { S: 'durian' } })],
    );
    assert.equal(r.ok, true, JSON.stringify(r.problems));
    assert.equal(r.notes['kind names stored HTML-escaped (unescaped on load)'].length, 1);
    assert.deepEqual(r.notes['finds with no zone (re-detected on load)'], [ID1]);
    assert.deepEqual(r.notes['kinds no longer in FRUIT_LIST (kept as they are)'], [`durian (${ID2})`]);
    assert.deepEqual(r.notes['users with savedPins (dropped)'], ['alice (1)']);
  });

  test('skipped accounts are left out, but not if they own finds', () => {
    const legacy = rawUser({ userName: { S: 'testuser' }, email: undefined, passwordHash: undefined });
    const clean = run([rawUser(), legacy], [rawPin()]);
    assert.equal(clean.ok, true, JSON.stringify(clean.problems));
    assert.equal(clean.counts.users, 1);
    assert.deepEqual(clean.notes['accounts left out of the move (SKIPPED_USERS)'], ['testuser']);
    const owned = run([rawUser(), legacy], [rawPin({ submittedBy: { S: 'testuser' } })]);
    assert.deepEqual(owned.problems['finds owned by a skipped account'], [`${ID1} (testuser)`]);
  });

  test('formatReport cuts long lists', () => {
    const users = Array.from({ length: 30 }, (_, i) => rawUser({ userName: { S: `u${i}` }, email: { S: `u${i}@x.org` }, passwordHash: undefined }));
    const lines = formatReport(run(users, []), { limit: 5 });
    assert.ok(lines.some((l) => l.includes('… and 25 more')));
  });
});

test('report reasons match REPORT_REASONS (and the pin_reports check in 001_init.sql)', async () => {
  assert.deepEqual(REPORT_REASON_IDS, REPORT_REASONS.map((r) => r.id));
  const { readFile } = await import('node:fs/promises');
  const sql = await readFile(new URL('../../server/db/migrations/001_init.sql', import.meta.url), 'utf8');
  const m = sql.match(/reason in \(([^)]*)\)/);
  assert.ok(m, 'pin_reports_reason check not found');
  assert.deepEqual(m[1].split(',').map((s) => s.trim().replace(/'/g, '')), REPORT_REASON_IDS);
});
