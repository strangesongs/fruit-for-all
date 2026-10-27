#!/usr/bin/env node
// End-to-end check of the API on Postgres: starts the real server with
// DATA_STORE=postgres against DATABASE_URL and walks sign-up → add a find →
// map box → share page → still good → report → edit → command center → delete
// over HTTP.
//
//   DATABASE_URL=… node scripts/smoke-postgres.mjs     (after npm run build + db:migrate)
//
// CI runs it against the throwaway PostGIS service. Before cutover, run it
// against the dev database. It refuses a URL that looks like production
// (FFA_SMOKE_ALLOW_ANY=1 to override), and removes what it created.
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import pg from 'pg';
import { sslFor, withoutSslMode, describeDatabaseUrl } from '../server/db/postgres.js';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(2);
}
if (/prod/i.test(url) && process.env.FFA_SMOKE_ALLOW_ANY !== '1') {
  console.error(`Refusing ${describeDatabaseUrl(url)}: it looks like production.`);
  process.exit(2);
}
const PORT = process.env.SMOKE_PORT || '8123';
const BASE = `http://127.0.0.1:${PORT}`;
const tag = Date.now().toString(36);
const alice = `smoke_a_${tag}`;
const bob = `smoke_b_${tag}`;
const PW = 'Smoke-test-pw1!';
const LA = { lat: 34.0601, lng: -118.2901 };

const db = new pg.Client({ connectionString: withoutSslMode(url), ssl: sslFor(url) });
let server;
let step = 'start';
const createdPins = [];

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // html (the share page)
  }
  return { status: res.status, json, text };
}

const expect = async (label, promise, status) => {
  step = label;
  const r = await promise;
  assert.equal(r.status, status, `${label}: expected ${status}, got ${r.status} ${r.text.slice(0, 200)}`);
  console.log(`  ok  ${label}`);
  return r;
};

