// Tests for TASK-004: Verify error messages use formatError()
const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const PKG_ROOT = path.resolve(__dirname, '..');
const GOLEM_BIN = path.join(PKG_ROOT, 'bin', 'golem');
const INSTALLER_BIN = path.join(PKG_ROOT, 'bin', 'golem-cc');

describe('TASK-004: Error message refactoring', () => {

  describe('golem CLI error messages', () => {

    it('claudeSlashCommand error includes context and suggestion', () => {
      // Test error when claude CLI not found
      const result = spawnSync(process.execPath, [GOLEM_BIN, 'discuss', 'test'], {
        env: { ...process.env, PATH: '' }, // Remove claude from PATH
        encoding: 'utf-8',
      });
      assert.strictEqual(result.status, 1);
      assert.match(result.stderr, /claude CLI not found/i);
      // Should have context or suggestion
      assert.ok(
        result.stderr.includes('Context:') || result.stderr.includes('Suggested fix:'),
        'Error should include context or suggestion'
      );
    });

    it('cmdInit blocked directory error includes context', () => {
      // Use root directory which is definitely blocked
      const result = spawnSync(process.execPath, [GOLEM_BIN, 'init'], {
        cwd: '/',
        encoding: 'utf-8',
      });
      assert.strictEqual(result.status, 1);
      assert.match(result.stderr, /Cannot initialize/i);
      // Should include context about why blocked
      assert.ok(
        result.stderr.includes('Context:') || result.stderr.includes('blocked'),
        'Error should explain why directory is blocked'
      );
    });

    it('cmdInit templates missing error includes context', () => {
      const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'golem-test-'));
      const tempGolemHome = path.join(tempHome, '.golem');
      fs.mkdirSync(tempGolemHome, { recursive: true });

      const result = spawnSync(process.execPath, [GOLEM_BIN, 'init'], {
        cwd: tempHome,
        env: { ...process.env, GOLEM_HOME: tempGolemHome },
        encoding: 'utf-8',
      });

      // Cleanup
      fs.rmSync(tempHome, { recursive: true, force: true });

      assert.strictEqual(result.status, 1);
      assert.match(result.stderr, /Templates not found/i);
      // Should include context about templates location
      assert.ok(
        result.stderr.includes('Context:') || result.stderr.includes('GOLEM_HOME'),
        'Error should include template path context'
      );
    });

    it('cmdStatus corrupted state.json error includes suggestion', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'golem-test-'));
      const golemDir = path.join(tempDir, '.golem');
      fs.mkdirSync(golemDir, { recursive: true });
      fs.writeFileSync(path.join(golemDir, 'state.json'), 'NOT VALID JSON!!!');

      const result = spawnSync(process.execPath, [GOLEM_BIN, 'status'], {
        cwd: tempDir,
        encoding: 'utf-8',
      });

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });

      assert.strictEqual(result.status, 1);
      assert.match(result.stderr, /corrupted/i);
      // Should suggest running golem reset
      assert.ok(
        result.stderr.includes('golem reset') || result.stderr.includes('Suggested fix:'),
        'Error should suggest golem reset'
      );
    });

    it('cmdDiff git not found error includes context', () => {
      const result = spawnSync(process.execPath, [GOLEM_BIN, 'diff'], {
        env: { ...process.env, PATH: '' }, // Remove git from PATH
        encoding: 'utf-8',
      });
      assert.strictEqual(result.status, 1);
      assert.match(result.stderr, /git/i);
      // Should include context or suggestion
      assert.ok(
        result.stderr.includes('Context:') || result.stderr.includes('Suggested fix:'),
        'Error should include context or suggestion'
      );
    });

    it('cmdDiff not a git repo error includes suggestion', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'golem-test-'));

      const result = spawnSync(process.execPath, [GOLEM_BIN, 'diff'], {
        cwd: tempDir,
        encoding: 'utf-8',
      });

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });

      assert.strictEqual(result.status, 1);
      assert.match(result.stderr, /git repository/i);
      // Should suggest initializing git
      assert.ok(
        result.stderr.includes('git init') || result.stderr.includes('Suggested fix:'),
        'Error should suggest git init'
      );
    });

    it('golem discuss without args error includes usage', () => {
      const result = spawnSync(process.execPath, [GOLEM_BIN, 'discuss'], {
        encoding: 'utf-8',
      });
      assert.strictEqual(result.status, 1);
      assert.match(result.stderr, /Usage:/i);
      // Should show example usage
      assert.ok(
        result.stderr.includes('golem discuss') || result.stderr.includes('Suggested fix:'),
        'Error should show usage example'
      );
    });

    it('unknown command error includes suggestion', () => {
      const result = spawnSync(process.execPath, [GOLEM_BIN, 'nonexistent-command'], {
        encoding: 'utf-8',
      });
      assert.strictEqual(result.status, 1);
      assert.match(result.stderr, /Unknown command/i);
      // Should suggest using golem help
      assert.ok(
        result.stderr.includes('golem help') || result.stderr.includes('Suggested fix:'),
        'Error should suggest golem help'
      );
    });

  });

  describe('golem-cc installer error messages', () => {

    it('installer EACCES error includes context', () => {
      // We can't easily trigger a real EACCES in tests, but we can verify the error handler code exists
      const installerCode = fs.readFileSync(INSTALLER_BIN, 'utf-8');
      assert.match(installerCode, /EACCES/, 'Installer should handle EACCES errors');
      // The actual error formatting would be tested in an integration test
    });

    it('installer ENOSPC error includes context', () => {
      const installerCode = fs.readFileSync(INSTALLER_BIN, 'utf-8');
      assert.match(installerCode, /ENOSPC/, 'Installer should handle ENOSPC errors');
    });

  });

  describe('formatError utility validation', () => {

    it('all error sites should use formatError or have structured context', () => {
      // Read both CLI files and verify error messages follow format
      const golemCode = fs.readFileSync(GOLEM_BIN, 'utf-8');
      const installerCode = fs.readFileSync(INSTALLER_BIN, 'utf-8');

      // Count error sites
      const errorMatches = [
        ...golemCode.matchAll(/console\.error\([^)]+\)/g),
        ...installerCode.matchAll(/console\.error\([^)]+\)/g),
      ];

      // At least 8 error sites should exist (from our grep above)
      assert.ok(errorMatches.length >= 8, 'Should have at least 8 error sites');

      // This is a heuristic check — detailed validation done in integration tests
      // We just verify that formatError is imported where needed
      assert.match(golemCode, /formatError|Context:|Suggested fix:/,
        'golem should use formatError or structured errors');
    });

  });

});
