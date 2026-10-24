// A link per find (/find/:id, GET /api/pins/:id) and reports (POST /api/pins/:id/report).
// DynamoDB is replaced by a stub on the shared client, so nothing leaves the process.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dynamoClient } from '../../server/db/dynamo.js';
import * as db from '../../server/schemas/schemas.js';
import { getPublicPin, reportPin, makeFindPage, toPublicPin } from '../../server/controllers/pinsController.js';
import { findPageHtml } from '../../server/utils/findPage.js';
import { createMemoryDedupStore } from '../../server/utils/confirmDedup.js';

const ID = '3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c';
const ITEM = {
  pinId: { S: ID },
  createdAt: { S: '2026-10-01T00:00:00.000Z' },
  coordinates: { S: JSON.stringify({ lat: 34.06, lng: -118.29 }) },
  fruitType: { S: 'fig' },
  fruitTypeDisplay: { S: 'Fig' },
  notes: { S: 'over the <b>alley</b> fence' },
  submittedBy: { S: 'ana' },
  status: { S: 'active' },
  zone: { N: '10' },
  reportCount: { N: '2' },
  reports: { L: [] },
};

let calls;
let answer; // (command) => result, or throws
beforeEach(() => {
  calls = [];
  answer = () => ({ Items: [ITEM] });
  dynamoClient.send = async (cmd) => { calls.push(cmd); return answer(cmd); };
});

function fakeRes() {
  const res = {
    statusCode: 200, headers: {}, body: undefined, headersSent: false,
    status(c) { this.statusCode = c; return this; },
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    type(t) { this.headers['content-type'] = t; return this; },
    json(b) { this.body = b; this.headersSent = true; return this; },
    send(b) { this.body = b; this.headersSent = true; return this; },
  };
  return res;
}

const TEMPLATE = fs.readFileSync(new URL('../../client/map-index.html', import.meta.url), 'utf8');

