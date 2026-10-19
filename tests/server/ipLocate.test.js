import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createTtlCache } from '../../server/utils/ttlCache.js';
import { createIpLocator, normalizeIp, EMPTY_LOCATION } from '../../server/utils/ipLocate.js';
import { RATE_LIMITS } from '../../server/utils/rateLimits.js';

function fakeClock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms) => { t += ms; } };
}

function fakeFetch(body, { ok = true } = {}) {
  const calls = [];
  const impl = async (url) => {
    calls.push(url);
    if (body instanceof Error) throw body;
    return { ok, json: async () => body };
  };
  return { impl, calls };
}

describe('ttl cache', () => {
  test('expires entries after their ttl', () => {
    const clock = fakeClock();
    const cache = createTtlCache({ ttlMs: 1000, now: clock.now });
    cache.set('a', 1);
    clock.advance(999);
    assert.equal(cache.get('a'), 1);
    clock.advance(2);
    assert.equal(cache.get('a'), undefined);
  });

  test('drops the least recently used entry past the cap', () => {
    const cache = createTtlCache({ max: 2 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a');
    cache.set('c', 3);
    assert.equal(cache.get('b'), undefined);
    assert.equal(cache.get('a'), 1);
    assert.equal(cache.get('c'), 3);
    assert.equal(cache.size, 2);
  });
});

describe('ip locator', () => {
  test('local and empty addresses never call ipapi', async () => {
    const f = fakeFetch({});
    const locate = createIpLocator({ fetchImpl: f.impl });
    for (const ip of ['', '127.0.0.1', '::1', '::ffff:127.0.0.1', undefined]) {
      assert.deepEqual(await locate(ip), EMPTY_LOCATION);
    }
    assert.equal(f.calls.length, 0);
  });

  test('strips the IPv4-mapped prefix', () => {
    assert.equal(normalizeIp('::ffff:203.0.113.9'), '203.0.113.9');
  });

  test('a repeat lookup for the same IP is served from cache', async () => {
    const f = fakeFetch({ latitude: 34.05, longitude: -118.24, city: 'Los Angeles' });
    const locate = createIpLocator({ fetchImpl: f.impl });
    const first = await locate('203.0.113.9');
    const second = await locate('::ffff:203.0.113.9');
    assert.deepEqual(first, { lat: 34.05, lng: -118.24, city: 'Los Angeles' });
    assert.deepEqual(second, first);
    assert.equal(f.calls.length, 1);
  });

  test('failures are cached briefly, then retried', async () => {
    const clock = fakeClock();
    const f = fakeFetch({ error: true, reason: 'RateLimited' });
    const locate = createIpLocator({
      fetchImpl: f.impl,
      cache: createTtlCache({ ttlMs: 24 * 3600 * 1000, now: clock.now }),
      failureTtlMs: 600000,
    });
    assert.deepEqual(await locate('198.51.100.4'), EMPTY_LOCATION);
    assert.deepEqual(await locate('198.51.100.4'), EMPTY_LOCATION);
    assert.equal(f.calls.length, 1);
    clock.advance(600001);
    await locate('198.51.100.4');
    assert.equal(f.calls.length, 2);
  });

  test('a network error returns the empty location instead of throwing', async () => {
    const locate = createIpLocator({ fetchImpl: fakeFetch(new Error('boom')).impl });
    assert.deepEqual(await locate('192.0.2.1'), EMPTY_LOCATION);
  });

  test('/api/locate has its own rate limit', () => {
    assert.ok(RATE_LIMITS.locate.max > 0);
  });
});
