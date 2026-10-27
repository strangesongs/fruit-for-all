// Who gets into /api/admin/*, and what the handlers answer when they can't work.
// The users table is a stub on the shared DynamoDB client (the default store in
// tests), so nothing leaves the process. The data itself: pgAdmin.test.js.
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dynamoClient } from '../../server/db/dynamo.js';
import { requireAdmin, getAdminOverview, getAdminSummary, hidePin } from '../../server/controllers/adminController.js';

const realSend = dynamoClient.send;
const realError = console.error;
let answer;
let calls;
beforeEach(() => {
  calls = 0;
  answer = () => ({});
  dynamoClient.send = async (cmd) => {
    calls += 1;
    return answer(cmd);
  };
  console.error = () => {};
});
afterEach(() => {
  dynamoClient.send = realSend;
  console.error = realError;
});

function fakeRes() {
  return {
    statusCode: 200, headers: {}, body: undefined, headersSent: false,
    status(c) { this.statusCode = c; return this; },
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    json(b) { this.body = b; this.headersSent = true; return this; },
  };
}
const userItem = (isAdmin) => ({ Item: { userName: { S: 'Admin' }, isAdmin: { BOOL: isAdmin } } });

async function gate(user) {
  const res = fakeRes();
  let passed = false;
  await requireAdmin({ user }, res, () => { passed = true; });
  return { res, passed };
}

describe('requireAdmin', () => {
  test('not an admin in the token: the same 404 as an unknown route, without asking the database', async () => {
    for (const user of [undefined, {}, { userName: 'ana', isAdmin: false }]) {
      const { res, passed } = await gate(user);
      assert.equal(passed, false);
      assert.equal(res.statusCode, 404);
      assert.deepEqual(res.body, { success: false, message: 'Not found' });
    }
    assert.equal(calls, 0);
  });

  test('admin in the token but not in the users table (demoted, or gone): 404', async () => {
    answer = () => userItem(false);
    assert.equal((await gate({ userName: 'Admin', isAdmin: true })).res.statusCode, 404);
    answer = () => ({});
    assert.equal((await gate({ userName: 'Admin', isAdmin: true })).res.statusCode, 404);
  });

  test('an admin in both: through, and the answer is never cached', async () => {
    answer = () => userItem(true);
    const { res, passed } = await gate({ userName: 'Admin', isAdmin: true });
    assert.equal(passed, true);
    assert.equal(res.headers['cache-control'], 'no-store');
  });

  test('the users table is down: 503, not a 404 or a pass', async () => {
    answer = () => { throw new Error('connect ECONNREFUSED 127.0.0.1:9'); };
    const { res, passed } = await gate({ userName: 'Admin', isAdmin: true });
    assert.equal(passed, false);
    assert.equal(res.statusCode, 503);
  });
});

describe('admin handlers on DATA_STORE=dynamo', () => {
  test('answer 503 "needs the Postgres database" (there is no DynamoDB twin)', async () => {
    for (const handler of [getAdminOverview, getAdminSummary]) {
      const res = fakeRes();
      await handler({ user: { userName: 'Admin', isAdmin: true } }, res);
      assert.equal(res.statusCode, 503);
      assert.match(res.body.message, /Postgres/);
    }
    const res = fakeRes();
    await hidePin({ params: { pinId: '3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c' }, user: { userName: 'Admin' } }, res);
    assert.equal(res.statusCode, 503);
  });
});

describe('server.js wiring', () => {
  const source = readFileSync(new URL('../../server.js', import.meta.url), 'utf8');
  test('every /api/admin route goes through adminOnly', () => {
    const routes = [...source.matchAll(/app\.(get|post|patch|delete)\('\/api\/admin[^']*',([^\n]*)/g)];
    assert.ok(routes.length >= 6);
    for (const [line, , rest] of routes) assert.match(rest, /^\s*\.\.\.adminOnly,/, line);
  });
  test('adminOnly: signed out is 404, then the token, then requireAdmin', () => {
    const block = source.slice(source.indexOf('const adminOnly = ['), source.indexOf('];', source.indexOf('const adminOnly = [')));
    assert.match(block, /authorization \? next\(\) : res\.status\(404\)/);
    assert.ok(block.indexOf('controllers.verifyToken') < block.indexOf('controllers.requireAdmin'));
  });
});
