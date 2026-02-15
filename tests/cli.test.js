const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { hasCommand, detectDatabases, cmdInit, cmdStatus, cmdReset, cmdEject } = require('../bin/golem');

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'golem-cli-test-'));
}

function rmTmpDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ============================================================================
// hasCommand
// ============================================================================

describe('hasCommand', () => {
  it('returns true for node (known to exist)', () => {
    assert.strictEqual(hasCommand('node'), true);
  });

  it('returns false for nonexistent command', () => {
    assert.strictEqual(hasCommand('nonexistent_cmd_xyz_999'), false);
  });

  it('returns false for invalid input (injection attempts)', () => {
    assert.strictEqual(hasCommand('node; rm -rf /'), false);
    assert.strictEqual(hasCommand('$(whoami)'), false);
    assert.strictEqual(hasCommand('node\nwhoami'), false);
    assert.strictEqual(hasCommand(''), false);
  });
});

// ============================================================================
// detectDatabases
// ============================================================================

describe('detectDatabases', () => {
  let tmp;
  let origCwd;

  beforeEach(() => {
    tmp = makeTmpDir();
    origCwd = process.cwd();
    process.chdir(tmp);
  });

  afterEach(() => {
    process.chdir(origCwd);
    rmTmpDir(tmp);
  });

  it('detects postgres from pg dependency', () => {
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({
      dependencies: { pg: '^8.0.0' },
    }));
    assert.ok(detectDatabases().includes('postgres'));
  });

  it('detects oracle from oracledb dependency', () => {
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({
      dependencies: { oracledb: '^6.0.0' },
    }));
    assert.ok(detectDatabases().includes('oracle'));
  });

  it('detects mssql from mssql dependency', () => {
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({
      dependencies: { mssql: '^10.0.0' },
    }));
    assert.ok(detectDatabases().includes('mssql'));
  });

  it('detects mssql from tedious dependency', () => {
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({
      dependencies: { tedious: '^18.0.0' },
    }));
    assert.ok(detectDatabases().includes('mssql'));
  });

  it('detects from .env.example keywords', () => {
    fs.writeFileSync(path.join(tmp, '.env.example'), 'DATABASE_URL=postgres://...\nORACLE_HOST=...\n');
    const dbs = detectDatabases();
    assert.ok(dbs.includes('postgres'));
    assert.ok(dbs.includes('oracle'));
  });

  it('returns empty array when nothing detected', () => {
    assert.deepStrictEqual(detectDatabases(), []);
  });

  it('deduplicates results', () => {
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({
      dependencies: { pg: '^8.0.0' },
    }));
    fs.writeFileSync(path.join(tmp, '.env.example'), 'DATABASE_URL=postgres://...\n');
    const dbs = detectDatabases();
    const pgCount = dbs.filter(d => d === 'postgres').length;
    assert.strictEqual(pgCount, 1, 'postgres should appear only once');
  });
});

// ============================================================================
// cmdInit — blocked directory guard
// ============================================================================

describe('cmdInit blocked directory guard', () => {
  it('rejects HOME directory', () => {
    const origCwd = process.cwd();
    process.chdir(os.homedir());
    try {
      // cmdInit calls process.exit(1) for blocked dirs — catch that
      const origExit = process.exit;
      let exitCode = null;
      process.exit = (code) => { exitCode = code; throw new Error('EXIT'); };
      try {
        cmdInit();
      } catch (e) {
        if (e.message !== 'EXIT') throw e;
      }
      process.exit = origExit;
      assert.strictEqual(exitCode, 1, 'should exit with code 1 for HOME');
    } finally {
      process.chdir(origCwd);
    }
  });

  it('rejects root directory', () => {
    const origCwd = process.cwd();
    process.chdir('/');
    try {
      const origExit = process.exit;
      let exitCode = null;
      process.exit = (code) => { exitCode = code; throw new Error('EXIT'); };
      try {
        cmdInit();
      } catch (e) {
        if (e.message !== 'EXIT') throw e;
      }
      process.exit = origExit;
      assert.strictEqual(exitCode, 1, 'should exit with code 1 for /');
    } finally {
      process.chdir(origCwd);
    }
  });
});

