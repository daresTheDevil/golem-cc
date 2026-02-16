const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const { fileHash, decideAction, smartCopy, copyDir, cleanCommentKeys, writeCleanJson, ensureDir } = require('../bin/golem-cc');

// Helper: create a temp directory for each test
function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'golem-test-'));
}

function rmTmpDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ============================================================================
// cleanCommentKeys
// ============================================================================

describe('cleanCommentKeys', () => {
  it('strips //-prefixed keys from objects', () => {
    const result = cleanCommentKeys({ '// comment': 'val', name: 'golem' });
    assert.deepStrictEqual(result, { name: 'golem' });
  });

  it('preserves non-comment keys', () => {
    const input = { a: 1, b: 2, c: 3 };
    assert.deepStrictEqual(cleanCommentKeys(input), input);
  });

  it('handles nested objects', () => {
    const input = {
      '// top': '',
      env: {
        '// note': 'ignore',
        PATH: '/usr/bin',
      },
    };
    assert.deepStrictEqual(cleanCommentKeys(input), {
      env: { PATH: '/usr/bin' },
    });
  });

  it('handles arrays (passes through elements)', () => {
    const input = [{ '// x': 1, a: 2 }, { b: 3 }];
    assert.deepStrictEqual(cleanCommentKeys(input), [{ a: 2 }, { b: 3 }]);
  });

  it('passes through primitives unchanged', () => {
    assert.strictEqual(cleanCommentKeys('hello'), 'hello');
    assert.strictEqual(cleanCommentKeys(42), 42);
    assert.strictEqual(cleanCommentKeys(null), null);
    assert.strictEqual(cleanCommentKeys(true), true);
  });
});

// ============================================================================
// fileHash
// ============================================================================

describe('fileHash', () => {
  let tmp;
  beforeEach(() => { tmp = makeTmpDir(); });
  afterEach(() => { rmTmpDir(tmp); });

  it('returns SHA-256 hex for existing file', () => {
    const f = path.join(tmp, 'test.txt');
    fs.writeFileSync(f, 'hello');
    const expected = crypto.createHash('sha256').update(Buffer.from('hello')).digest('hex');
    assert.strictEqual(fileHash(f), expected);
  });

  it('returns null for nonexistent file', () => {
    assert.strictEqual(fileHash(path.join(tmp, 'nope.txt')), null);
  });
});

// ============================================================================
// decideAction
// ============================================================================

describe('decideAction', () => {
  it('returns install when dest does not exist', () => {
    assert.strictEqual(decideAction('abc', null, null), 'install');
  });

  it('returns unchanged when hashes match', () => {
    assert.strictEqual(decideAction('abc', 'abc', null), 'unchanged');
  });

  it('returns update when dest matches backup', () => {
    assert.strictEqual(decideAction('new', 'old', 'old'), 'update');
  });

  it('returns skip when user has modified (backup exists, differs from dest)', () => {
    assert.strictEqual(decideAction('new', 'user-modified', 'original'), 'skip');
  });

  it('returns backup-and-update when no backup exists and files differ', () => {
    assert.strictEqual(decideAction('new', 'existing', null), 'backup-and-update');
  });
});

// ============================================================================
// smartCopy
// ============================================================================

