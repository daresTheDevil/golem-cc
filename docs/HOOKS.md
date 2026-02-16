# Git Hooks Documentation

Golem installs security-focused git hooks to protect your codebase.

---

## Hook Architecture

### Execution Model

**When hooks fire:**
- `pre-commit` — Before commit is created (blocks if fails)
- `pre-push` — Before changes are pushed to remote (blocks if fails)

**What hooks receive:**
- Standard input: Git metadata (commit message, changed files, etc.)
- Environment: Git environment variables

**How hooks are installed:**
Golem configures hooks via `.claude/settings.json`:

```json
{
  "githooks": {
    "pre-commit": "~/.golem/hooks/block-destructive.sh && ~/.golem/hooks/security-scan.sh",
    "pre-push": "~/.golem/hooks/block-push-main.sh"
  }
}
```

Claude Code executes these hooks automatically via git's hook mechanism.

---

## Installed Hooks

### 1. block-destructive.sh

**Purpose:** Prevent accidental destructive operations.

**Triggers:** `pre-commit`

**What it blocks:**
- `git reset --hard`
- `git checkout .` (discards all changes)
- `git clean -fd` (deletes untracked files)
- `git branch -D` (force delete branch)
- Direct commits to main/master branch

**How it works:**
Parses commit metadata looking for destructive command patterns in commit message or hooks output.

**Exit codes:**
- `0` = Allow commit (no destructive operations detected)
- `1` = Block commit (destructive operation detected)
- `2` = Block with error (jq missing or other failure)

**Example:**
```bash
# This commit would be blocked
git commit -m "fix: reset database (ran git reset --hard)"

# Output:
# BLOCKED: Destructive operation detected in commit
# Found: git reset --hard
# Use --no-verify to bypass (emergency only)
```

**Bypass (emergency only):**
```bash
git commit --no-verify -m "emergency fix"
```

---

### 2. security-scan.sh

**Purpose:** Scan for secrets, credentials, and security issues before commit.

**Triggers:** `pre-commit`

**What it scans:**
- Hardcoded API keys (pattern: `api_key\s*=\s*["'][^"']+["']`)
- Hardcoded passwords (pattern: `password\s*=\s*["'][^"']+["']`)
- AWS credentials (pattern: `AKIA[0-9A-Z]{16}`)
- Private keys (pattern: `-----BEGIN.*PRIVATE KEY-----`)
- Database connection strings with embedded passwords
- JWT secrets in code

**What it ignores:**
- `.env.example` (example files are safe)
- `tests/` directory (test fixtures may have fake credentials)
- Comments (assumed to be documentation)

**Exit codes:**
- `0` = Allow commit (no secrets found)
- `1` = Block commit (secrets detected)
- `2` = Block with error (jq missing or scan failure)

**Example:**
```bash
# Add a file with hardcoded API key
echo 'const API_KEY = "sk_live_abc123";' > config.js
git add config.js
git commit -m "add config"

# Output:
# BLOCKED: Security scan found 1 issue(s)
# File: config.js
# Issue: Hardcoded API key detected
# Line: const API_KEY = "sk_live_abc123";
#
# Fix: Move to environment variable
# Use .env file: API_KEY=sk_live_abc123
# Access in code: process.env.API_KEY
```

**How to fix:**
```bash
# Move secret to .env
echo 'API_KEY=sk_live_abc123' >> .env

# Update code
echo 'const API_KEY = process.env.API_KEY;' > config.js

# Add .env to .gitignore
echo '.env' >> .gitignore

# Commit
git add .
git commit -m "add config (secret in .env)"
# ✔ Security scan passed
```

---

### 3. block-push-main.sh

**Purpose:** Prevent direct pushes to main/master branch (enforce PR workflow).

**Triggers:** `pre-push`

**What it blocks:**
- `git push origin main`
- `git push origin master`
- `git push` when current branch is main/master

**What it allows:**
- Pushes to feature branches
- `git push origin feature/my-branch`

**Exit codes:**
- `0` = Allow push (not pushing to main/master)
- `1` = Block push (pushing to main/master)
- `2` = Block with error (jq missing or check failure)

**Example:**
```bash
# On main branch
git checkout main
git commit -m "fix"
git push

# Output:
# BLOCKED: Direct push to main branch
# Use pull requests instead
# To push anyway: git push --no-verify (not recommended)
```