// ============================================================================
// cmdEject
// ============================================================================

describe('cmdEject', () => {
  let tmp;
  let origCwd;

  beforeEach(() => {
    tmp = makeTmpDir();
    origCwd = process.cwd();
    process.chdir(tmp);
  });

  afterEach(() => {
    process.chdir(origCwd);
    rmTmpDir(tmp);
  });

  it('does nothing without --confirm flag', () => {
    fs.mkdirSync(path.join(tmp, '.golem'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.golem', 'state.json'), '{}');
    cmdEject([]);
    assert.ok(fs.existsSync(path.join(tmp, '.golem')), '.golem should still exist');
  });

  it('removes .golem with --confirm flag', () => {
    fs.mkdirSync(path.join(tmp, '.golem'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.golem', 'state.json'), '{}');
    cmdEject(['--confirm']);
    assert.ok(!fs.existsSync(path.join(tmp, '.golem')), '.golem should be removed');
  });

  it('handles missing .golem directory gracefully', () => {
    // Should not throw
    cmdEject(['--confirm']);
  });
});

// ============================================================================
// cmdReset
// ============================================================================

describe('cmdReset', () => {
  let tmp;
  let origCwd;

  beforeEach(() => {
    tmp = makeTmpDir();
    origCwd = process.cwd();
    process.chdir(tmp);
  });

  afterEach(() => {
    process.chdir(origCwd);
    rmTmpDir(tmp);
  });

  it('resets state.json', () => {
    fs.mkdirSync(path.join(tmp, '.golem', 'logs'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.golem', 'state.json'), JSON.stringify({
      phase: 'building',
      tasks_completed: 5,
      tasks_total: 10,
    }));
    cmdReset();
    const state = JSON.parse(fs.readFileSync(path.join(tmp, '.golem', 'state.json'), 'utf-8'));
    assert.strictEqual(state.phase, 'initialized');
    assert.strictEqual(state.tasks_completed, 0);
    assert.strictEqual(state.tasks_total, 0);
  });

  it('clears logs directory including subdirectories', () => {
    const logsDir = path.join(tmp, '.golem', 'logs', 'sub');
    fs.mkdirSync(logsDir, { recursive: true });
    fs.writeFileSync(path.join(logsDir, 'test.log'), 'log data');
    fs.writeFileSync(path.join(tmp, '.golem', 'state.json'), '{}');
    cmdReset();
    assert.ok(fs.existsSync(path.join(tmp, '.golem', 'logs')), 'logs dir should exist');
    assert.strictEqual(fs.readdirSync(path.join(tmp, '.golem', 'logs')).length, 0, 'logs should be empty');
  });

  it('handles missing .golem directory gracefully', () => {
    // Should not throw
    cmdReset();
  });
});

// ============================================================================
// cmdStatus
// ============================================================================

describe('cmdStatus', () => {
  let tmp;
  let origCwd;

  beforeEach(() => {
    tmp = makeTmpDir();
    origCwd = process.cwd();
    process.chdir(tmp);
  });

  afterEach(() => {
    process.chdir(origCwd);
    rmTmpDir(tmp);
  });

  it('handles corrupted state.json without crashing', () => {
    fs.mkdirSync(path.join(tmp, '.golem'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.golem', 'state.json'), '{not valid json!!!');
    const origExit = process.exit;
    let exitCode = null;
    process.exit = (code) => { exitCode = code; throw new Error('EXIT'); };
    try {
      cmdStatus();
    } catch (e) {
      if (e.message !== 'EXIT') throw e;
    }
    process.exit = origExit;
    assert.strictEqual(exitCode, 1, 'should exit 1 for corrupted state');
  });

  it('exits 1 when no .golem directory exists', () => {
    const origExit = process.exit;
    let exitCode = null;
    process.exit = (code) => { exitCode = code; throw new Error('EXIT'); };
    try {
      cmdStatus();
    } catch (e) {
      if (e.message !== 'EXIT') throw e;
    }
    process.exit = origExit;
    assert.strictEqual(exitCode, 1);
  });
});
