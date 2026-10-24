const DEDUP_TTL_SECONDS = 86400; // 24 hours

/**
 * In-process stand-in for the two Redis calls we use (get / set with EX), so
 * "still good?" dedup works on a single instance without REDIS_URL.
 * Entries expire lazily on read and are swept when the map grows past `maxEntries`.
 */
export function createMemoryDedupStore({ maxEntries = 50000, now = () => Date.now() } = {}) {
  const store = new Map();
  const sweep = () => {
    const t = now();
    for (const [key, expiresAt] of store) {
      if (expiresAt <= t) store.delete(key);
    }
    // Still too big: drop the oldest insertions (Map keeps insertion order).
    while (store.size > maxEntries) {
      store.delete(store.keys().next().value);
    }
  };
  return {
    async get(key) {
      const expiresAt = store.get(key);
      if (expiresAt === undefined) return null;
      if (expiresAt <= now()) {
        store.delete(key);
        return null;
      }
      return '1';
    },
    async set(key, _value, opts = {}) {
      const ttlMs = (opts.EX ?? DEDUP_TTL_SECONDS) * 1000;
      store.delete(key);
      store.set(key, now() + ttlMs);
      if (store.size > maxEntries) sweep();
    },
    get size() {
      return store.size;
    },
  };
}

export function confirmDedupKey(pinId, ip) {
  return `confirm:${pinId}:${ip}`;
}

/**
 * Returns true if this IP has already confirmed this pin within the TTL window.
 * Fails open (returns false) if Redis is unavailable.
 */
export async function isDuplicateConfirm(redisClient, pinId, ip) {
  if (!redisClient) return false;
  try {
    return !!(await redisClient.get(confirmDedupKey(pinId, ip)));
  } catch {
    return false;
  }
}

/**
 * Records a confirmation so subsequent calls to isDuplicateConfirm return true.
 * Silently swallows Redis errors — confirmation still proceeds.
 */
export async function markConfirmed(redisClient, pinId, ip) {
  if (!redisClient) return;
  try {
    await redisClient.set(confirmDedupKey(pinId, ip), '1', { EX: DEDUP_TTL_SECONDS });
  } catch {
    // non-critical — dedup just won't apply for this confirmation
  }
}

// Reports use the same store and window: one report per find per IP per day.
export function reportDedupKey(pinId, ip) {
  return `report:${pinId}:${ip}`;
}

/** Fails open, like isDuplicateConfirm. */
export async function isDuplicateReport(store, pinId, ip) {
  if (!store) return false;
  try {
    return !!(await store.get(reportDedupKey(pinId, ip)));
  } catch {
    return false;
  }
}

export async function markReported(store, pinId, ip) {
  if (!store) return;
  try {
    await store.set(reportDedupKey(pinId, ip), '1', { EX: DEDUP_TTL_SECONDS });
  } catch {
    // non-critical
  }
}
