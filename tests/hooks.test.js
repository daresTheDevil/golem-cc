const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const path = require('path');

// ============================================================================
// Hook tests — run the actual .sh hook scripts as subprocesses
// to verify they block/allow correctly.
//
// The hooks read JSON from stdin via jq and check .tool_input.command
// ============================================================================

const HOOKS_DIR = path.join(__dirname, '..', 'hooks');
const DESTRUCTIVE_HOOK = path.join(HOOKS_DIR, 'block-destructive.sh');
const PUSH_HOOK = path.join(HOOKS_DIR, 'block-push-main.sh');

function runHook(hookPath, toolCommand) {
  const input = JSON.stringify({ tool_input: { command: toolCommand } });
  const result = spawnSync('bash', [hookPath], {
    input,
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 5000,
  });
  return {
    status: result.status,
    stdout: result.stdout?.toString() || '',
    stderr: result.stderr?.toString() || '',
  };
}

// Check jq is available — skip hook tests if not
function jqAvailable() {
  const r = spawnSync('which', ['jq'], { stdio: 'pipe' });
  return r.status === 0;
}

// ============================================================================
// Destructive command blocker
// ============================================================================

describe('Destructive command blocker hook', { skip: !jqAvailable() && 'jq not installed' }, () => {
  it('blocks rm -rf /', () => {
    const r = runHook(DESTRUCTIVE_HOOK, 'rm -rf /');
    assert.strictEqual(r.status, 2);
    assert.ok(r.stderr.includes('BLOCKED'));
  });

  it('blocks rm -r /home', () => {
    const r = runHook(DESTRUCTIVE_HOOK, 'rm -r /home/user');
    assert.strictEqual(r.status, 2);
  });

  it('blocks rm --recursive', () => {
    const r = runHook(DESTRUCTIVE_HOOK, 'rm --recursive /var/data');
    assert.strictEqual(r.status, 2);
  });

  it('blocks drop database', () => {
    const r = runHook(DESTRUCTIVE_HOOK, 'psql -c "DROP DATABASE production"');
    assert.strictEqual(r.status, 2);
  });

  it('blocks truncate table', () => {
    const r = runHook(DESTRUCTIVE_HOOK, 'mysql -e "TRUNCATE players"');
    assert.strictEqual(r.status, 2);
  });

  it('blocks DROP TABLE (case insensitive)', () => {
    const r = runHook(DESTRUCTIVE_HOOK, 'psql -c "DROP TABLE users"');
    assert.strictEqual(r.status, 2);
  });

  it('blocks dd if=', () => {
    const r = runHook(DESTRUCTIVE_HOOK, 'dd if=/dev/zero of=/dev/sda');
    assert.strictEqual(r.status, 2);
  });

  it('blocks mkfs', () => {
    const r = runHook(DESTRUCTIVE_HOOK, 'mkfs.ext4 /dev/sda1');
    assert.strictEqual(r.status, 2);
  });

  it('allows safe commands like ls', () => {
    const r = runHook(DESTRUCTIVE_HOOK, 'ls -la');
    assert.strictEqual(r.status, 0);
  });

  it('allows safe commands like git status', () => {
    const r = runHook(DESTRUCTIVE_HOOK, 'git status');
    assert.strictEqual(r.status, 0);
  });

  it('allows npm install', () => {
    const r = runHook(DESTRUCTIVE_HOOK, 'npm install express');
    assert.strictEqual(r.status, 0);
  });
});

// ============================================================================
// Push blocker
// ============================================================================

describe('Push blocker hook', { skip: !jqAvailable() && 'jq not installed' }, () => {
  it('blocks git push origin main', () => {
    const r = runHook(PUSH_HOOK, 'git push origin main');
    assert.strictEqual(r.status, 2);
    assert.ok(r.stderr.includes('BLOCKED'));
  });

  it('blocks git push origin master', () => {
    const r = runHook(PUSH_HOOK, 'git push origin master');
    assert.strictEqual(r.status, 2);
  });

  it('blocks git push --force', () => {
    const r = runHook(PUSH_HOOK, 'git push --force origin feature');
    assert.strictEqual(r.status, 2);
  });

  it('blocks git push -f', () => {
    const r = runHook(PUSH_HOOK, 'git push -f origin feature');
    assert.strictEqual(r.status, 2);
  });

  it('allows git push origin feature-branch', () => {
    const r = runHook(PUSH_HOOK, 'git push origin feature-branch');
    assert.strictEqual(r.status, 0);
  });

  it('allows git push origin develop', () => {
    const r = runHook(PUSH_HOOK, 'git push origin develop');
    assert.strictEqual(r.status, 0);
  });
});

// ============================================================================
// jq requirement — hooks must block (exit 2) when jq is missing
// ============================================================================

describe('Hook jq requirement', () => {
  it('block-destructive.sh exits 2 when jq is not in PATH', () => {
    const input = JSON.stringify({ tool_input: { command: 'ls' } });
    // Run the hook with PATH stripped to exclude jq
    const result = spawnSync('/bin/bash', [DESTRUCTIVE_HOOK], {
      input,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
      env: { PATH: '/nonexistent' },
    });
    assert.strictEqual(result.status, 2, 'should exit 2 when jq missing');
    assert.ok(result.stderr.toString().includes('jq required'));
  });

  it('block-push-main.sh exits 2 when jq is not in PATH', () => {
    const input = JSON.stringify({ tool_input: { command: 'ls' } });
    const result = spawnSync('/bin/bash', [PUSH_HOOK], {
      input,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
      env: { PATH: '/nonexistent' },
    });
    assert.strictEqual(result.status, 2, 'should exit 2 when jq missing');
    assert.ok(result.stderr.toString().includes('jq required'));
  });
});