describe('the controllers only call functions the db barrel exports', () => {
  test('every db.* used in server/controllers exists', () => {
    const dir = new URL('../../server/controllers/', import.meta.url);
    for (const f of fs.readdirSync(dir)) {
      const src = fs.readFileSync(new URL(f, dir), 'utf8');
      if (!src.includes("from '../schemas/schemas.js'")) continue;
      for (const [, name] of src.matchAll(/\bdb\.([A-Za-z]+)\(/g)) {
        assert.equal(typeof db[name], 'function', `${f}: db.${name} is not exported by server/schemas/schemas.js`);
      }
    }
  });
});

describe('toPublicPin', () => {
  test('drops who added it and any reports', () => {
    const p = toPublicPin({ pinId: ID, submittedBy: 'ana', reports: [1], reportCount: 1, notes: 'x' });
    assert.deepEqual(p, { pinId: ID, notes: 'x' });
  });
});

describe('GET /api/pins/:pinId', () => {
  test('returns the find without submittedBy or reports', async () => {
    const res = fakeRes();
    await getPublicPin({ params: { pinId: ID } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.pin.pinId, ID);
    assert.equal(res.body.pin.submittedBy, undefined);
    assert.equal(res.body.pin.reportCount, undefined);
    assert.equal(res.body.pin.reports, undefined);
  });
  test('404 for a missing find or a malformed id (no database call)', async () => {
    answer = () => ({ Items: [] });
    let res = fakeRes();
    await getPublicPin({ params: { pinId: ID } }, res);
    assert.equal(res.statusCode, 404);
    calls = [];
    res = fakeRes();
    await getPublicPin({ params: { pinId: 'my' } }, res);
    assert.equal(res.statusCode, 404);
    assert.equal(calls.length, 0);
  });
  test('a database failure is 503, not "no such find"', async () => {
    answer = () => { throw new Error('dynamo down'); };
    const res = fakeRes();
    const err = console.error; console.error = () => {};
    try { await getPublicPin({ params: { pinId: ID } }, res); } finally { console.error = err; }
    assert.equal(res.statusCode, 503);
  });
});

describe('GET /find/:pinId', () => {
  const page = makeFindPage(() => TEMPLATE);
  test('the template carries default share tags', () => {
    assert.match(TEMPLATE, /<!-- share:start[\s\S]*og:title[\s\S]*<!-- share:end -->/);
  });
  test("serves the app with the find's title and preview tags", async () => {
    const res = fakeRes();
    await page({ params: { pinId: ID } }, res);
    assert.equal(res.statusCode, 200);
    assert.match(res.body, /<title>fig · fruit for all<\/title>/);
    assert.match(res.body, /<meta property="og:title" content="fig · fruit for all" \/>/);
    assert.match(res.body, new RegExp(`og:url" content="[^"]*/find/${ID}"`));
    assert.match(res.body, /og:description" content="fig, [^"]*&lt;b&gt;alley&lt;\/b&gt;/); // escaped
    assert.ok(!res.body.includes('ana'));
    assert.match(res.body, /<div id="root"><\/div>/); // still the app
    assert.equal((res.body.match(/og:title/g) || []).length, 1);
  });
  test('a find that is gone: the plain app with a 404', async () => {
    answer = () => ({ Items: [] });
    const res = fakeRes();
    await page({ params: { pinId: ID } }, res);
    assert.equal(res.statusCode, 404);
    assert.equal(res.body, TEMPLATE);
  });
  test('the database is down: the plain app (200), which then asks for the find itself', async () => {
    answer = () => { throw new Error('dynamo down'); };
    const res = fakeRes();
    const err = console.error; console.error = () => {};
    try { await page({ params: { pinId: ID } }, res); } finally { console.error = err; }
    assert.equal(res.statusCode, 200);
    assert.equal(res.body, TEMPLATE);
  });
  test('findPageHtml leaves an old template without the block alone', () => {
    assert.equal(findPageHtml('<title>x</title>', { pinId: ID, fruitType: 'fig' }), '<title>x</title>');
  });
});

describe('POST /api/pins/:pinId/report', () => {
  const req = (body, store, ip = '1.2.3.4') => ({ params: { pinId: ID }, body, ip, redisClient: store });

  test('stores the report on the pin and answers ok', async () => {
    const store = createMemoryDedupStore();
    const res = fakeRes();
    await reportPin(req({ reason: 'gone', note: 'cut down' }, store), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { success: true });
    const update = calls.find((c) => c.constructor.name === 'UpdateItemCommand');
    assert.ok(update, 'an UpdateItem was sent');
    const v = update.input.ExpressionAttributeValues;
    assert.equal(v[':new'].L[0].M.reason.S, 'gone');
    assert.equal(v[':new'].L[0].M.note.S, 'cut down');
    assert.match(update.input.UpdateExpression, /ADD reportCount :one/);
    assert.match(update.input.ConditionExpression, /size\(reports\) < :max/);
  });
  test('one per find per IP per day', async () => {
    const store = createMemoryDedupStore();
    await reportPin(req({ reason: 'gone' }, store), fakeRes());
    const res = fakeRes();
    await reportPin(req({ reason: 'unsafe' }, store), res);
    assert.equal(res.statusCode, 409);
    const other = fakeRes();
    await reportPin(req({ reason: 'unsafe' }, store, '5.6.7.8'), other);
    assert.equal(other.statusCode, 200);
  });
  test('a bad body is a 400 before any database call', async () => {
    const res = fakeRes();
    await reportPin(req({ reason: 'other' }, createMemoryDedupStore()), res);
    assert.equal(res.statusCode, 400);
    assert.equal(calls.length, 0);
  });
  test('a full list still answers ok (the email still goes)', async () => {
    answer = (cmd) => {
      if (cmd.constructor.name === 'UpdateItemCommand') {
        const e = new Error('full'); e.name = 'ConditionalCheckFailedException'; throw e;
      }
      return { Items: [ITEM] };
    };
    const res = fakeRes();
    await reportPin(req({ reason: 'gone' }, createMemoryDedupStore()), res);
    assert.equal(res.statusCode, 200);
  });
  test('no such find: 404; database down: 503', async () => {
    answer = () => ({ Items: [] });
    let res = fakeRes();
    await reportPin(req({ reason: 'gone' }, createMemoryDedupStore()), res);
    assert.equal(res.statusCode, 404);
    answer = () => { throw new Error('dynamo down'); };
    res = fakeRes();
    const err = console.error; console.error = () => {};
    try { await reportPin(req({ reason: 'gone' }, createMemoryDedupStore()), res); } finally { console.error = err; }
    assert.equal(res.statusCode, 503);
  });
});
