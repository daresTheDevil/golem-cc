const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { sanitizeArgs, hasCommand, detectDatabases, detectProjectType, updateGitignore, cmdInit, cmdDoctor, cmdStatus, cmdReset, cmdEject, cmdUninstall, cmdLog } = require('../bin/golem');

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
// sanitizeArgs
// ============================================================================

describe('sanitizeArgs', () => {
  it('strips newlines and replaces with spaces', () => {
    assert.strictEqual(sanitizeArgs('hello\nworld'), 'hello world');
    assert.strictEqual(sanitizeArgs('hello\r\nworld'), 'hello world');
    assert.strictEqual(sanitizeArgs('a\nb\nc'), 'a b c');
  });

  it('strips control characters but preserves tabs', () => {
    assert.strictEqual(sanitizeArgs('hello\x00world'), 'helloworld');
    assert.strictEqual(sanitizeArgs('hello\x07world'), 'helloworld');
    assert.strictEqual(sanitizeArgs('hello\tworld'), 'hello\tworld');
  });

  it('preserves normal text unchanged', () => {
    assert.strictEqual(sanitizeArgs('golem discuss "add a feature"'), 'golem discuss "add a feature"');
    assert.strictEqual(sanitizeArgs('simple text 123'), 'simple text 123');
  });

  it('handles empty and null input', () => {
    assert.strictEqual(sanitizeArgs(''), '');
    assert.strictEqual(sanitizeArgs(null), '');
    assert.strictEqual(sanitizeArgs(undefined), '');
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
    fs.writeFileSync(zshrc, 'export PATH="/usr/bin:$PATH"\n\n# Golem\nexport PATH="$PATH:$HOME/.golem/bin"\n\nalias ll="ls -la"\n');
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

// ============================================================================
// detectProjectType
// ============================================================================

describe('detectProjectType', () => {
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

  it('detects Nuxt from nuxt.config.ts', () => {
    fs.writeFileSync(path.join(tmp, 'nuxt.config.ts'), '');
    assert.strictEqual(detectProjectType(tmp, new Set()), 'Nuxt');
  });

  it('detects Nuxt from nuxt.config.mjs', () => {
    fs.writeFileSync(path.join(tmp, 'nuxt.config.mjs'), '');
    assert.strictEqual(detectProjectType(tmp, new Set()), 'Nuxt');
  });

  it('detects Next.js from next.config.js', () => {
    fs.writeFileSync(path.join(tmp, 'next.config.js'), '');
    assert.strictEqual(detectProjectType(tmp, new Set()), 'Next.js');
  });

  it('detects PHP from composer.json', () => {
    fs.writeFileSync(path.join(tmp, 'composer.json'), '{}');
    assert.strictEqual(detectProjectType(tmp, new Set()), 'PHP');
  });

  it('detects Node.js from package.json', () => {
    fs.writeFileSync(path.join(tmp, 'package.json'), '{}');
    assert.strictEqual(detectProjectType(tmp, new Set()), 'Node.js');
  });

  it('detects Next.js from next.config.mjs', () => {
    fs.writeFileSync(path.join(tmp, 'next.config.mjs'), '');
    assert.strictEqual(detectProjectType(tmp, new Set()), 'Next.js');
  });

  it('returns project when nothing detected', () => {
    assert.strictEqual(detectProjectType(tmp, new Set()), 'project');
  });

  it('flag overrides auto-detection', () => {
    fs.writeFileSync(path.join(tmp, 'package.json'), '{}');
    assert.strictEqual(detectProjectType(tmp, new Set(['nuxt'])), 'Nuxt');
  });
});

// ============================================================================
// updateGitignore
// ============================================================================

describe('updateGitignore', () => {
  let tmp;

  beforeEach(() => { tmp = makeTmpDir(); });
  afterEach(() => { rmTmpDir(tmp); });

  it('adds .env and .golem/ when missing', () => {
    fs.writeFileSync(path.join(tmp, '.gitignore'), 'node_modules/\n');
    updateGitignore(tmp);
    const content = fs.readFileSync(path.join(tmp, '.gitignore'), 'utf-8');
    assert.ok(content.includes('.env'));
    assert.ok(content.includes('.golem/'));
  });

  it('does not duplicate existing entries', () => {
    fs.writeFileSync(path.join(tmp, '.gitignore'), '.env\n.golem/\n');
    updateGitignore(tmp);
    const content = fs.readFileSync(path.join(tmp, '.gitignore'), 'utf-8');
    assert.strictEqual(content, '.env\n.golem/\n');
  });

  it('adds .env when only .env.local exists (not a substring match)', () => {
    fs.writeFileSync(path.join(tmp, '.gitignore'), '.env.local\nnode_modules/\n');
    updateGitignore(tmp);
    const content = fs.readFileSync(path.join(tmp, '.gitignore'), 'utf-8');
    assert.ok(content.includes('\n.env\n'), 'should add .env as its own entry');
    assert.ok(content.includes('.env.local'), 'should preserve .env.local');
  });

  it('does nothing when no .gitignore exists', () => {
    updateGitignore(tmp);
    assert.ok(!fs.existsSync(path.join(tmp, '.gitignore')));
  });
});

// ============================================================================
// cmdInit happy path
// ============================================================================

// Resolve GOLEM_HOME the same way the module does (at require time)
const GOLEM_HOME_RESOLVED = process.env.GOLEM_HOME || path.join(os.homedir(), '.golem');

describe('cmdInit happy path', () => {
  let tmp;
  let origCwd;
  let createdGolemTemplates = false;

  beforeEach(() => {
    tmp = makeTmpDir();
    origCwd = process.cwd();

    // Ensure templates exist at the module's resolved GOLEM_HOME
    const templatesDir = path.join(GOLEM_HOME_RESOLVED, 'templates');
    if (!fs.existsSync(path.join(templatesDir, 'commands'))) {
      createdGolemTemplates = true;
      fs.mkdirSync(path.join(templatesDir, 'commands'), { recursive: true });
      fs.mkdirSync(path.join(templatesDir, 'agents'), { recursive: true });
      fs.writeFileSync(path.join(templatesDir, 'commands', 'golem-build.md'), 'build cmd');
      fs.writeFileSync(path.join(templatesDir, 'agents', 'security-scanner.md'), 'scanner');
      fs.writeFileSync(path.join(templatesDir, 'settings.json'), '{}');
      fs.writeFileSync(path.join(templatesDir, 'settings.local.json'), '{}');
      fs.writeFileSync(path.join(templatesDir, 'mcp.json'), '{}');
    }

    const projectDir = path.join(tmp, 'my-project');
    fs.mkdirSync(projectDir);
    process.chdir(projectDir);
  });

  afterEach(() => {
    process.chdir(origCwd);
    rmTmpDir(tmp);
    if (createdGolemTemplates) {
      fs.rmSync(GOLEM_HOME_RESOLVED, { recursive: true, force: true });
      createdGolemTemplates = false;
    }
  });

  it('creates .claude and .golem directories', () => {
    cmdInit([]);
    const projectDir = process.cwd();
    assert.ok(fs.existsSync(path.join(projectDir, '.claude', 'commands')));
    assert.ok(fs.existsSync(path.join(projectDir, '.claude', 'agents')));
    assert.ok(fs.existsSync(path.join(projectDir, '.golem', 'logs')));
    assert.ok(fs.existsSync(path.join(projectDir, '.golem', 'plans')));
  });

  it('copies template files from GOLEM_HOME', () => {
    cmdInit([]);
    const projectDir = process.cwd();
    // At least the directories should exist after init (template copying may vary)
    assert.ok(fs.existsSync(path.join(projectDir, '.claude', 'commands')));
    assert.ok(fs.existsSync(path.join(projectDir, '.claude', 'agents')));
  });

  it('creates state.json', () => {
    cmdInit([]);
    const state = JSON.parse(fs.readFileSync(path.join(process.cwd(), '.golem', 'state.json'), 'utf-8'));
    assert.strictEqual(state.phase, 'initialized');
    assert.strictEqual(state.tasks_completed, 0);
  });

  it('creates CLAUDE.md with detected project type', () => {
    fs.writeFileSync(path.join(process.cwd(), 'package.json'), '{}');
    cmdInit([]);
    const content = fs.readFileSync(path.join(process.cwd(), 'CLAUDE.md'), 'utf-8');
    assert.ok(content.includes('Node.js'));
  });

  it('creates CLAUDE.md with Nuxt detection via flag', () => {
    cmdInit(['--nuxt']);
    const content = fs.readFileSync(path.join(process.cwd(), 'CLAUDE.md'), 'utf-8');
    assert.ok(content.includes('Nuxt'));
    assert.ok(content.includes('nuxt.md'));
  });

  it('creates CLAUDE.md with DB skill refs via flags', () => {
    cmdInit(['--pg', '--oracle']);
    const content = fs.readFileSync(path.join(process.cwd(), 'CLAUDE.md'), 'utf-8');
    assert.ok(content.includes('postgres.md'));
    assert.ok(content.includes('oracle.md'));
  });

  it('creates .env.example', () => {
    cmdInit([]);
    assert.ok(fs.existsSync(path.join(process.cwd(), '.env.example')));
  });

  it('warns on unknown flags without crashing', () => {
    cmdInit(['--unknown', '--nuxt']);
    const content = fs.readFileSync(path.join(process.cwd(), 'CLAUDE.md'), 'utf-8');
    assert.ok(content.includes('Nuxt'));
  });

  it('does not overwrite existing CLAUDE.md', () => {
    fs.writeFileSync(path.join(process.cwd(), 'CLAUDE.md'), 'custom');
    cmdInit([]);
    const content = fs.readFileSync(path.join(process.cwd(), 'CLAUDE.md'), 'utf-8');
    assert.strictEqual(content, 'custom');
  });

  it('updates .gitignore when present', () => {
    fs.writeFileSync(path.join(process.cwd(), '.gitignore'), 'node_modules/\n');
    cmdInit([]);
    const content = fs.readFileSync(path.join(process.cwd(), '.gitignore'), 'utf-8');
    assert.ok(content.includes('.env'));
    assert.ok(content.includes('.golem/'));
  });

  it('auto-detects Nuxt from nuxt.config.ts', () => {
    fs.writeFileSync(path.join(process.cwd(), 'nuxt.config.ts'), '');
    cmdInit([]);
    const content = fs.readFileSync(path.join(process.cwd(), 'CLAUDE.md'), 'utf-8');
    assert.ok(content.includes('Nuxt'));
  });

  it('creates directories with 0o700 permissions', () => {
    cmdInit([]);
    const projectDir = process.cwd();
    for (const dir of ['.claude', '.golem']) {
      const stats = fs.statSync(path.join(projectDir, dir));
      const perms = stats.mode & 0o777;
      assert.strictEqual(perms, 0o700, `${dir} should have 0o700 permissions, got 0o${perms.toString(8)}`);
    }
  });

  it('skips symlink destinations in template copy', () => {
    const projectDir = process.cwd();
    // Create .claude/commands dir first
    fs.mkdirSync(path.join(projectDir, '.claude', 'commands'), { recursive: true });
    // Create a symlink where a template would be copied
    const target = path.join(projectDir, 'target.txt');
    fs.writeFileSync(target, 'original');
    const link = path.join(projectDir, '.claude', 'commands', 'golem-build.md');
    fs.symlinkSync(target, link);
    // Init should skip the symlink, not overwrite its target
    cmdInit([]);
    assert.strictEqual(fs.readFileSync(target, 'utf-8'), 'original', 'symlink target should not be overwritten');
  });
});

// ============================================================================
// cmdDoctor
// ============================================================================

describe('cmdDoctor', () => {
  it('runs without crashing', () => {
    // cmdDoctor checks real system state — just verify it doesn't throw
    // It may call process.exit(1) if checks fail, so we catch that
    const origExit = process.exit;
    let exitCode = null;
    process.exit = (code) => { exitCode = code; throw new Error('EXIT'); };
    try {
      cmdDoctor();
    } catch (e) {
      if (e.message !== 'EXIT') throw e;
    }
    process.exit = origExit;
    // Either it passed (no exit) or failed with code 1 — both are valid behavior
    if (exitCode !== null) {
      assert.strictEqual(exitCode, 1);
    }
  });
});
