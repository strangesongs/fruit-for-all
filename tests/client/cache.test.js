import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// localStorage stand-in whose stored keys show up in Object.keys(), like the real one.
function makeStorage({ quota = Infinity } = {}) {
  const s = {};
  const hidden = (v) => ({ value: v, enumerable: false });
  Object.defineProperties(s, {
    getItem: hidden((k) => (Object.prototype.hasOwnProperty.call(s, k) ? s[k] : null)),
    setItem: hidden((k, v) => {
      const used = Object.keys(s).filter((key) => key !== k).reduce((n, key) => n + s[key].length, 0);
      if (used + String(v).length > quota) {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      }
      s[k] = String(v);
    }),
    removeItem: hidden((k) => { delete s[k]; }),
    clear: hidden(() => { Object.keys(s).forEach((k) => delete s[k]); }),
  });
  return s;
}

global.localStorage = makeStorage();
const { setCache, getCache, pruneCaches } = await import('../../client/utils/cache.js');
const cacheKeys = () => Object.keys(global.localStorage).filter((k) => k.startsWith('ffa_cache_'));

describe('pin cache eviction', () => {
  beforeEach(() => { global.localStorage = makeStorage(); });

  test('keeps at most 30 entries, dropping the oldest', () => {
    for (let i = 0; i < 45; i++) setCache(`pins_${i}`, [i]);
    assert.equal(cacheKeys().length, 30);
    assert.deepEqual(getCache('pins_44'), [44]);
  });

  test('expired entries are removed on prune', () => {
    setCache('pins_old', [1], -1);
    setCache('pins_new', [2]);
    pruneCaches();
    assert.equal(getCache('pins_old'), null);
    assert.equal(cacheKeys().includes('ffa_cache_pins_old'), false);
    assert.deepEqual(getCache('pins_new'), [2]);
  });

  test('leaves other localStorage keys alone', () => {
    global.localStorage.setItem('ffa_auth_token', 'abc');
    for (let i = 0; i < 40; i++) setCache(`pins_${i}`, [i]);
    assert.equal(global.localStorage.getItem('ffa_auth_token'), 'abc');
  });

  test('a full quota clears old cache entries and still saves the new one', () => {
    global.localStorage = makeStorage({ quota: 400 });
    setCache('pins_a', 'x'.repeat(150));
    setCache('pins_b', 'y'.repeat(150));
    setCache('pins_c', 'z'.repeat(150));
    assert.equal(getCache('pins_c').length, 150);
  });
});
