import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RATE_LIMITS } from '../../server/utils/rateLimits.js';

const serverSource = readFileSync(new URL('../../server.js', import.meta.url), 'utf8');

describe('auth rate limits are split by action', () => {
  test('login, register and reset each have their own limit', () => {
    for (const name of ['login', 'register', 'reset']) {
      const cfg = RATE_LIMITS[name];
      assert.ok(cfg, name);
      assert.ok(cfg.windowMs > 0 && cfg.max > 0, name);
      assert.equal(typeof cfg.message, 'string', name);
    }
  });

  test('successful logins do not count against the login limit', () => {
    assert.equal(RATE_LIMITS.login.skipSuccessfulRequests, true);
  });

  test('each auth route uses its own limiter', () => {
    const routes = {
      '/api/auth/login': 'loginLimiter',
      '/api/auth/register': 'registerLimiter',
      '/api/auth/forgot-password': 'resetLimiter',
      '/api/auth/reset-password': 'resetLimiter',
    };
    for (const [route, limiter] of Object.entries(routes)) {
      const line = serverSource.split('\n').find((l) => l.includes(`'${route}'`));
      assert.ok(line, route);
      assert.ok(line.includes(limiter), `${route} should use ${limiter}`);
    }
    assert.ok(!/\bauthLimiter\b/.test(serverSource), 'the shared authLimiter is gone');
  });

  test('limit responses are JSON so the client can show the message', () => {
    assert.match(serverSource, /message: \{ success: false, message: RATE_LIMITS\[name\]\.message \}/);
  });
});
