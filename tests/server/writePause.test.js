import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isPausedWrite, writePause, PAUSE_MESSAGE } from '../../server/utils/writePause.js';
import { saveErrorMessage } from '../../client/utils/findPlacement.js';

describe('write pause', () => {
  test('reads and sign-in go through; every other api write is paused', () => {
    for (const [m, p] of [['GET', '/api/pins/public'], ['GET', '/find/x'], ['HEAD', '/api/pins/x'], ['OPTIONS', '/api/pins'], ['POST', '/api/auth/login'], ['POST', '/not-api']]) {
      assert.equal(isPausedWrite(m, p), false, `${m} ${p}`);
    }
    for (const [m, p] of [['POST', '/api/pins'], ['PATCH', '/api/pins/x'], ['DELETE', '/api/pins/x'], ['POST', '/api/pins/x/confirm'], ['POST', '/api/pins/x/report'], ['POST', '/api/auth/register'], ['POST', '/api/auth/forgot-password'], ['POST', '/api/auth/reset-password']]) {
      assert.equal(isPausedWrite(m, p), true, `${m} ${p}`);
    }
  });

  const run = (mw, method, path) => {
    const out = { next: false, status: null, body: null, headers: {} };
    const res = {
      set: (k, v) => ((out.headers[k] = v), res),
      status: (s) => ((out.status = s), res),
      json: (b) => ((out.body = b), res),
    };
    mw({ method, path }, res, () => (out.next = true));
    return out;
  };

  test('paused: 503 with the message and Retry-After; off: everything passes', () => {
    const paused = run(writePause({ paused: true }), 'POST', '/api/pins');
    assert.equal(paused.status, 503);
    assert.equal(paused.body.message, PAUSE_MESSAGE);
    assert.equal(paused.headers['Retry-After'], '300');
    assert.equal(run(writePause({ paused: true }), 'GET', '/api/pins/public').next, true);
    assert.equal(run(writePause({ paused: false }), 'POST', '/api/pins').next, true);
  });

  test('add a find explains the pause in place', () => {
    assert.match(saveErrorMessage(503, PAUSE_MESSAGE), /moving to a new home.*your find is still here/);
    assert.match(saveErrorMessage(503, 'other'), /something went wrong/);
  });
});
