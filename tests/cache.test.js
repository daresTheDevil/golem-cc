const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

describe('cache', () => {
  let cache;

  beforeEach(() => {
    delete require.cache[require.resolve('../lib/cache.js')];
    cache = require('../lib/cache.js');
  });

  it('returns undefined for cache miss', () => {
    const result = cache.get('nonexistent');
    assert.strictEqual(result, undefined);
  });

  it('stores and retrieves values', () => {
    cache.set('key1', 'value1');
    const result = cache.get('key1');
    assert.strictEqual(result, 'value1');
  });

  it('handles multiple keys independently', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');

    assert.strictEqual(cache.get('key1'), 'value1');
    assert.strictEqual(cache.get('key2'), 'value2');
  });

  it('allows cache invalidation', () => {
    cache.set('key1', 'value1');
    cache.clear('key1');

    assert.strictEqual(cache.get('key1'), undefined);
  });

  it('clears all cache entries', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.clearAll();

    assert.strictEqual(cache.get('key1'), undefined);
    assert.strictEqual(cache.get('key2'), undefined);
  });

  it('supports TTL expiration', (t) => {
    cache.set('key1', 'value1', 50); // 50ms TTL

    // Should exist immediately
    assert.strictEqual(cache.get('key1'), 'value1');

    // Wait 100ms and check expiration
    return new Promise((resolve) => {
      setTimeout(() => {
        const result = cache.get('key1');
        assert.strictEqual(result, undefined);
        resolve();
      }, 100);
    });
  });

  it('handles zero TTL as no expiration', () => {
    cache.set('key1', 'value1', 0);
    assert.strictEqual(cache.get('key1'), 'value1');
  });

  it('handles negative TTL gracefully (no expiration)', () => {
    cache.set('key1', 'value1', -100);
    assert.strictEqual(cache.get('key1'), 'value1');
  });

  it('stores different value types', () => {
    cache.set('string', 'text');
    cache.set('number', 42);
    cache.set('boolean', true);
    cache.set('object', { key: 'value' });
    cache.set('array', [1, 2, 3]);

    assert.strictEqual(cache.get('string'), 'text');
    assert.strictEqual(cache.get('number'), 42);
    assert.strictEqual(cache.get('boolean'), true);
    assert.deepStrictEqual(cache.get('object'), { key: 'value' });
    assert.deepStrictEqual(cache.get('array'), [1, 2, 3]);
  });

  it('provides memoize helper for expensive functions', () => {
    let callCount = 0;
    const expensiveFn = (x) => {
      callCount++;
      return x * 2;
    };

    const memoized = cache.memoize(expensiveFn);

    // First call executes function
    assert.strictEqual(memoized(5), 10);
    assert.strictEqual(callCount, 1);

    // Second call with same arg returns cached result
    assert.strictEqual(memoized(5), 10);
    assert.strictEqual(callCount, 1); // Not incremented!

    // Different arg executes function again
    assert.strictEqual(memoized(10), 20);
    assert.strictEqual(callCount, 2);
  });

  it('memoize respects TTL', (t) => {
    let callCount = 0;
    const expensiveFn = (x) => {
      callCount++;
      return x * 2;
    };

    const memoized = cache.memoize(expensiveFn, 50); // 50ms TTL

    memoized(5);
    assert.strictEqual(callCount, 1);

    return new Promise((resolve) => {
      setTimeout(() => {
        memoized(5); // Should call function again after TTL
        assert.strictEqual(callCount, 2);
        resolve();
      }, 100);
    });
  });

  it('memoize generates cache keys from function name and args', () => {
    function myFunction(a, b) { return a + b; }
    const memoized = cache.memoize(myFunction);

    memoized(1, 2);
    memoized(3, 4);

    // Cache should have entries for both arg combinations
    // We can't directly inspect internal keys, but can verify behavior
    assert.strictEqual(memoized(1, 2), 3); // Cached
    assert.strictEqual(memoized(3, 4), 7); // Cached
  });
});
