const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('diagnostics', () => {
  let diagnostics;
  let tempDir;
  const HOME = os.homedir();

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'golem-diag-test-'));
    delete require.cache[require.resolve('../lib/diagnostics.js')];
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('detects when GOLEM_HOME does not exist', () => {
    diagnostics = require('../lib/diagnostics.js');
    const state = diagnostics.detectState(path.join(tempDir, 'nonexistent'));

    assert.strictEqual(state.golemHomeExists, false);
  });

  it('detects when GOLEM_HOME exists', () => {
    diagnostics = require('../lib/diagnostics.js');
    const golemHome = path.join(tempDir, '.golem');
    fs.mkdirSync(golemHome);

    const state = diagnostics.detectState(golemHome);
    assert.strictEqual(state.golemHomeExists, true);
  });

  it('detects when version file exists', () => {
    diagnostics = require('../lib/diagnostics.js');
    const golemHome = path.join(tempDir, '.golem');
    fs.mkdirSync(golemHome);
    fs.writeFileSync(path.join(golemHome, 'version'), '4.0.0');

    const state = diagnostics.detectState(golemHome);
    assert.strictEqual(state.versionFileExists, true);
    assert.strictEqual(state.version, '4.0.0');
  });

  it('detects when version file is corrupted', () => {
    diagnostics = require('../lib/diagnostics.js');
    const golemHome = path.join(tempDir, '.golem');
    fs.mkdirSync(golemHome);
    fs.writeFileSync(path.join(golemHome, 'version'), '');

    const state = diagnostics.detectState(golemHome);
    assert.strictEqual(state.versionFileExists, true);
    assert.strictEqual(state.versionCorrupted, true);
  });

  it('detects when templates directory exists', () => {
    diagnostics = require('../lib/diagnostics.js');
    const golemHome = path.join(tempDir, '.golem');
    fs.mkdirSync(golemHome, { recursive: true });
    fs.mkdirSync(path.join(golemHome, 'templates'));

    const state = diagnostics.detectState(golemHome);
    assert.strictEqual(state.templatesExist, true);
  });

  it('detects partial installation', () => {
    diagnostics = require('../lib/diagnostics.js');
    const golemHome = path.join(tempDir, '.golem');
    fs.mkdirSync(golemHome);
    fs.writeFileSync(path.join(golemHome, 'version'), '4.0.0');
    // No templates directory

    const state = diagnostics.detectState(golemHome);
    assert.strictEqual(state.golemHomeExists, true);
    assert.strictEqual(state.versionFileExists, true);
    assert.strictEqual(state.templatesExist, false);
    assert.strictEqual(state.isPartialInstall, true);
  });

  it('suggests fix for missing GOLEM_HOME', () => {
    diagnostics = require('../lib/diagnostics.js');
    const suggestion = diagnostics.suggestFix({
      golemHomeExists: false,
    });

    assert.ok(suggestion.includes('pnpm dlx golem-cc'));
  });

  it('suggests fix for partial install', () => {
    diagnostics = require('../lib/diagnostics.js');
    const suggestion = diagnostics.suggestFix({
      golemHomeExists: true,
      versionFileExists: true,
      templatesExist: false,
      isPartialInstall: true,
    });

    assert.ok(suggestion.includes('repair') || suggestion.includes('reinstall'));
  });

  it('suggests fix for corrupted version file', () => {
    diagnostics = require('../lib/diagnostics.js');
    const suggestion = diagnostics.suggestFix({
      golemHomeExists: true,
      versionFileExists: true,
      versionCorrupted: true,
    });

    assert.ok(suggestion.includes('repair') || suggestion.includes('pnpm dlx golem-cc'));
  });
});