describe('smartCopy', () => {
  let tmp;
  beforeEach(() => { tmp = makeTmpDir(); });
  afterEach(() => { rmTmpDir(tmp); });

  it('installs new file when dest does not exist', () => {
    const src = path.join(tmp, 'src.txt');
    const dest = path.join(tmp, 'dest.txt');
    fs.writeFileSync(src, 'content');
    const result = smartCopy(src, dest);
    assert.strictEqual(result, 'installed');
    assert.strictEqual(fs.readFileSync(dest, 'utf-8'), 'content');
  });

  it('returns unchanged when files are identical', () => {
    const src = path.join(tmp, 'src.txt');
    const dest = path.join(tmp, 'dest.txt');
    fs.writeFileSync(src, 'same');
    fs.writeFileSync(dest, 'same');
    assert.strictEqual(smartCopy(src, dest), 'unchanged');
  });

  it('updates when dest matches backup (user has not modified)', () => {
    const src = path.join(tmp, 'src.txt');
    const dest = path.join(tmp, 'dest.txt');
    const backup = dest + '.pre-golem';
    fs.writeFileSync(src, 'new version');
    fs.writeFileSync(dest, 'old version');
    fs.writeFileSync(backup, 'old version');
    assert.strictEqual(smartCopy(src, dest), 'updated');
    assert.strictEqual(fs.readFileSync(dest, 'utf-8'), 'new version');
  });

  it('skips when user has modified (writes .new file)', () => {
    const src = path.join(tmp, 'src.txt');
    const dest = path.join(tmp, 'dest.txt');
    const backup = dest + '.pre-golem';
    fs.writeFileSync(src, 'new version');
    fs.writeFileSync(dest, 'user modified');
    fs.writeFileSync(backup, 'original backup');
    assert.strictEqual(smartCopy(src, dest), 'skipped');
    assert.strictEqual(fs.readFileSync(dest, 'utf-8'), 'user modified');
    assert.strictEqual(fs.readFileSync(dest + '.new', 'utf-8'), 'new version');
  });

  it('creates backup on first overwrite of existing different file', () => {
    const src = path.join(tmp, 'src.txt');
    const dest = path.join(tmp, 'dest.txt');
    fs.writeFileSync(src, 'new');
    fs.writeFileSync(dest, 'existing');
    assert.strictEqual(smartCopy(src, dest), 'updated');
    assert.strictEqual(fs.readFileSync(dest + '.pre-golem', 'utf-8'), 'existing');
    assert.strictEqual(fs.readFileSync(dest, 'utf-8'), 'new');
  });

  it('blocks symlink destinations', () => {
    const src = path.join(tmp, 'src.txt');
    const target = path.join(tmp, 'target.txt');
    const link = path.join(tmp, 'link.txt');
    fs.writeFileSync(src, 'content');
    fs.writeFileSync(target, 'target');
    fs.symlinkSync(target, link);
    assert.strictEqual(smartCopy(src, link), 'blocked');
    assert.strictEqual(fs.readFileSync(target, 'utf-8'), 'target');
  });
});

// ============================================================================
// copyDir
// ============================================================================

describe('copyDir', () => {
  let tmp;
  beforeEach(() => { tmp = makeTmpDir(); });
  afterEach(() => { rmTmpDir(tmp); });

  it('copies all files from src to dest', () => {
    const srcDir = path.join(tmp, 'src');
    const destDir = path.join(tmp, 'dest');
    fs.mkdirSync(srcDir);
    fs.writeFileSync(path.join(srcDir, 'a.txt'), 'aaa');
    fs.writeFileSync(path.join(srcDir, 'b.txt'), 'bbb');
    copyDir(srcDir, destDir);
    assert.strictEqual(fs.readFileSync(path.join(destDir, 'a.txt'), 'utf-8'), 'aaa');
    assert.strictEqual(fs.readFileSync(path.join(destDir, 'b.txt'), 'utf-8'), 'bbb');
  });

  it('skips symlinks', () => {
    const srcDir = path.join(tmp, 'src');
    const destDir = path.join(tmp, 'dest');
    fs.mkdirSync(srcDir);
    fs.writeFileSync(path.join(srcDir, 'real.txt'), 'real');
    fs.symlinkSync(path.join(srcDir, 'real.txt'), path.join(srcDir, 'link.txt'));
    copyDir(srcDir, destDir);
    assert.ok(fs.existsSync(path.join(destDir, 'real.txt')));
    assert.ok(!fs.existsSync(path.join(destDir, 'link.txt')));
  });

  it('handles missing src dir gracefully', () => {
    const destDir = path.join(tmp, 'dest');
    // Should not throw
    copyDir(path.join(tmp, 'nonexistent'), destDir);
  });
});

// ============================================================================
// writeCleanJson
// ============================================================================

