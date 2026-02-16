// Simple in-memory cache with TTL support

const cache = new Map();

function get(key) {
  const entry = cache.get(key);
  if (!entry) return undefined;

  // Check TTL expiration
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }

  return entry.value;
}

function set(key, value, ttlMs = 0) {
  const expiresAt = ttlMs > 0 ? Date.now() + ttlMs : null;
  cache.set(key, { value, expiresAt });
}

function clear(key) {
  cache.delete(key);
}

function clearAll() {
  cache.clear();
}

module.exports = {
  get,
  set,
  clear,
  clearAll,
};
