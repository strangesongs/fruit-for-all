// A small in-process cache with per-entry expiry and a size cap.
// Oldest entries are dropped first (Map keeps insertion order; a hit moves
// the entry to the end). Per-process, like the in-memory rate limiter.

export function createTtlCache({ max = 1000, ttlMs = 60 * 60 * 1000, now = Date.now } = {}) {
  const entries = new Map();

  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (entry.expires <= now()) {
        entries.delete(key);
        return undefined;
      }
      entries.delete(key);
      entries.set(key, entry);
      return entry.value;
    },
    set(key, value, ttl = ttlMs) {
      entries.delete(key);
      entries.set(key, { value, expires: now() + ttl });
      while (entries.size > max) {
        entries.delete(entries.keys().next().value);
      }
    },
    get size() {
      return entries.size;
    },
  };
}
