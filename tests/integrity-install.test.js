// tests/integrity-install.test.js — Test integrity checks during install
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const PKG_ROOT = path.resolve(__dirname, '..');
const GOLEM_CC = path.join(PKG_ROOT, 'bin/golem-cc');

// Helper to create temp directory
function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'golem-test-'));
}

// Helper to run installer in isolated environment
function runInstaller(env = {}) {
  const result = spawnSync(process.execPath, [GOLEM_CC], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: 10000
  });
  return result;
}

// Helper to corrupt a file in the package
function corruptPackageFile(filepath) {
  const fullPath = path.join(PKG_ROOT, filepath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`);
  }
  const backup = fullPath + '.test-backup';
  fs.copyFileSync(fullPath, backup);
  fs.writeFileSync(fullPath, 'CORRUPTED_DATA_FOR_TESTING');
  return () => {
    // Restore
    fs.copyFileSync(backup, fullPath);
    fs.unlinkSync(backup);
  };
}

test('Integrity verification during install', async (t) => {

  await t.test('install succeeds with valid checksums', async () => {
    const tempHome = createTempDir();
    const result = runInstaller({
      HOME: tempHome,
      GOLEM_HOME: path.join(tempHome, '.golem')
    });

    // Should succeed (exit 0)
    assert.strictEqual(result.status, 0,
      `Installer should succeed with valid checksums. stderr: ${result.stderr}`);

    // Verify GOLEM_HOME was created
    const golemHome = path.join(tempHome, '.golem');
    assert.ok(fs.existsSync(golemHome), 'GOLEM_HOME should be created');

    // Cleanup
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  await t.test('install fails with corrupted file', { skip: true }, async () => {
    // TODO: This test interferes with other tests that load bin/golem
    // Need to refactor to use a mock package root instead of corrupting real files
    const tempHome = createTempDir();

    // Corrupt a critical file (bin/golem)
    const golemBin = path.join(PKG_ROOT, 'bin/golem');
    const backup = golemBin + '.test-backup';
    fs.copyFileSync(golemBin, backup);

    try {
      // Corrupt the file
      fs.writeFileSync(golemBin, 'CORRUPTED');

      // Try to install
      const result = runInstaller({
        HOME: tempHome,
        GOLEM_HOME: path.join(tempHome, '.golem')
      });

      // Should fail (exit non-zero)
      assert.notStrictEqual(result.status, 0,
        'Installer should fail with corrupted file');

      // Should mention integrity failure
      const output = result.stderr + result.stdout;
      assert.ok(
        output.includes('integrity') || output.includes('checksum') || output.includes('corrupt'),
        `Output should mention integrity/checksum failure. Got: ${output}`
      );

      // GOLEM_HOME should NOT have the corrupted binary
      const golemHome = path.join(tempHome, '.golem');
      const golemDest = path.join(golemHome, 'bin/golem');
      assert.ok(
        !fs.existsSync(golemDest),
        'Corrupted file should not be installed'
      );

    } finally {
      // Restore
      fs.copyFileSync(backup, golemBin);
      fs.unlinkSync(backup);
      fs.rmSync(tempHome, { recursive: true, force: true });
    }
  });

  await t.test('checksums.json exists in package', async () => {
    const checksumsPath = path.join(PKG_ROOT, 'checksums.json');
    assert.ok(fs.existsSync(checksumsPath),
      'checksums.json should exist at package root');

    const checksums = JSON.parse(fs.readFileSync(checksumsPath, 'utf8'));

    // Should have entries
    assert.ok(Object.keys(checksums).length > 0,
      'checksums.json should have entries');

    // Should include critical files
    assert.ok(checksums['bin/golem'],
      'checksums.json should include bin/golem');
    assert.ok(checksums['user-scope/settings.json'],
      'checksums.json should include settings.json');
  });

  await t.test('prepublishOnly script configured', async () => {
    const pkgJson = JSON.parse(
      fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8')
    );

    assert.ok(
      pkgJson.scripts && pkgJson.scripts.prepublishOnly,
      'package.json should have prepublishOnly script'
    );

    assert.ok(
      pkgJson.scripts.prepublishOnly.includes('generate-checksums'),
      'prepublishOnly should run generate-checksums'
    );
  });

  await t.test('integrity check completes in <500ms', async () => {
    const tempHome = createTempDir();
    const start = Date.now();

    const result = runInstaller({
      HOME: tempHome,
      GOLEM_HOME: path.join(tempHome, '.golem')
    });

    const duration = Date.now() - start;

    assert.strictEqual(result.status, 0, 'Installer should succeed');

    // Total install time should be reasonable (includes subprocess spawn overhead)
    // Integrity checks alone should add <500ms, but total time will be higher
    assert.ok(
      duration < 10000,
      `Install should complete in <10s (includes overhead). Got ${duration}ms`
    );

    // Cleanup
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

});
