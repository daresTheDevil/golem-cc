// Tests for TASK-007: Integrity verification
const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

describe('lib/integrity.js', () => {

  let integrity;

  it('exports verifyChecksum and generateManifest functions', () => {
    integrity = require(path.join(__dirname, '..', 'lib', 'integrity.js'));
    assert.ok(typeof integrity.verifyChecksum === 'function', 'Should export verifyChecksum');
    assert.ok(typeof integrity.generateManifest === 'function', 'Should export generateManifest');
  });

  describe('verifyChecksum', () => {

    it('returns true for matching checksum', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'golem-test-'));
      const testFile = path.join(tempDir, 'test.txt');
      fs.writeFileSync(testFile, 'test content');

      // Calculate expected hash
      const expectedHash = crypto.createHash('sha256').update('test content').digest('hex');

      const result = integrity.verifyChecksum(testFile, expectedHash);

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });

      assert.strictEqual(result, true, 'Should return true for matching checksum');
    });

    it('returns false for mismatched checksum', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'golem-test-'));
      const testFile = path.join(tempDir, 'test.txt');
      fs.writeFileSync(testFile, 'test content');

      const wrongHash = 'a'.repeat(64); // Invalid hash

      const result = integrity.verifyChecksum(testFile, wrongHash);

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });

      assert.strictEqual(result, false, 'Should return false for mismatched checksum');
    });

    it('returns false for missing file', () => {
      const result = integrity.verifyChecksum('/nonexistent/file.txt', 'a'.repeat(64));
      assert.strictEqual(result, false, 'Should return false for missing file');
    });

    it('handles empty file', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'golem-test-'));
      const testFile = path.join(tempDir, 'empty.txt');
      fs.writeFileSync(testFile, '');

      const expectedHash = crypto.createHash('sha256').update('').digest('hex');
      const result = integrity.verifyChecksum(testFile, expectedHash);

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });

      assert.strictEqual(result, true, 'Should handle empty file correctly');
    });

    it('uses SHA-256 algorithm', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'golem-test-'));
      const testFile = path.join(tempDir, 'test.txt');
      fs.writeFileSync(testFile, 'SHA-256 test');

      // SHA-256 produces 64-character hex string
      const sha256Hash = crypto.createHash('sha256').update('SHA-256 test').digest('hex');
      assert.strictEqual(sha256Hash.length, 64, 'SHA-256 should produce 64-char hex');

      const result = integrity.verifyChecksum(testFile, sha256Hash);

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });

      assert.strictEqual(result, true, 'Should use SHA-256');
    });

  });

  describe('generateManifest', () => {

    it('generates manifest for directory', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'golem-test-'));
      fs.writeFileSync(path.join(tempDir, 'file1.txt'), 'content1');
      fs.writeFileSync(path.join(tempDir, 'file2.txt'), 'content2');

      const manifest = integrity.generateManifest(tempDir);

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });

      assert.ok(manifest, 'Should return manifest object');
      assert.ok(typeof manifest === 'object', 'Manifest should be an object');
      assert.ok(Object.keys(manifest).length > 0, 'Manifest should have entries');
    });

    it('includes file paths and checksums', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'golem-test-'));
      const file1 = path.join(tempDir, 'file1.txt');
      fs.writeFileSync(file1, 'content1');

      const manifest = integrity.generateManifest(tempDir);

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });

      // Manifest should have file1.txt entry
      const entries = Object.keys(manifest);
      assert.ok(entries.some(e => e.includes('file1.txt')), 'Manifest should include file1.txt');

      // Checksums should be 64-char hex (SHA-256)
      for (const hash of Object.values(manifest)) {
        assert.strictEqual(typeof hash, 'string', 'Hash should be a string');
        assert.match(hash, /^[a-f0-9]{64}$/, 'Hash should be 64-char hex');
      }
    });

    it('handles subdirectories recursively', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'golem-test-'));
      const subDir = path.join(tempDir, 'sub');
      fs.mkdirSync(subDir);
      fs.writeFileSync(path.join(tempDir, 'root.txt'), 'root');
      fs.writeFileSync(path.join(subDir, 'nested.txt'), 'nested');

      const manifest = integrity.generateManifest(tempDir);

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });

      const entries = Object.keys(manifest);
      assert.ok(entries.some(e => e.includes('root.txt')), 'Should include root file');
      assert.ok(entries.some(e => e.includes('nested.txt')), 'Should include nested file');
    });

    it('ignores node_modules and .git directories', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'golem-test-'));
      const nodeModules = path.join(tempDir, 'node_modules');
      const gitDir = path.join(tempDir, '.git');
      fs.mkdirSync(nodeModules);
      fs.mkdirSync(gitDir);
      fs.writeFileSync(path.join(nodeModules, 'ignored.txt'), 'ignored');
      fs.writeFileSync(path.join(gitDir, 'ignored.txt'), 'ignored');
      fs.writeFileSync(path.join(tempDir, 'included.txt'), 'included');

      const manifest = integrity.generateManifest(tempDir);

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });

      const entries = Object.keys(manifest);
      assert.ok(entries.some(e => e.includes('included.txt')), 'Should include normal files');
      assert.ok(!entries.some(e => e.includes('node_modules')), 'Should ignore node_modules');
      assert.ok(!entries.some(e => e.includes('.git')), 'Should ignore .git');
    });

    it('returns empty object for nonexistent directory', () => {
      const manifest = integrity.generateManifest('/nonexistent/dir');
      assert.deepStrictEqual(manifest, {}, 'Should return empty object for nonexistent directory');
    });

  });

});
