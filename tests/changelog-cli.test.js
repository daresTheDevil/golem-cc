const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Test will load from lib/changelog.js after it's created
let changelog;

describe('changelog CLI', () => {
  let testDir;

  before(() => {
    changelog = require('../lib/changelog.js');
    // Create temp test directory
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'changelog-test-'));
    process.chdir(testDir);
  });

  after(() => {
    // Clean up
    process.chdir('/');
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('run', () => {
    it('creates CHANGELOG.md if missing', () => {
      const result = changelog.run(['added', 'New feature']);

      assert.strictEqual(result.success, true, 'Should succeed');
      assert.ok(fs.existsSync('CHANGELOG.md'), 'Should create CHANGELOG.md');

      const content = fs.readFileSync('CHANGELOG.md', 'utf-8');
      assert.ok(content.includes('- New feature'), 'Should contain entry');
    });

    it('appends to existing CHANGELOG.md', () => {
      // File already exists from previous test
      const result = changelog.run(['fixed', 'Bug fix']);

      assert.strictEqual(result.success, true, 'Should succeed');

      const content = fs.readFileSync('CHANGELOG.md', 'utf-8');
      assert.ok(content.includes('- New feature'), 'Should keep old entry');
      assert.ok(content.includes('- Bug fix'), 'Should add new entry');
    });

    it('rejects invalid category', () => {
      const result = changelog.run(['invalid', 'Some message']);

      assert.strictEqual(result.success, false, 'Should fail');
      assert.ok(result.message.includes('invalid'), 'Error should mention invalid category');
    });

    it('suggests correction for typo', () => {
      const result = changelog.run(['fixes', 'Some fix']);

      assert.strictEqual(result.success, false, 'Should fail on typo');
      assert.ok(result.message.includes('fixed'), 'Should suggest "fixed"');
    });

    it('supports --dry-run without writing', () => {
      const beforeContent = fs.readFileSync('CHANGELOG.md', 'utf-8');

      const result = changelog.run(['--dry-run', 'security', 'Security patch']);

      assert.strictEqual(result.success, true, 'Should succeed');
      assert.ok(result.message.includes('Would add'), 'Should indicate dry-run');

      const afterContent = fs.readFileSync('CHANGELOG.md', 'utf-8');
      assert.strictEqual(beforeContent, afterContent, 'Should not modify file');
    });

    it('rejects empty message', () => {
      const result = changelog.run(['added', '']);

      assert.strictEqual(result.success, false, 'Should fail');
      assert.ok(result.message.includes('empty'), 'Error should mention empty');
    });

    it('rejects message with potential secret', () => {
      const result = changelog.run(['added', 'Added api_key: abc123def456']);

      assert.strictEqual(result.success, false, 'Should fail');
      assert.ok(result.message.includes('secret'), 'Error should mention secret');
    });

    it('joins multi-word messages', () => {
      fs.rmSync('CHANGELOG.md', { force: true }); // Fresh start
      const result = changelog.run(['added', 'New', 'feature', 'with', 'spaces']);

      assert.strictEqual(result.success, true, 'Should succeed');

      const content = fs.readFileSync('CHANGELOG.md', 'utf-8');
      assert.ok(content.includes('- New feature with spaces'), 'Should join words');
    });
  });
});
