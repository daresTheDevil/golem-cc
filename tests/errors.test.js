const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('errors', () => {
  let errors;
  const HOME = os.homedir();

  it('sanitizes file paths to not leak outside HOME', () => {
    errors = require('../lib/errors.js');
    const sanitized = errors.sanitizePath('/etc/passwd');
    assert.strictEqual(sanitized, '/etc/passwd');

    const homeFile = errors.sanitizePath(path.join(HOME, '.golem', 'version'));
    assert.ok(homeFile.includes('~'), 'Should replace HOME with ~');
  });

  it('formats error with context', () => {
    errors = require('../lib/errors.js');
    const formatted = errors.formatError({
      message: 'Templates missing',
      context: {
        golemHomeExists: true,
        versionFileExists: false,
      },
      suggestion: 'Run: pnpm dlx golem-cc',
    });

    assert.ok(formatted.includes('Templates missing'));
    assert.ok(formatted.includes('Run: pnpm dlx golem-cc'));
  });

  it('includes diagnostic state in error messages', () => {
    errors = require('../lib/errors.js');
    const formatted = errors.formatError({
      message: 'Init failed',
      context: {
        golemHomeExists: false,
      },
      suggestion: 'Install golem first',
    });

    assert.ok(formatted.includes('golemHomeExists'));
    assert.ok(formatted.includes('false'));
  });

  it('auto-generates suggestion from diagnostics state', () => {
    errors = require('../lib/errors.js');
    const formatted = errors.formatError({
      message: 'Init failed',
      diagnostics: {
        golemHomeExists: false,
      },
    });

    // Should auto-suggest based on missing GOLEM_HOME
    assert.ok(formatted.includes('pnpm dlx golem-cc') || formatted.includes('Suggested fix'));
  });

  it('respects explicit suggestion over auto-generated', () => {
    errors = require('../lib/errors.js');
    const formatted = errors.formatError({
      message: 'Custom error',
      diagnostics: {
        golemHomeExists: false,
      },
      suggestion: 'Run custom command',
    });

    assert.ok(formatted.includes('Run custom command'));
  });
});