async function waitForServer() {
  for (let i = 0; i < 50; i += 1) {
    try {
      if ((await fetch(`${BASE}/health`)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('server did not start');
}

async function cleanUp() {
  // History rows outlive their finds by design, so they're removed by id.
  await db.query('delete from pin_events where pin_id = any($1::uuid[])', [createdPins]).catch(() => {});
  await db.query('delete from pins where submitted_by in ($1, $2)', [alice, bob]).catch(() => {});
  await db.query('delete from users where user_name in ($1, $2)', [alice, bob]).catch(() => {});
}

try {
  await db.connect();
  console.log(`[smoke] ${describeDatabaseUrl(url)}`);
  server = spawn(process.execPath, ['server.js'], {
    env: { ...process.env, DATA_STORE: 'postgres', PORT, NODE_ENV: 'test', JWT_SECRET: process.env.JWT_SECRET || `smoke-${tag}` },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverLog = '';
  server.stdout.on('data', (d) => (serverLog += d));
  server.stderr.on('data', (d) => (serverLog += d));
  await waitForServer();
  assert.match(serverLog, /store=postgres/, 'the [config] line should say store=postgres');

  // Accounts
  const reg = await expect('register', call('POST', '/api/auth/register', { body: { userName: alice, email: `${alice}@example.com`, password: PW } }), 201);
  assert.ok(reg.json.token);
  await expect('same name, other case → 400', call('POST', '/api/auth/register', { body: { userName: alice.toUpperCase(), email: `x${tag}@example.com`, password: PW } }), 400);
  const login = await expect('sign in ignoring case', call('POST', '/api/auth/login', { body: { userName: alice.toUpperCase(), password: PW } }), 200);
  assert.equal(login.json.user.userName, alice);
  const token = login.json.token;
  const me = await expect('me', call('GET', '/api/auth/me', { token }), 200);
  assert.equal(me.json.user.userName, alice);
  const bobToken = (await expect('register a second person', call('POST', '/api/auth/register', { body: { userName: bob, email: `${bob}@example.com`, password: PW } }), 201)).json.token;

  // A find
  const created = await expect('add a find', call('POST', '/api/pins', { token, body: { coordinates: LA, fruitType: "st. john's wort", notes: 'by the gate' } }), 200);
  const pin = created.json.pin;
  assert.equal(pin.fruitType, "st. john's wort", 'kind stored as typed, not escaped');
  assert.deepEqual(pin.coordinates, LA);
  assert.ok(Number.isInteger(pin.zone));
  const id = pin.pinId;
  createdPins.push(id);

  const box = '?minLat=34.05&maxLat=34.07&minLng=-118.3&maxLng=-118.28';
  const pub = await expect('public map box', call('GET', `/api/pins/public${box}`), 200);
  const inBox = pub.json.pins.find((p) => p.pinId === id);
  assert.ok(inBox, 'the find is in its box');
  assert.equal('submittedBy' in inBox, false, 'public pins never carry submittedBy');
  const away = await expect('a box elsewhere', call('GET', '/api/pins/public?minLat=40&maxLat=41&minLng=-75&maxLng=-73'), 200);
  assert.equal(away.json.pins.some((p) => p.pinId === id), false);

  const one = await expect('one find (shared link api)', call('GET', `/api/pins/${id}`), 200);
  assert.equal('submittedBy' in one.json.pin, false);
  await expect('unknown find → 404', call('GET', '/api/pins/00000000-0000-4000-8000-000000000000'), 404);
  await expect('not an id → 404', call('GET', '/api/pins/nope'), 404);
  const page = await expect('share page', call('GET', `/find/${id}`), 200);
  assert.match(page.text, /st\. john(&#039;|')s wort/i);
  assert.equal(page.text.includes(alice), false, 'the share page never names who added it');

  const mine = await expect('my pins', call('GET', '/api/pins/my', { token }), 200);
  assert.equal(mine.json.pins[0].pinId, id);
  assert.equal(mine.json.pins[0].submittedBy, alice);

  // Still good, reports
  const conf = await expect('still good?', call('POST', `/api/pins/${id}/confirm`), 200);
  assert.equal(conf.json.confirmations.length, 1);
  await expect('still good? again → 409', call('POST', `/api/pins/${id}/confirm`), 409);
  await expect('report a problem', call('POST', `/api/pins/${id}/report`, { body: { reason: 'gone', note: 'smoke' } }), 200);
  const reports = await db.query('select reason from pin_reports where pin_id = $1', [id]);
  assert.deepEqual(reports.rows, [{ reason: 'gone' }]);

  // Edit
  const edited = await expect('edit notes + nudge', call('PATCH', `/api/pins/${id}`, { token, body: { notes: 'gate code 12', coordinates: { lat: 34.0604, lng: -118.2901 } } }), 200);
  assert.equal(edited.json.pin.notes, 'gate code 12');
  assert.ok(edited.json.pin.updatedAt);
  await expect('move too far → 400', call('PATCH', `/api/pins/${id}`, { token, body: { coordinates: { lat: 34.07, lng: -118.29 } } }), 400);
  await expect("someone else's edit → 403", call('PATCH', `/api/pins/${id}`, { token: bobToken, body: { notes: 'mine now' } }), 403);
  await expect("someone else's delete → 403", call('DELETE', `/api/pins/${id}`, { token: bobToken }), 403);

  // The command center
  await expect('command center, signed out → 404', call('GET', '/api/admin/summary'), 404);
  await expect('command center, not an admin → 404', call('GET', '/api/admin/overview', { token: bobToken }), 404);
  await db.query('update users set is_admin = true where user_name = $1', [alice]);
  const adminToken = (await expect('sign in as admin', call('POST', '/api/auth/login', { body: { userName: alice, password: PW } }), 200)).json.token;
  const summary = await expect('admin summary', call('GET', '/api/admin/summary', { token: adminToken }), 200);
  assert.ok(summary.json.counts.openReports >= 1);
  const overview = await expect('admin overview', call('GET', '/api/admin/overview', { token: adminToken }), 200);
  assert.equal(overview.json.success, true);
  assert.doesNotMatch(overview.text, /@example\.com/, 'the command center never carries an email');
  const open = overview.json.reports.find((r) => r.pinId === id);
  assert.equal(open?.reason, 'gone');
  const edit = overview.json.activity.find((a) => a.pinId === id && a.kind === 'edited');
  assert.deepEqual(edit?.fields, ['notes', 'spot']);
  await expect('report handled', call('POST', `/api/admin/reports/${open.id}/handle`, { token: adminToken }), 200);
  await expect('report handled again → 404', call('POST', `/api/admin/reports/${open.id}/handle`, { token: adminToken }), 404);
  await expect('hide the find', call('POST', `/api/admin/pins/${id}/hide`, { token: adminToken }), 200);
  await expect('hidden find → 404', call('GET', `/api/pins/${id}`), 404);
  await expect('hidden find share page → 404', call('GET', `/find/${id}`), 404);
  await expect('put it back', call('POST', `/api/admin/pins/${id}/restore`, { token: adminToken }), 200);
  await expect('back on its link', call('GET', `/api/pins/${id}`), 200);
  await expect('still there', call('POST', `/api/admin/pins/${id}/still-there`, { token: adminToken }), 200);
  await expect('hide by a non-admin → 404', call('POST', `/api/admin/pins/${id}/hide`, { token: bobToken }), 404);

  // Reset request
  await expect('forgot password', call('POST', '/api/auth/forgot-password', { body: { email: `${alice}@example.com` } }), 200);
  const resets = await db.query('select count(*)::int as n from password_resets where user_name = $1', [alice]);
  assert.equal(resets.rows[0].n, 1);

  // Delete
  await expect('delete', call('DELETE', `/api/pins/${id}`, { token }), 200);
  await expect('deleted find → 404', call('GET', `/api/pins/${id}`), 404);
  const left = await db.query('select (select count(*) from pin_confirmations where pin_id = $1)::int as c, (select count(*) from pin_reports where pin_id = $1)::int as r', [id]);
  assert.deepEqual(left.rows[0], { c: 0, r: 0 });
  const history = await db.query('select kind from pin_events where pin_id = $1 order by id', [id]);
  assert.deepEqual(history.rows.map((r) => r.kind), ['added', 'edited', 'report-handled', 'hidden', 'restored', 'still-there', 'deleted']);

  console.log('[smoke] all good');
} catch (err) {
  console.error(`[smoke] failed at "${step}": ${err.message}`);
  if (process.env.GITHUB_ACTIONS) console.log(`::error title=smoke (${step})::${String(err.message).replace(/\n/g, '%0A')}`);
  process.exitCode = 1;
} finally {
  await cleanUp();
  await db.end().catch(() => {});
  server?.kill();
}
