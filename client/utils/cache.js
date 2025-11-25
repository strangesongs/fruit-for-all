// Client-side caching utility with TTL support

const CACHE_PREFIX = 'loquat_cache_';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Store data in cache with timestamp
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 * @param {number} ttl - Time to live in milliseconds (default: 5 min)
 */
export function setCache(key, data, ttl = DEFAULT_TTL) {
  try {
    const cacheItem = {
      data,
      timestamp: Date.now(),
      ttl
    };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(cacheItem));
  } catch (error) {
    console.warn('Failed to set cache:', error);
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
