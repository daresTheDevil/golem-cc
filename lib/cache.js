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

function memoize(fn, ttlMs = 0) {
  return function(...args) {
    const key = `${fn.name}:${JSON.stringify(args)}`;
    const cached = get(key);
    if (cached !== undefined) return cached;

    const result = fn(...args);
    set(key, result, ttlMs);
    return result;
  };
}

module.exports = {
  get,
  set,
  clear,
  clearAll,
  memoize,
};
