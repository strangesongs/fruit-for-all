// IP → approximate location via ipapi.co, cached per IP.
// ipapi.co's free tier allows about 1,000 lookups a day, so repeat visits
// from the same address shouldn't spend one each. Failed lookups are cached
// briefly too, so an ipapi outage or rate limit isn't hammered.

import { createTtlCache } from './ttlCache.js';

export const EMPTY_LOCATION = Object.freeze({ lat: null, lng: null, city: null });
const HOUR = 60 * 60 * 1000;

export function normalizeIp(raw) {
  let ip = typeof raw === 'string' ? raw.trim() : '';
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (!ip || ip === '127.0.0.1' || ip === '::1') return null;
  return ip;
}

export function createIpLocator({
  fetchImpl = globalThis.fetch,
  cache = createTtlCache({ max: 5000, ttlMs: 24 * HOUR }),
  failureTtlMs = 10 * 60 * 1000,
  timeoutMs = 3000,
} = {}) {
  return async function locate(rawIp) {
    const ip = normalizeIp(rawIp);
    if (!ip) return EMPTY_LOCATION;

    const cached = cache.get(ip);
    if (cached) return cached;

    let result = EMPTY_LOCATION;
    try {
      const response = await fetchImpl(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.ok) {
        const data = await response.json();
        if (!data.error && data.latitude && data.longitude) {
          result = { lat: data.latitude, lng: data.longitude, city: data.city || null };
        }
      }
    } catch {
      // timeout or network error: fall through with the empty result
    }

    cache.set(ip, result, result === EMPTY_LOCATION ? failureTtlMs : undefined);
    return result;
  };
}
