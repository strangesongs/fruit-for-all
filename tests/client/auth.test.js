import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage for Node.js (not available in non-browser environments)
const store = {};
global.localStorage = {
  getItem: (key) => store[key] ?? null,
  setItem: (key, val) => { store[key] = String(val); },
  removeItem: (key) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
};

// Helper: build a minimal JWT with a custom exp claim (no real signature needed
// for client-side expiry checks, which only decode the payload).
function makeJwt(exp) {
  const header  = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ userName: 'testuser', exp })).toString('base64url');
  return `${header}.${payload}.fakesig`;
}

const { saveAuth, getToken, getUser, clearAuth, isAuthenticated, getAuthHeader, isAdmin } =
  await import('../../client/utils/auth.js');

describe('auth utilities', () => {
  beforeEach(() => {
    global.localStorage.clear();
  });

  // ── saveAuth / getToken / getUser ──────────────────────────────────────────

  describe('saveAuth / getToken / getUser', () => {
    test('saveAuth stores token and user', () => {
      const user = { userName: 'alice', email: 'alice@example.com' };
      saveAuth('tok123', user);
      assert.equal(getToken(), 'tok123');
      assert.deepEqual(getUser(), user);
    });

    test('getToken returns null when nothing stored', () => {
      assert.equal(getToken(), null);
    });

    test('getUser returns null when nothing stored', () => {
      assert.equal(getUser(), null);
    });
  });

  // ── clearAuth ──────────────────────────────────────────────────────────────

  describe('clearAuth', () => {
    test('removes token and user', () => {
      saveAuth('tok123', { userName: 'alice' });
      clearAuth();
      assert.equal(getToken(), null);
      assert.equal(getUser(), null);
    });
  });

  // ── isAuthenticated ────────────────────────────────────────────────────────

  describe('isAuthenticated', () => {
    test('returns false when no token is stored', () => {
      assert.equal(isAuthenticated(), false);
    });

    test('returns true for a valid non-expired token', () => {
      const exp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      saveAuth(makeJwt(exp), { userName: 'alice' });
      assert.equal(isAuthenticated(), true);
    });

    test('returns false and clears storage for an expired token', () => {
      const exp = Math.floor(Date.now() / 1000) - 60; // 1 minute ago
      saveAuth(makeJwt(exp), { userName: 'alice' });
      assert.equal(isAuthenticated(), false);
      assert.equal(getToken(), null); // storage cleaned up
    });

    test('returns false and clears storage for a malformed token', () => {
      global.localStorage.setItem('ffa_auth_token', 'not.a.jwt');
      assert.equal(isAuthenticated(), false);
      assert.equal(getToken(), null);
    });
  });

  // ── getAuthHeader ──────────────────────────────────────────────────────────

  describe('getAuthHeader', () => {
    test('returns Authorization header when token exists', () => {
      saveAuth('mytoken', { userName: 'alice' });
      assert.deepEqual(getAuthHeader(), { Authorization: 'Bearer mytoken' });
    });

    test('returns empty object when no token', () => {
      assert.deepEqual(getAuthHeader(), {});
    });
  });

  // ── isAdmin ────────────────────────────────────────────────────────────────

  describe('isAdmin', () => {
    test('returns falsy when not authenticated', () => {
      assert.ok(!isAdmin());
    });

    test('returns false for a non-admin user', () => {
      saveAuth('tok', { userName: 'alice', isAdmin: false });
      assert.equal(isAdmin(), false);
    });

    test('returns true for an admin user', () => {
      saveAuth('tok', { userName: 'alice', isAdmin: true });
      assert.equal(isAdmin(), true);
    });
  });
});
