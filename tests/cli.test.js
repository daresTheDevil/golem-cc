const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { hasCommand, detectDatabases, cmdInit, cmdStatus, cmdReset, cmdEject, cmdUninstall, cmdLog } = require('../bin/golem');

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

// ============================================================================
// cmdUninstall
// ============================================================================

describe('cmdUninstall', () => {
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
    cmdUninstall([], { home: tmp });
    assert.ok(fs.existsSync(path.join(tmp, '.golem')), '.golem should still exist');
  });

  it('removes .golem directory', () => {
    fs.mkdirSync(path.join(tmp, '.golem', 'bin'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.golem', 'bin', 'golem'), 'binary');
    cmdUninstall(['--confirm'], { home: tmp });
    assert.ok(!fs.existsSync(path.join(tmp, '.golem')), '.golem should be removed');
  });

  it('restores .pre-golem backup files', () => {
    const claudeDir = path.join(tmp, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.mkdirSync(path.join(tmp, '.golem'), { recursive: true });
    fs.writeFileSync(path.join(claudeDir, 'CLAUDE.md'), 'golem version');
    fs.writeFileSync(path.join(claudeDir, 'CLAUDE.md.pre-golem'), 'original version');
    cmdUninstall(['--confirm'], { home: tmp });
    assert.strictEqual(
      fs.readFileSync(path.join(claudeDir, 'CLAUDE.md'), 'utf-8'),
      'original version'
    );
    assert.ok(!fs.existsSync(path.join(claudeDir, 'CLAUDE.md.pre-golem')));
  });

  it('cleans up .new files', () => {
    const claudeDir = path.join(tmp, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.mkdirSync(path.join(tmp, '.golem'), { recursive: true });
    fs.writeFileSync(path.join(claudeDir, 'settings.json'), '{}');
    fs.writeFileSync(path.join(claudeDir, 'settings.json.new'), '{"new": true}');
    cmdUninstall(['--confirm'], { home: tmp });
    assert.ok(!fs.existsSync(path.join(claudeDir, 'settings.json.new')), '.new file should be removed');
  });

  it('cleans PATH from RC files', () => {
    fs.mkdirSync(path.join(tmp, '.golem'), { recursive: true });
    const zshrc = path.join(tmp, '.zshrc');
    fs.writeFileSync(zshrc, 'export PATH="/usr/bin:$PATH"\n\n# Super Golem\nexport PATH="$PATH:$HOME/.golem/bin"\n\nalias ll="ls -la"\n');
    cmdUninstall(['--confirm'], { home: tmp });
    const content = fs.readFileSync(zshrc, 'utf-8');
    assert.ok(!content.includes('.golem/bin'), 'PATH entry should be removed');
    assert.ok(content.includes('alias ll'), 'other content should be preserved');
  });

  it('handles -y flag same as --confirm', () => {
    fs.mkdirSync(path.join(tmp, '.golem'), { recursive: true });
    cmdUninstall(['-y'], { home: tmp });
    assert.ok(!fs.existsSync(path.join(tmp, '.golem')), '.golem should be removed with -y');
  });

  it('handles missing .golem directory gracefully', () => {
    cmdUninstall(['--confirm'], { home: tmp });
  });
});

// ============================================================================
// cmdLog
// ============================================================================

describe('cmdLog', () => {
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

  it('handles missing logs directory gracefully', () => {
    // Should not throw
    cmdLog([]);
  });

  it('handles empty logs directory', () => {
    fs.mkdirSync(path.join(tmp, '.golem', 'logs'), { recursive: true });
    // Should not throw
    cmdLog([]);
  });

  it('shows most recent log by default', () => {
    const logsDir = path.join(tmp, '.golem', 'logs');
    fs.mkdirSync(logsDir, { recursive: true });
    fs.writeFileSync(path.join(logsDir, '2026-01-01-build.log'), 'old log');
    fs.writeFileSync(path.join(logsDir, '2026-02-15-build.log'), 'new log');
    // Should not throw — we can't easily capture stdout but verify it doesn't crash
    cmdLog([]);
  });

  it('accepts numeric argument', () => {
    const logsDir = path.join(tmp, '.golem', 'logs');
    fs.mkdirSync(logsDir, { recursive: true });
    fs.writeFileSync(path.join(logsDir, 'a.log'), 'log a');
    fs.writeFileSync(path.join(logsDir, 'b.log'), 'log b');
    fs.writeFileSync(path.join(logsDir, 'c.log'), 'log c');
    // Should not throw
    cmdLog(['2']);
  });
});
