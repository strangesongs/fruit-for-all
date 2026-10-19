import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { takeResetToken, forgetResetToken, RESET_PATH } from '../../client/utils/resetToken.js';

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

function fakeHistory() {
  const calls = [];
  return { calls, replaceState: (_s, _t, url) => calls.push(url) };
}

describe('reset token handling', () => {
  test('reads the token and strips it from the URL', () => {
    const history = fakeHistory();
    const storage = memoryStorage();
    const token = takeResetToken({
      location: { pathname: RESET_PATH, search: '?token=abc123', hash: '' },
      history,
      storage,
    });
    assert.equal(token, 'abc123');
    assert.deepEqual(history.calls, ['/reset-password']);
  });

  test('keeps other query params', () => {
    const history = fakeHistory();
    takeResetToken({
      location: { pathname: RESET_PATH, search: '?token=abc&utm=x', hash: '' },
      history,
      storage: memoryStorage(),
    });
    assert.deepEqual(history.calls, ['/reset-password?utm=x']);
  });

  test('a reload (no token in the URL) gets it back from this tab', () => {
    const storage = memoryStorage();
    takeResetToken({ location: { pathname: RESET_PATH, search: '?token=t1' }, history: fakeHistory(), storage });
    const again = takeResetToken({ location: { pathname: RESET_PATH, search: '' }, history: fakeHistory(), storage });
    assert.equal(again, 't1');
  });

  test('forgotten after use', () => {
    const storage = memoryStorage();
    takeResetToken({ location: { pathname: RESET_PATH, search: '?token=t1' }, history: fakeHistory(), storage });
    forgetResetToken(storage);
    assert.equal(takeResetToken({ location: { pathname: RESET_PATH, search: '' }, history: fakeHistory(), storage }), null);
  });

  test('other paths are ignored', () => {
    const history = fakeHistory();
    assert.equal(takeResetToken({ location: { pathname: '/', search: '?token=x' }, history, storage: memoryStorage() }), null);
    assert.equal(history.calls.length, 0);
  });

  test('blocked storage still returns the token from the URL', () => {
    const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    const token = takeResetToken({
      location: { pathname: RESET_PATH, search: '?token=z' },
      history: fakeHistory(),
      storage: throwing,
    });
    assert.equal(token, 'z');
  });
});