**Recommended workflow:**
```bash
# Create feature branch
git checkout -b feature/my-fix

# Make changes and commit
git commit -m "fix"

# Push feature branch (allowed)
git push origin feature/my-fix

# Create PR
gh pr create
```

**Emergency bypass:**
```bash
# If you MUST push to main (hotfix, etc.)
git push --no-verify origin main
```

---

## Hook Dependencies

All hooks require **jq** (JSON processor).

### Why jq?

Hooks parse git metadata (refs, file lists, etc.) which is often JSON.
Without jq, hooks cannot function and will BLOCK all commits/pushes.

### Install jq

```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq

# Fedora/RHEL
sudo dnf install jq

# Alpine Linux
apk add jq

# Windows (via Chocolatey)
choco install jq

# Verify
jq --version
```

### If jq is missing

Hooks will fail with:
```
BLOCKED: jq is required for git hooks
Install: brew install jq (macOS)
         sudo apt-get install jq (Ubuntu)
```

All commits/pushes will be blocked until jq is installed.

---

## Customizing Hooks

### Project-Level Overrides

Edit `.claude/settings.json` in your project:

```json
{
  "githooks": {
    "pre-commit": "~/.golem/hooks/security-scan.sh",
    "pre-push": "~/.golem/hooks/block-push-main.sh"
  }
}
```

**Examples:**

**Disable all hooks:**
```json
{
  "githooks": {}
}
```

**Add custom hook:**
```json
{
  "githooks": {
    "pre-commit": "~/.golem/hooks/security-scan.sh && ./scripts/lint.sh"
  }
}
```

**Replace security-scan with custom scanner:**
```json
{
  "githooks": {
    "pre-commit": "./scripts/my-security-scan.sh"
  }
}
```

### Global Overrides

Edit `~/.claude/settings.json` to override hooks for ALL projects:

```json
{
  "githooks": {
    "pre-commit": "~/.golem/hooks/security-scan.sh",
    "pre-push": ""
  }
}
```

This disables `pre-push` globally while keeping `pre-commit`.

---

## Writing Custom Hooks

### Hook Template

```bash
#!/bin/bash
# custom-hook.sh — Example custom hook

# Exit codes:
# 0 = allow
# 1 = block
# 2 = error

# Check if jq is installed
if ! command -v jq &> /dev/null; then
  echo "BLOCKED: jq is required"
  exit 2
fi

# Get staged files
STAGED_FILES=$(git diff --cached --name-only)

# Example: Block if package.json is changed
if echo "$STAGED_FILES" | grep -q "package.json"; then
  echo "BLOCKED: package.json modified"
  echo "Please update package-lock.json too"
  exit 1
fi

# Allow commit
exit 0
```

### Best Practices

1. **Always check for jq**
   ```bash
   if ! command -v jq &> /dev/null; then
     echo "BLOCKED: jq required"
     exit 2
   fi
   ```

2. **Use exit code 2 for errors**
   - `0` = allow
   - `1` = block (validation failed)
   - `2` = error (missing dependency, script failure)

3. **Provide clear error messages**
   ```bash
   echo "BLOCKED: <reason>"
   echo "Fix: <how to resolve>"
   echo "Bypass: git commit --no-verify (emergency only)"
   ```

4. **Make hooks fast**
   - Hooks run on EVERY commit/push
   - Target: <1 second execution time
   - Use caching if scanning large codebases

5. **Test hooks before deploying**
   ```bash
   # Test manually
   echo '{}' | ~/.golem/hooks/my-hook.sh
   echo $?  # Should be 0 (success)
   ```

---

## Bypass Hooks (Emergency Only)

### When to bypass

- Emergency hotfix (production down)
- Hook is broken (false positive)
- jq unavailable and can't install immediately

### How to bypass

**Single commit:**
```bash
git commit --no-verify -m "emergency fix"
```

**Single push:**
```bash
git push --no-verify origin main
```

**Disable hooks temporarily:**
```bash
# Edit .claude/settings.json
{
  "githooks": {}
}

# Commit
git commit -m "fix"

# Re-enable hooks
# (restore settings.json)
```

### Security Warning

⚠️ **Bypassing hooks disables security checks.**

- Secrets could be committed
- Destructive operations could succeed
- Direct pushes to main could bypass PR review

