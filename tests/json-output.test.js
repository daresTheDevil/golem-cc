// Tests for TASK-005 and TASK-006: JSON output modes
const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const PKG_ROOT = path.resolve(__dirname, '..');
const GOLEM_BIN = path.join(PKG_ROOT, 'bin', 'golem');

describe('JSON output modes', () => {

  describe('golem status --json', () => {

    it('outputs valid JSON', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'golem-test-'));
      const golemDir = path.join(tempDir, '.golem');
      fs.mkdirSync(golemDir, { recursive: true });
      fs.writeFileSync(path.join(golemDir, 'state.json'), JSON.stringify({
        phase: 'building',
        tasks_completed: 5,
        tasks_total: 10,
        created: '2026-01-01T00:00:00Z',
      }));

      const result = spawnSync(process.execPath, [GOLEM_BIN, 'status', '--json'], {
        cwd: tempDir,
        encoding: 'utf-8',
      });

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });

      assert.strictEqual(result.status, 0);
      // Should be valid JSON
      let json;
      assert.doesNotThrow(() => {
        json = JSON.parse(result.stdout);
      }, 'Output should be valid JSON');

      // Should have expected fields
      assert.ok(json.phase, 'Should have phase field');
      assert.strictEqual(json.tasks_completed, 5);
      assert.strictEqual(json.tasks_total, 10);
      assert.strictEqual(json.created, '2026-01-01T00:00:00Z');
    });

    it('includes git info when in a git repo', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'golem-test-'));
      const golemDir = path.join(tempDir, '.golem');
      fs.mkdirSync(golemDir, { recursive: true });
      fs.writeFileSync(path.join(golemDir, 'state.json'), JSON.stringify({
        phase: 'initialized',
        tasks_completed: 0,
        tasks_total: 0,
        created: '2026-01-01T00:00:00Z',
      }));

      // Initialize git repo
      spawnSync('git', ['init'], { cwd: tempDir, stdio: 'pipe' });
      spawnSync('git', ['config', 'user.email', 'test@test.com'], { cwd: tempDir, stdio: 'pipe' });
      spawnSync('git', ['config', 'user.name', 'Test'], { cwd: tempDir, stdio: 'pipe' });
      spawnSync('git', ['checkout', '-b', 'feature-test'], { cwd: tempDir, stdio: 'pipe' });

      const result = spawnSync(process.execPath, [GOLEM_BIN, 'status', '--json'], {
        cwd: tempDir,
        encoding: 'utf-8',
      });

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });

      assert.strictEqual(result.status, 0);
      const json = JSON.parse(result.stdout);
      assert.ok(json.git, 'Should have git field');
      assert.ok(json.git.branch, 'Should have git branch');
      assert.strictEqual(json.git.branch, 'feature-test');
    });

    it('sets git fields to null when not a git repo', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'golem-test-'));
      const golemDir = path.join(tempDir, '.golem');
      fs.mkdirSync(golemDir, { recursive: true });
      fs.writeFileSync(path.join(golemDir, 'state.json'), JSON.stringify({
        phase: 'initialized',
        tasks_completed: 0,
        tasks_total: 0,
        created: '2026-01-01T00:00:00Z',
      }));

      const result = spawnSync(process.execPath, [GOLEM_BIN, 'status', '--json'], {
        cwd: tempDir,
        encoding: 'utf-8',
      });

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });

      assert.strictEqual(result.status, 0);
      const json = JSON.parse(result.stdout);
      // git field should exist but be null or have null values
      assert.ok('git' in json, 'Should have git field');
      if (json.git !== null) {
        assert.strictEqual(json.git.branch, null);
      }
    });

    it('outputs only JSON with no extra text', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'golem-test-'));
      const golemDir = path.join(tempDir, '.golem');
      fs.mkdirSync(golemDir, { recursive: true });
      fs.writeFileSync(path.join(golemDir, 'state.json'), JSON.stringify({
        phase: 'initialized',
        tasks_completed: 0,
        tasks_total: 0,
        created: '2026-01-01T00:00:00Z',
      }));

      const result = spawnSync(process.execPath, [GOLEM_BIN, 'status', '--json'], {
        cwd: tempDir,
        encoding: 'utf-8',
      });

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });

      // Should not have any text before or after JSON
      const trimmed = result.stdout.trim();
      assert.match(trimmed, /^\{/, 'Should start with {');
      assert.match(trimmed, /\}$/, 'Should end with }');

      // Should parse as valid JSON without modification
      assert.doesNotThrow(() => JSON.parse(trimmed));
    });

    it('human mode (no --json) is unchanged', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'golem-test-'));
      const golemDir = path.join(tempDir, '.golem');
      fs.mkdirSync(golemDir, { recursive: true });
      fs.writeFileSync(path.join(golemDir, 'state.json'), JSON.stringify({
        phase: 'building',
        tasks_completed: 3,
        tasks_total: 10,
        created: '2026-01-01T00:00:00Z',
      }));

      const result = spawnSync(process.execPath, [GOLEM_BIN, 'status'], {
        cwd: tempDir,
        encoding: 'utf-8',
      });

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });

      // Human mode should NOT be JSON
      assert.throws(() => JSON.parse(result.stdout), 'Human mode should not output JSON');
      // Should contain human-readable text
      assert.match(result.stdout, /Phase:/i, 'Should have Phase label');
      assert.match(result.stdout, /Tasks:/i, 'Should have Tasks label');
    });

    it('handles missing state.json in JSON mode', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'golem-test-'));

      const result = spawnSync(process.execPath, [GOLEM_BIN, 'status', '--json'], {
        cwd: tempDir,
        encoding: 'utf-8',
      });

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });

      // Should still output valid JSON (error object)
      assert.strictEqual(result.status, 1);
      // Stderr should have error, stdout may be empty or have error JSON
      // Depending on implementation, error might go to stderr or be JSON on stdout
    });

  });

  describe('golem doctor --json', () => {

    it('outputs valid JSON with all checks', () => {
      const result = spawnSync(process.execPath, [GOLEM_BIN, 'doctor', '--json'], {
        encoding: 'utf-8',
      });

      // May pass or fail depending on system state, but should output JSON
      let json;
      assert.doesNotThrow(() => {
        json = JSON.parse(result.stdout);
      }, 'Output should be valid JSON');

      // Should have checks array
      assert.ok(Array.isArray(json.checks), 'Should have checks array');
      assert.ok(json.checks.length > 0, 'Should have at least one check');

      // Each check should have expected fields
      for (const check of json.checks) {
        assert.ok(check.name, 'Check should have name');
        assert.ok(typeof check.ok === 'boolean', 'Check should have ok boolean');
        assert.ok(check.detail !== undefined, 'Check should have detail');
      }
    });

    it('human mode (no --json) is unchanged', () => {
      const result = spawnSync(process.execPath, [GOLEM_BIN, 'doctor'], {
        encoding: 'utf-8',
      });

      // Human mode should NOT be JSON
      assert.throws(() => JSON.parse(result.stdout), 'Human mode should not output JSON');
      // Should contain human-readable text
      assert.match(result.stdout, /Golem Doctor/i, 'Should have Golem Doctor header');
    });

  });

  describe('golem log --json', () => {

    it('outputs valid JSON when logs exist', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'golem-test-'));
      const golemDir = path.join(tempDir, '.golem');
      const logsDir = path.join(golemDir, 'logs');
      fs.mkdirSync(logsDir, { recursive: true });
      fs.writeFileSync(path.join(logsDir, 'build-001.md'), '# Build log 1\nSome content');
      fs.writeFileSync(path.join(logsDir, 'build-002.md'), '# Build log 2\nMore content');

      const result = spawnSync(process.execPath, [GOLEM_BIN, 'log', '--json'], {
        cwd: tempDir,
        encoding: 'utf-8',
      });

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });

      assert.strictEqual(result.status, 0);
      let json;
      assert.doesNotThrow(() => {
        json = JSON.parse(result.stdout);
      }, 'Output should be valid JSON');

      // Should have logs array
      assert.ok(Array.isArray(json.logs), 'Should have logs array');
      assert.ok(json.logs.length > 0, 'Should have at least one log');

      // Each log should have filename and content
      for (const log of json.logs) {
        assert.ok(log.filename, 'Log should have filename');
        assert.ok(typeof log.content === 'string', 'Log should have content string');
      }
    });

    it('outputs empty array when no logs exist', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'golem-test-'));

      const result = spawnSync(process.execPath, [GOLEM_BIN, 'log', '--json'], {
        cwd: tempDir,
        encoding: 'utf-8',
      });

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });

      // Should output JSON even when no logs exist
      let json;
      assert.doesNotThrow(() => {
        json = JSON.parse(result.stdout);
      }, 'Output should be valid JSON');

      assert.ok(Array.isArray(json.logs), 'Should have logs array');
      assert.strictEqual(json.logs.length, 0, 'Logs array should be empty');
    });

    it('human mode (no --json) is unchanged', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'golem-test-'));
      const golemDir = path.join(tempDir, '.golem');
      const logsDir = path.join(golemDir, 'logs');
      fs.mkdirSync(logsDir, { recursive: true });
      fs.writeFileSync(path.join(logsDir, 'build-001.md'), '# Build log\nContent');

      const result = spawnSync(process.execPath, [GOLEM_BIN, 'log'], {
        cwd: tempDir,
        encoding: 'utf-8',
      });

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });

      // Human mode should NOT be JSON
      assert.throws(() => JSON.parse(result.stdout), 'Human mode should not output JSON');
      // Should contain the log content
      assert.match(result.stdout, /build-001\.md/i, 'Should show log filename');
    });

  });

});
