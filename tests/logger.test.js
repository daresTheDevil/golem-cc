// tests/logger.test.js — Test logger with quiet mode support
const test = require('node:test');
const assert = require('node:assert/strict');

test('logger module', async (t) => {

  await t.test('exports log, heading, warn functions', () => {
    // Load without QUIET env var
    delete process.env.QUIET;
    const logger = require('../lib/logger.js');

    assert.strictEqual(typeof logger.log, 'function', 'should export log function');
    assert.strictEqual(typeof logger.heading, 'function', 'should export heading function');
    assert.strictEqual(typeof logger.warn, 'function', 'should export warn function');
  });

  await t.test('log outputs in normal mode', () => {
    delete process.env.QUIET;
    delete require.cache[require.resolve('../lib/logger.js')];
    const logger = require('../lib/logger.js');

    // Capture console.log
    const originalLog = console.log;
    let captured = [];
    console.log = (...args) => captured.push(args.join(' '));

    logger.log('test message');

    console.log = originalLog;

    assert.strictEqual(captured.length, 1, 'should call console.log once');
    assert.ok(captured[0].includes('test message'), 'should include message');
  });

  await t.test('log is silent in quiet mode (QUIET=1)', () => {
    process.env.QUIET = '1';
    delete require.cache[require.resolve('../lib/logger.js')];
    const logger = require('../lib/logger.js');

    const originalLog = console.log;
    let captured = [];
    console.log = (...args) => captured.push(args.join(' '));

    logger.log('test message');

    console.log = originalLog;
    delete process.env.QUIET;

    assert.strictEqual(captured.length, 0, 'should not call console.log in quiet mode');
  });

  await t.test('warn still outputs in quiet mode (errors are critical)', () => {
    process.env.QUIET = '1';
    delete require.cache[require.resolve('../lib/logger.js')];
    const logger = require('../lib/logger.js');

    const originalLog = console.log;
    let captured = [];
    console.log = (...args) => captured.push(args.join(' '));

    logger.warn('warning message');

    console.log = originalLog;
    delete process.env.QUIET;

    assert.strictEqual(captured.length, 1, 'should still output warnings in quiet mode');
    assert.ok(captured[0].includes('warning message'), 'should include warning');
  });

  await t.test('heading is silent in quiet mode', () => {
    process.env.QUIET = '1';
    delete require.cache[require.resolve('../lib/logger.js')];
    const logger = require('../lib/logger.js');

    const originalLog = console.log;
    let captured = [];
    console.log = (...args) => captured.push(args.join(' '));

    logger.heading('Section Title');

    console.log = originalLog;
    delete process.env.QUIET;

    assert.strictEqual(captured.length, 0, 'should not output headings in quiet mode');
  });

  await t.test('QUIET=true also enables quiet mode', () => {
    process.env.QUIET = 'true';
    delete require.cache[require.resolve('../lib/logger.js')];
    const logger = require('../lib/logger.js');

    const originalLog = console.log;
    let captured = [];
    console.log = (...args) => captured.push(args.join(' '));

    logger.log('test');

    console.log = originalLog;
    delete process.env.QUIET;

    assert.strictEqual(captured.length, 0, 'QUIET=true should enable quiet mode');
  });

  await t.test('empty QUIET= enables quiet mode', () => {
    process.env.QUIET = '';
    delete require.cache[require.resolve('../lib/logger.js')];
    const logger = require('../lib/logger.js');

    const originalLog = console.log;
    let captured = [];
    console.log = (...args) => captured.push(args.join(' '));

    logger.log('test');

    console.log = originalLog;
    delete process.env.QUIET;

    assert.strictEqual(captured.length, 0, 'QUIET= (empty) should enable quiet mode');
  });

});
