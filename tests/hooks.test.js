const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');

// ============================================================================
// Hook tests — run the actual shell commands from settings.json PreToolUse hooks
// as subprocesses to verify they block/allow correctly.
//
// The hooks read JSON from stdin via jq and check .tool_input.command
// ============================================================================

// The destructive command blocker hook (extracted from user-scope/settings.json)
const DESTRUCTIVE_HOOK = `command -v jq >/dev/null 2>&1 || { echo 'BLOCKED: jq required for safety hooks. Install jq.' >&2; exit 2; }; jq -r '.tool_input.command // empty' | { IFS= read -r -d '' cmd || true; cmd_lower=$(printf '%s' "$cmd" | tr '[:upper:]' '[:lower:]' | tr '\\n' ' '); case "$cmd_lower" in *'rm -rf'*'/'*|*'rm -r '*'/'*|*'rm --recursive'*'/'*|*'rm -rf ~'*|*'rm -r ~'*|*'drop database'*|*'drop schema'*|*'drop table'*|*'truncate '*|*'> /dev/'*|*'mkfs'*|*'dd if'*) echo 'BLOCKED: Destructive command detected' >&2; exit 2;; *) exit 0;; esac; }`;

// The push blocker hook
const PUSH_HOOK = `command -v jq >/dev/null 2>&1 || { echo 'BLOCKED: jq required for safety hooks. Install jq.' >&2; exit 2; }; jq -r '.tool_input.command // empty' | { IFS= read -r -d '' cmd || true; cmd_lower=$(printf '%s' "$cmd" | tr '[:upper:]' '[:lower:]' | tr '\\n' ' '); case "$cmd_lower" in *'git push'*origin*main*|*'git push'*origin*master*|*'git push'*'--force'*|*'git push'*'-f '*) echo 'BLOCKED: Direct push to main/master or force push. Use feature branches.' >&2; exit 2;; *) exit 0;; esac; }`;

function runHook(hookCmd, toolCommand) {
  const input = JSON.stringify({ tool_input: { command: toolCommand } });
  const result = spawnSync('bash', ['-c', hookCmd], {
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
// jq requirement
// ============================================================================

describe('Hook jq requirement', () => {
  it('blocks (exit 2) when jq is not in PATH', () => {
    // Run a simplified version of the jq-check portion with a PATH that has bash builtins but not jq
    // We need bash itself to be findable, so we keep /usr/bin but remove jq's location
    const input = JSON.stringify({ tool_input: { command: 'ls' } });
    // Use a wrapper that unsets jq from PATH by only including /usr/bin (bash builtins)
    const hookWithBadPath = `export PATH=/usr/bin:/bin; command -v jq >/dev/null 2>&1 || { echo 'BLOCKED: jq required for safety hooks. Install jq.' >&2; exit 2; }; echo 'should not reach here'; exit 0`;
    const result = spawnSync('bash', ['-c', hookWithBadPath], {
      input,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
    });
    // On systems where jq IS in /usr/bin or /bin, this test verifies the pattern works.
    // If jq is found there, we skip the assertion (jq is always available on this system).
    const jqInBasePaths = spawnSync('bash', ['-c', 'export PATH=/usr/bin:/bin; command -v jq'], { stdio: 'pipe' });
    if (jqInBasePaths.status !== 0) {
      assert.strictEqual(result.status, 2, 'should exit 2 when jq missing');
      assert.ok(result.stderr.toString().includes('jq required'));
    } else {
      // jq is in /usr/bin or /bin — test the pattern with truly empty PATH via a subshell
      const result2 = spawnSync('/bin/bash', ['-c',
        'unset PATH; command -v jq >/dev/null 2>&1 || { echo "BLOCKED: jq required" >&2; exit 2; }; exit 0'
      ], { stdio: ['pipe', 'pipe', 'pipe'], timeout: 5000 });
      assert.strictEqual(result2.status, 2, 'should exit 2 when jq is not findable');
    }
  });
});