**Only bypass when absolutely necessary.** Fix the root cause ASAP.

---

## Troubleshooting

### Hook not executing

**Check:**
1. Is `.claude/settings.json` configured?
   ```bash
   cat .claude/settings.json | jq .githooks
   ```

2. Are hook files executable?
   ```bash
   ls -la ~/.golem/hooks/
   # Should show -rwxr-xr-x (755)
   ```

3. Does Claude Code have hook execution enabled?
   ```bash
   cat ~/.claude/settings.json | jq .allowHookExecution
   # Should be true or null (default true)
   ```

**Fix:**
```bash
# Make hooks executable
chmod 755 ~/.golem/hooks/*.sh

# Verify
golem doctor
```

---

### Hook blocks all commits

**Symptom:** Even valid commits are blocked.

**Diagnosis:**
```bash
# Run hook manually to see error
git diff --cached --name-only | ~/.golem/hooks/security-scan.sh
echo $?  # Exit code
```

**Common causes:**
1. **jq missing**
   ```
   BLOCKED: jq is required
   ```
   **Fix:** `brew install jq`

2. **Hook script has syntax error**
   ```bash
   # Check for errors
   bash -n ~/.golem/hooks/security-scan.sh
   ```

3. **Hook script not executable**
   ```bash
   chmod 755 ~/.golem/hooks/security-scan.sh
   ```

---

### False positive in security scan

**Example:**
```javascript
// This is a FAKE key for testing
const FAKE_KEY = "sk_test_abc123";
```

Hook blocks it even though it's a test fixture.

**Fix:**

**Option 1: Move to test directory**
```bash
mv config.js tests/fixtures/config.js
# security-scan.sh ignores tests/
```

**Option 2: Use .env.example**
```bash
echo 'FAKE_KEY=sk_test_abc123' > .env.example
# security-scan.sh ignores .env.example
```

**Option 3: Bypass this one commit**
```bash
git commit --no-verify -m "add test fixture"
```

**Option 4: Customize scan patterns**
Edit `~/.golem/hooks/security-scan.sh` to exclude your pattern.

---

## Hook Execution Order

When multiple hooks are configured:

```json
{
  "githooks": {
    "pre-commit": "hook1.sh && hook2.sh && hook3.sh"
  }
}
```

**Execution:**
1. `hook1.sh` runs
2. If `hook1.sh` exits 0, `hook2.sh` runs
3. If `hook2.sh` exits 0, `hook3.sh` runs
4. If ANY hook exits non-zero, commit is blocked

**Short-circuit:**
```bash
# If hook1 fails, hook2 and hook3 don't run
hook1.sh && hook2.sh && hook3.sh
```

**Run all regardless of failures (not recommended):**
```bash
# All hooks run, commit blocked if ANY failed
hook1.sh; hook2.sh; hook3.sh
```

---

## Comparison with Git's Native Hooks

| Feature | Golem Hooks | Git Native Hooks |
|---------|-------------|------------------|
| Location | `~/.golem/hooks/` | `.git/hooks/` |
| Shared | ✅ Yes (via settings.json) | ❌ No (per-repo) |
| Version Controlled | ✅ Yes | ❌ No (.git/ not in git) |
| Portable | ✅ Yes (works on all machines) | ❌ No (manual setup per clone) |
| Requires | Claude Code | Git |
| Customizable | ✅ Per-project + global | ✅ Per-repo only |

**Why Golem uses settings.json:**
- Hooks are version-controlled (part of project config)
- Same hooks on all developer machines (consistency)
- Global defaults + per-project overrides

---

## Summary

**Default Hooks:**
- `block-destructive.sh` — Prevents accidental data loss
- `security-scan.sh` — Blocks hardcoded secrets
- `block-push-main.sh` — Enforces PR workflow

**Dependencies:**
- Requires `jq` (JSON processor)

**Customization:**
- Global: `~/.claude/settings.json`
- Project: `.claude/settings.json`

**Bypass:**
- `git commit --no-verify` (emergency only)

**Best Practices:**
- Install jq before using golem
- Test hooks before deploying
- Never bypass for non-emergencies
- Keep hooks fast (<1 second)

---

**Document Version:** 1.0.0 (golem-cc v4.5.0)
**Last Updated:** 2026-02-16