describe('writeCleanJson', () => {
  let tmp;
  beforeEach(() => { tmp = makeTmpDir(); });
  afterEach(() => { rmTmpDir(tmp); });

  it('strips comment keys and writes clean JSON', () => {
    const src = path.join(tmp, 'src.json');
    const dest = path.join(tmp, 'dest.json');
    fs.writeFileSync(src, JSON.stringify({ '// comment': '', name: 'golem' }));
    writeCleanJson(src, dest);
    const result = JSON.parse(fs.readFileSync(dest, 'utf-8'));
    assert.deepStrictEqual(result, { name: 'golem' });
    assert.ok(!('// comment' in result));
  });

  it('resolves ${HOME} and $HOME in output', () => {
    const src = path.join(tmp, 'src.json');
    const dest = path.join(tmp, 'dest.json');
    fs.writeFileSync(src, JSON.stringify({ path1: '${HOME}/.golem', path2: '$HOME/.claude' }));
    writeCleanJson(src, dest);
    const content = fs.readFileSync(dest, 'utf-8');
    assert.ok(!content.includes('${HOME}'), 'should resolve ${HOME}');
    assert.ok(!content.includes('$HOME'), 'should resolve $HOME');
    assert.ok(content.includes(os.homedir()));
  });

  it('installs new file when dest does not exist', () => {
    const src = path.join(tmp, 'src.json');
    const dest = path.join(tmp, 'dest.json');
    fs.writeFileSync(src, '{"a":1}');
    writeCleanJson(src, dest);
    assert.ok(fs.existsSync(dest));
  });

  it('skips when content is unchanged', () => {
    const src = path.join(tmp, 'src.json');
    const dest = path.join(tmp, 'dest.json');
    fs.writeFileSync(src, '{"a":1}');
    writeCleanJson(src, dest);
    const mtime1 = fs.statSync(dest).mtimeMs;
    // Small delay to detect mtime change
    writeCleanJson(src, dest);
    // The file content should be identical — function should short-circuit
    const content = fs.readFileSync(dest, 'utf-8');
    assert.deepStrictEqual(JSON.parse(content), { a: 1 });
  });

  it('updates when dest matches backup (user has not modified)', () => {
    const src = path.join(tmp, 'src.json');
    const dest = path.join(tmp, 'dest.json');
    const backup = dest + '.pre-golem';
    // Old version in dest and backup
    const oldContent = JSON.stringify({ a: 1 }, null, 2);
    fs.writeFileSync(dest, oldContent);
    fs.writeFileSync(backup, oldContent);
    // New version in src
    fs.writeFileSync(src, JSON.stringify({ a: 2 }));
    writeCleanJson(src, dest);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(dest, 'utf-8')), { a: 2 });
  });

  it('writes .new when user has modified', () => {
    const src = path.join(tmp, 'src.json');
    const dest = path.join(tmp, 'dest.json');
    const backup = dest + '.pre-golem';
    fs.writeFileSync(backup, JSON.stringify({ original: true }, null, 2));
    fs.writeFileSync(dest, JSON.stringify({ user_modified: true }, null, 2));
    fs.writeFileSync(src, JSON.stringify({ new_version: true }));
    writeCleanJson(src, dest);
    assert.ok(fs.existsSync(dest + '.new'));
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(dest, 'utf-8')), { user_modified: true });
  });

  it('creates backup on first overwrite of existing different file', () => {
    const src = path.join(tmp, 'src.json');
    const dest = path.join(tmp, 'dest.json');
    fs.writeFileSync(dest, JSON.stringify({ existing: true }, null, 2));
    fs.writeFileSync(src, JSON.stringify({ new: true }));
    writeCleanJson(src, dest);
    assert.ok(fs.existsSync(dest + '.pre-golem'));
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(dest + '.pre-golem', 'utf-8')), { existing: true });
  });

  it('blocks symlink destinations', () => {
    const src = path.join(tmp, 'src.json');
    const target = path.join(tmp, 'target.json');
    const link = path.join(tmp, 'link.json');
    fs.writeFileSync(src, '{"new": true}');
    fs.writeFileSync(target, '{"original": true}');
    fs.symlinkSync(target, link);
    const result = writeCleanJson(src, link);
    assert.strictEqual(result, 'blocked');
    assert.strictEqual(fs.readFileSync(target, 'utf-8'), '{"original": true}');
  });
});
