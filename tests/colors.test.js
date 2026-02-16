const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

describe('colors', () => {
  let colors;
  let originalNoColor;

  beforeEach(() => {
    originalNoColor = process.env.NO_COLOR;
    delete process.env.NO_COLOR;
    delete require.cache[require.resolve('../lib/colors.js')];
    colors = require('../lib/colors.js');
  });

  afterEach(() => {
    if (originalNoColor !== undefined) {
      process.env.NO_COLOR = originalNoColor;
    } else {
      delete process.env.NO_COLOR;
    }
  });

  it('exports color functions when NO_COLOR is not set', () => {
    assert.strictEqual(colors.GREEN, '\x1b[32m');
    assert.strictEqual(colors.YELLOW, '\x1b[33m');
    assert.strictEqual(colors.RED, '\x1b[31m');
    assert.strictEqual(colors.CYAN, '\x1b[36m');
    assert.strictEqual(colors.BOLD, '\x1b[1m');
    assert.strictEqual(colors.DIM, '\x1b[2m');
    assert.strictEqual(colors.NC, '\x1b[0m');
  });

  it('disables colors when NO_COLOR=1', () => {
    process.env.NO_COLOR = '1';
    delete require.cache[require.resolve('../lib/colors.js')];
    const colors = require('../lib/colors.js');

    assert.strictEqual(colors.GREEN, '');
    assert.strictEqual(colors.YELLOW, '');
    assert.strictEqual(colors.RED, '');
    assert.strictEqual(colors.CYAN, '');
    assert.strictEqual(colors.BOLD, '');
    assert.strictEqual(colors.DIM, '');
    assert.strictEqual(colors.NC, '');
  });

  it('disables colors when NO_COLOR is empty string', () => {
    process.env.NO_COLOR = '';
    delete require.cache[require.resolve('../lib/colors.js')];
    const colors = require('../lib/colors.js');

    assert.strictEqual(colors.GREEN, '');
  });

  it('disables colors when NO_COLOR=0 (treated as truthy string)', () => {
    process.env.NO_COLOR = '0';
    delete require.cache[require.resolve('../lib/colors.js')];
    const colors = require('../lib/colors.js');

    assert.strictEqual(colors.GREEN, '');
  });

  it('disables colors when NO_COLOR=false (treated as truthy string)', () => {
    process.env.NO_COLOR = 'false';
    delete require.cache[require.resolve('../lib/colors.js')];
    const colors = require('../lib/colors.js');

    assert.strictEqual(colors.GREEN, '');
  });

  it('provides log helper that uses GREEN prefix', () => {
    const output = colors.log('test message');
    assert.strictEqual(output, `${colors.GREEN}[golem]${colors.NC} test message`);
  });

  it('provides warn helper that uses YELLOW prefix', () => {
    const output = colors.warn('warning message');
    assert.strictEqual(output, `${colors.YELLOW}[golem]${colors.NC} warning message`);
  });

  it('provides heading helper that uses BOLD CYAN', () => {
    const output = colors.heading('Section Title');
    assert.strictEqual(output, `\n${colors.BOLD}${colors.CYAN}Section Title${colors.NC}`);
  });
});
