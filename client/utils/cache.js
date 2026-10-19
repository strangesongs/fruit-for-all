// Client-side caching utility with TTL support

const CACHE_PREFIX = 'ffa_cache_';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
const PINS_KEY_PREFIX = 'pins_';

function normalizeCoord(value) {
  return Number(value).toFixed(6);
}

export function buildPinsCacheKey(bounds = null) {
  if (!bounds) return 'allPins';
  return `${PINS_KEY_PREFIX}${normalizeCoord(bounds.minLat)}_${normalizeCoord(bounds.maxLat)}_${normalizeCoord(bounds.minLng)}_${normalizeCoord(bounds.maxLng)}`;
}

/**
 * Store data in cache with timestamp
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 * @param {number} ttl - Time to live in milliseconds (default: 5 min)
 */
export function setCache(key, data, ttl = DEFAULT_TTL) {
  const value = JSON.stringify({ data, timestamp: Date.now(), ttl });
  try {
    pruneCaches(MAX_ENTRIES - 1);
    localStorage.setItem(CACHE_PREFIX + key, value);
  } catch (error) {
    // Most likely the storage quota: drop every cached entry and try once more.
    try {
      clearAllCaches();
      localStorage.setItem(CACHE_PREFIX + key, value);
    } catch (retryError) {
      console.warn('Failed to set cache:', retryError);
    }
  }
}

// Each map view gets its own key, so without this entries pile up until the
// localStorage quota is full. Expired entries go first, then the oldest.
const MAX_ENTRIES = 30;

export function pruneCaches(maxEntries = MAX_ENTRIES) {
  try {
    const now = Date.now();
    const live = [];
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(CACHE_PREFIX)) continue;
      let item = null;
      try { item = JSON.parse(localStorage.getItem(key)); } catch { /* unreadable */ }
      if (!item || typeof item.timestamp !== 'number' || now - item.timestamp > item.ttl) {
        localStorage.removeItem(key);
      } else {
        live.push([key, item.timestamp]);
      }
    }
    live.sort((a, b) => a[1] - b[1]);
    while (live.length > maxEntries) {
      localStorage.removeItem(live.shift()[0]);
    }
  } catch (error) {
    console.warn('Failed to prune caches:', error);
  }
}

/**
 * Get data from cache if not expired
 * @param {string} key - Cache key
 * @returns {any|null} Cached data or null if expired/not found
 */
export function getCache(key) {
  try {
    const item = localStorage.getItem(CACHE_PREFIX + key);
    if (!item) return null;

    const cacheItem = JSON.parse(item);
    const now = Date.now();
    
    // Check if expired
    if (now - cacheItem.timestamp > cacheItem.ttl) {
      // Remove expired cache
      clearCache(key);
      return null;
    }

    return cacheItem.data;
  } catch (error) {
    console.warn('Failed to get cache:', error);
    return null;
  }
}

/**
 * Check if cache exists and is valid
 * @param {string} key - Cache key
 * @returns {boolean}
 */
export function hasValidCache(key) {
  return getCache(key) !== null;
}

/**
 * Clear specific cache entry
 * @param {string} key - Cache key
 */
export function clearCache(key) {
  try {
    localStorage.removeItem(CACHE_PREFIX + key);
  } catch (error) {
    console.warn('Failed to clear cache:', error);
  }
}

export function clearCachesByPrefix(prefix) {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith(CACHE_PREFIX + prefix)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn('Failed to clear caches by prefix:', error);
  }
}

/**
 * Clear all loquat caches
 */
export function clearAllCaches() {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn('Failed to clear all caches:', error);
  }
}

/**
 * Get cache age in milliseconds
 * @param {string} key - Cache key
 * @returns {number|null} Age in ms or null if not found
 */
export function getCacheAge(key) {
  try {
    const item = localStorage.getItem(CACHE_PREFIX + key);
    if (!item) return null;

    const cacheItem = JSON.parse(item);
    return Date.now() - cacheItem.timestamp;
  } catch (error) {
    return null;
  }
}
