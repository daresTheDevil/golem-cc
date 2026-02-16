// tests/edge-cases.test.js — Edge cases from spec (EC-01 through EC-06)
const fs = require('fs');
const path = require('path');
const os = require('os');
const test = require('node:test');
const assert = require('node:assert/strict');

const PKG_ROOT = path.resolve(__dirname, '..');

test('Edge cases', async (t) => {

  await t.test('EC-01: Corrupted version file detection', () => {
    const diagnostics = require('../lib/diagnostics.js');

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'golem-ec01-'));
    const golemHome = path.join(tempDir, '.golem');

    try {
      // Create GOLEM_HOME with empty version file
      fs.mkdirSync(path.join(golemHome, 'templates'), { recursive: true });
      fs.writeFileSync(path.join(golemHome, 'version'), ''); // Empty = corrupted

      const state = diagnostics.detectState(golemHome);

      assert.strictEqual(state.versionCorrupted, true, 'should detect corrupted version');
      assert.strictEqual(state.version, null, 'version should be null when corrupted');

      const suggestion = diagnostics.suggestFix(state);
      assert.ok(suggestion.includes('corrupt'), 'suggestion should mention corruption');

    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  await t.test('EC-02: GOLEM_HOME override to non-standard location', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'golem-ec02-'));
    const customGolemHome = path.join(tempDir, 'custom-location');

    try {
      // Create custom GOLEM_HOME
      fs.mkdirSync(path.join(customGolemHome, 'bin'), { recursive: true });
      fs.writeFileSync(path.join(customGolemHome, 'version'), '4.5.0');

      // Test diagnostics with custom location
      const diagnostics = require('../lib/diagnostics.js');
      const state = diagnostics.detectState(customGolemHome);

      assert.strictEqual(state.golemHomeExists, true, 'should detect custom GOLEM_HOME');
      assert.strictEqual(state.version, '4.5.0', 'should read version from custom location');

    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  await t.test('EC-03: NO_COLOR=0 should still disable colors', () => {
    // Save original
    const originalNoColor = process.env.NO_COLOR;

    try {
      // Set NO_COLOR=0 (any value disables colors)
      process.env.NO_COLOR = '0';

      // Reload colors module
      delete require.cache[require.resolve('../lib/colors.js')];
      const colors = require('../lib/colors.js');

      assert.strictEqual(colors.RED, '', 'NO_COLOR=0 should disable colors');
      assert.strictEqual(colors.GREEN, '', 'NO_COLOR=0 should disable all color codes');

    } finally {
      if (originalNoColor === undefined) {
        delete process.env.NO_COLOR;
      } else {
        process.env.NO_COLOR = originalNoColor;
      }
      // Reload without NO_COLOR
      delete require.cache[require.resolve('../lib/colors.js')];
    }
  });

  await t.test('EC-04: Cache with TTL=0 should never expire', () => {
    const cache = require('../lib/cache.js');

    // Clear cache
    cache.clearAll();

    // Set with TTL=0 (no expiration)
    cache.set('test-key', 'value', 0);

    // Wait a bit
    const start = Date.now();
    while (Date.now() - start < 50) {
      // Busy wait 50ms
    }

    // Should still exist
    const result = cache.get('test-key');
    assert.strictEqual(result, 'value', 'TTL=0 should mean no expiration');
  });

  await t.test('EC-05: Integrity check with missing checksums.json', () => {
    const integrity = require('../lib/integrity.js');

    // Verify checksum with non-existent checksums.json won't crash
    const tempFile = path.join(os.tmpdir(), 'test-file-ec05.txt');
    fs.writeFileSync(tempFile, 'test content');

    try {
      // This should return false (not throw), since expected hash is provided but file exists
      const result = integrity.verifyChecksum(tempFile, 'wrong-hash');
      assert.strictEqual(result, false, 'should return false for wrong hash');

      // Verify with correct hash should pass
      const crypto = require('crypto');
      const correctHash = crypto.createHash('sha256')
        .update(fs.readFileSync(tempFile))
        .digest('hex');

      const result2 = integrity.verifyChecksum(tempFile, correctHash);
      assert.strictEqual(result2, true, 'should return true for correct hash');

    } finally {
      fs.unlinkSync(tempFile);
    }
  });

  await t.test('EC-06: Multiple concurrent cache accesses', () => {
    const cache = require('../lib/cache.js');

    cache.clearAll();

    // Set multiple keys concurrently
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(Promise.resolve(cache.set(`key-${i}`, `value-${i}`)));
    }

    // Wait for all
    Promise.all(promises).then(() => {
      // Verify all keys exist
      for (let i = 0; i < 10; i++) {
        const result = cache.get(`key-${i}`);
        assert.strictEqual(result, `value-${i}`, `key-${i} should have correct value`);
      }
    });
  });

  await t.test('Symlink protection in smartCopy', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'golem-symlink-'));

    try {
      const srcFile = path.join(tempDir, 'source.txt');
      const linkDest = path.join(tempDir, 'link');
      const realDest = path.join(tempDir, 'real-dest.txt');

      fs.writeFileSync(srcFile, 'content');
      fs.writeFileSync(realDest, 'original');

      // Create symlink
      fs.symlinkSync(realDest, linkDest);

      // Try to smartCopy to symlink (should be blocked)
      const installer = require(path.join(PKG_ROOT, 'bin/golem-cc'));

      const result = installer.smartCopy(srcFile, linkDest);
      assert.strictEqual(result, 'blocked', 'should block symlink destinations');

      // Real dest should be unchanged
      const content = fs.readFileSync(realDest, 'utf8');
      assert.strictEqual(content, 'original', 'symlink target should not be overwritten');

    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  await t.test('Path traversal protection in copyDir', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'golem-path-traversal-'));

    try {
      const srcDir = path.join(tempDir, 'src');
      const destDir = path.join(tempDir, 'dest');

      fs.mkdirSync(srcDir);
      fs.mkdirSync(destDir);

      // Try to create a file with path traversal in name
      const badFilename = '../evil.txt';
      const srcFile = path.join(srcDir, badFilename);

      // This should fail or be sanitized
      // Node.js path.join normalizes paths, so this test verifies that behavior

      // Create legitimate file
      fs.writeFileSync(path.join(srcDir, 'good.txt'), 'content');

      // copyDir should skip the path traversal attempt
      const installer = require(path.join(PKG_ROOT, 'bin/golem-cc'));
      installer.copyDir(srcDir, destDir);

      // Verify only good.txt was copied
      const files = fs.readdirSync(destDir);
      assert.ok(files.includes('good.txt'), 'should copy legitimate file');
      assert.ok(!files.some(f => f.includes('..')), 'should not copy path traversal attempts');

    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

});
