// tests/repair.test.js — Test golem repair command
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const test = require('node:test');
const assert = require('node:assert/strict');

const PKG_ROOT = path.resolve(__dirname, '..');
const GOLEM_BIN = path.join(PKG_ROOT, 'bin/golem');

// Helper to create temp directory
function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'golem-repair-test-'));
}

// Helper to run golem command
function runGolem(args, env = {}) {
  const result = spawnSync(process.execPath, [GOLEM_BIN, ...args], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: 10000
  });
  return result;
}

test('golem repair command', async (t) => {

  await t.test('repair command exists', async () => {
    const result = runGolem(['help']);
    assert.strictEqual(result.status, 0, 'help should succeed');
    assert.ok(result.stdout.includes('repair'), 'help should mention repair command');
  });

  await t.test('repair detects missing templates', async () => {
    const tempHome = createTempDir();
    const golemHome = path.join(tempHome, '.golem');

    // Create partial GOLEM_HOME (missing templates)
    fs.mkdirSync(path.join(golemHome, 'bin'), { recursive: true });
    fs.writeFileSync(path.join(golemHome, 'version'), '4.0.0');

    const result = runGolem(['repair', '--dry-run'], {
      HOME: tempHome,
      GOLEM_HOME: golemHome
    });

    const output = result.stdout + result.stderr;
    assert.ok(
      output.includes('templates') || output.includes('missing') || output.includes('partial'),
      `Output should mention missing templates. Got: ${output}`
    );

    // Cleanup
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  await t.test('repair detects corrupted version file', async () => {
    const tempHome = createTempDir();
    const golemHome = path.join(tempHome, '.golem');

    // Create GOLEM_HOME with corrupted version
    fs.mkdirSync(path.join(golemHome, 'bin'), { recursive: true });
    fs.mkdirSync(path.join(golemHome, 'templates'), { recursive: true });
    fs.writeFileSync(path.join(golemHome, 'version'), ''); // Empty = corrupted

    const result = runGolem(['repair', '--dry-run'], {
      HOME: tempHome,
      GOLEM_HOME: golemHome
    });

    const output = result.stdout + result.stderr;
    assert.ok(
      output.includes('version') || output.includes('corrupt'),
      `Output should mention version corruption. Got: ${output}`
    );

    // Cleanup
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  await t.test('repair fixes missing templates', { skip: true }, async () => {
    // TODO: This test calls pnpm dlx which downloads from npm (not local changes)
    // Need integration test environment or mock installer
    const tempHome = createTempDir();
    const golemHome = path.join(tempHome, '.golem');

    // Create partial GOLEM_HOME (missing templates)
    fs.mkdirSync(path.join(golemHome, 'bin'), { recursive: true });
    fs.writeFileSync(path.join(golemHome, 'version'), '4.0.0');

    // Run repair
    const result = runGolem(['repair', '--force'], {
      HOME: tempHome,
      GOLEM_HOME: golemHome
    });

    // Should succeed
    assert.strictEqual(result.status, 0,
      `Repair should succeed. stderr: ${result.stderr}`);

    // Templates should now exist
    const templatesDir = path.join(golemHome, 'templates');
    assert.ok(fs.existsSync(templatesDir),
      'Templates directory should be created');

    // Cleanup
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  await t.test('repair works even if GOLEM_HOME is partially missing', { skip: true }, async () => {
    // TODO: Same as above - needs integration test environment
    const tempHome = createTempDir();
    const golemHome = path.join(tempHome, '.golem');

    // Create GOLEM_HOME but with only bin/ (very minimal)
    fs.mkdirSync(path.join(golemHome, 'bin'), { recursive: true });

    // Run repair
    const result = runGolem(['repair', '--force'], {
      HOME: tempHome,
      GOLEM_HOME: golemHome
    });

    // Should succeed
    assert.strictEqual(result.status, 0,
      `Repair should succeed even with minimal GOLEM_HOME. stderr: ${result.stderr}`);

    // Version file should exist after repair
    const versionFile = path.join(golemHome, 'version');
    assert.ok(fs.existsSync(versionFile),
      'Version file should be created');

    // Cleanup
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  await t.test('repair without --force prompts for confirmation', async () => {
    const tempHome = createTempDir();
    const golemHome = path.join(tempHome, '.golem');

    // Create partial GOLEM_HOME
    fs.mkdirSync(path.join(golemHome, 'bin'), { recursive: true });
    fs.writeFileSync(path.join(golemHome, 'version'), '4.0.0');

    const result = runGolem(['repair'], {
      HOME: tempHome,
      GOLEM_HOME: golemHome
    });

    const output = result.stdout + result.stderr;
    assert.ok(
      output.includes('--confirm') || output.includes('--force') || output.includes('proceed'),
      `Output should prompt for confirmation. Got: ${output}`
    );

    // Cleanup
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  await t.test('repair --dry-run does not modify filesystem', async () => {
    const tempHome = createTempDir();
    const golemHome = path.join(tempHome, '.golem');

    // Create partial GOLEM_HOME (missing templates)
    fs.mkdirSync(path.join(golemHome, 'bin'), { recursive: true });
    fs.writeFileSync(path.join(golemHome, 'version'), '4.0.0');

    // Run dry-run
    const result = runGolem(['repair', '--dry-run'], {
      HOME: tempHome,
      GOLEM_HOME: golemHome
    });

    // Templates should still be missing
    const templatesDir = path.join(golemHome, 'templates');
    assert.ok(!fs.existsSync(templatesDir),
      'Templates should NOT be created in dry-run mode');

    // Cleanup
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  await t.test('repair runs doctor after completion', { skip: true }, async () => {
    // TODO: Same as above - needs integration test environment
    const tempHome = createTempDir();
    const golemHome = path.join(tempHome, '.golem');

    // Create partial GOLEM_HOME
    fs.mkdirSync(path.join(golemHome, 'bin'), { recursive: true });
    fs.writeFileSync(path.join(golemHome, 'version'), '4.0.0');

    const result = runGolem(['repair', '--force'], {
      HOME: tempHome,
      GOLEM_HOME: golemHome
    });

    const output = result.stdout + result.stderr;

    // Output should mention doctor or verification
    assert.ok(
      output.includes('doctor') || output.includes('verif') || output.includes('check'),
      `Output should mention running doctor. Got: ${output}`
    );

    // Cleanup
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

});
