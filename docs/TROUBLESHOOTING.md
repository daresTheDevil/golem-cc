# Troubleshooting Guide

This guide covers common failure modes, their root causes, and how to fix them.

**Format:** Symptom → Diagnosis → Root Cause → Fix → Prevention

---

## Installation Issues

### Symptom: `pnpm dlx golem-cc` hangs or fails

**Diagnosis:**
```bash
# Check npm registry connectivity
npm ping

# Check pnpm version
pnpm --version
```

**Root Cause:**
- Network connectivity issues
- npm registry down or unreachable
- pnpm not installed or outdated

**Fix:**
```bash
# Update pnpm
npm install -g pnpm@latest

# Retry with npx if pnpm fails
npx golem-cc

# Or install globally
npm install -g golem-cc
golem-cc
```

**Prevention:**
- Keep pnpm updated (`pnpm self-update`)
- Use npx as fallback

---

### Symptom: Installation succeeds but `golem` command not found

**Diagnosis:**
```bash
# Check if golem binary exists
ls -la ~/.golem/bin/golem

# Check PATH
echo $PATH | grep -o '.golem/bin'

# Check shell RC file
grep 'golem' ~/.zshrc ~/.bashrc
```

**Root Cause:**
- PATH not configured
- Terminal not restarted after install
- Wrong shell RC file modified (e.g., using bash but installer edited .zshrc)

**Fix:**
```bash
# Add to PATH manually
export PATH="$PATH:$HOME/.golem/bin"

# Make permanent (zsh)
echo 'export PATH="$PATH:$HOME/.golem/bin"' >> ~/.zshrc
source ~/.zshrc

# Make permanent (bash)
echo 'export PATH="$PATH:$HOME/.golem/bin"' >> ~/.bashrc
source ~/.bashrc
```

**Prevention:**
- Restart terminal after install
- Verify with: `which golem`

---

### Symptom: Integrity check failed during install

**Diagnosis:**
Look for error message:
```
Error: Integrity check failed: <file>
Context:
  file: <path>
  expected: <hash>
```

**Root Cause:**
- File corrupted during download (network issue)
- npm cache corrupted
- Malicious tampering (rare)

**Fix:**
```bash
# Clear npm cache
npm cache clean --force

# Retry install
pnpm dlx golem-cc@latest

# If still fails, report as security issue
```

**Prevention:**
- Stable network connection during install
- Use official npm registry only

---

## Missing Templates

### Symptom: `golem init` fails with "templates missing"

**Diagnosis:**
```bash
# Check if templates directory exists
ls -la ~/.golem/templates/

# Run doctor
golem doctor
```

**Root Cause:**
- Partial installation (interrupted install)
- Manual deletion of templates directory
- Disk space issue during install

**Fix:**
```bash
# Option 1: Repair
golem repair --force

# Option 2: Reinstall
golem uninstall --confirm
pnpm dlx golem-cc
```

**Prevention:**
- Don't manually delete ~/.golem/ directories
- Ensure sufficient disk space before install (check: `df -h`)

---

## jq Missing

### Symptom: All git hooks block with "jq not found"

**Diagnosis:**
```bash
# Check if jq is installed
which jq

# Try to run a hook manually
~/.golem/hooks/security-scan.sh
```

**Root Cause:**
- jq not installed (hooks require jq for JSON parsing)

**Fix:**
```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq

# Fedora/RHEL
sudo dnf install jq

# Alpine Linux
apk add jq

# Verify
jq --version
```

**Prevention:**
- Run `golem doctor` after install to check dependencies

---

## PATH Not Configured

### Symptom: `golem` works in new terminals but not current one

**Diagnosis:**
```bash
# Check current PATH
echo $PATH | grep golem

# Check if added to RC file
grep golem ~/.zshrc ~/.bashrc
```

**Root Cause:**
- PATH added to shell RC file, but current terminal session not refreshed

**Fix:**
```bash
# Reload shell config (zsh)
source ~/.zshrc

# Reload shell config (bash)
source ~/.bashrc

# Or just restart terminal
```

**Prevention:**
- Always restart terminal or source RC file after install

---

## Partial Install

### Symptom: `golem doctor` shows multiple missing components

**Diagnosis:**
```bash
golem doctor

# Typical output for partial install:
#   FAIL  Templates
#   FAIL  Hooks
#   FAIL  ~/.claude/CLAUDE.md
```

**Root Cause:**
- Install interrupted (Ctrl+C during install)
- Disk space ran out mid-install
- Permission errors during install

**Fix:**
```bash
# Check available disk space
df -h

# Check permissions
ls -la ~/.golem ~/.claude

# Repair
golem repair --force

# If repair fails, full reinstall
golem uninstall --confirm
pnpm dlx golem-cc
```

**Prevention:**
- Ensure sufficient disk space before install
- Don't interrupt install process

---

## Corrupted Version File

### Symptom: `golem` commands fail with "version file corrupted"

**Diagnosis:**
```bash
# Check version file
cat ~/.golem/version

# Empty or invalid = corrupted
```

**Root Cause:**
- Manual editing of version file
- Disk corruption
- Partial write during install

**Fix:**
```bash
# Repair will fix version file
golem repair --force

# Or manually restore (if you know version)
echo "4.5.0" > ~/.golem/version
```

**Prevention:**
- Never manually edit ~/.golem/version
- Use `golem version` to check version

---

## Upgrade Failures

### Symptom: Upgrade from old version fails or leaves system broken

**Diagnosis:**
```bash
# Check current version
golem version

# Check for backup files
ls -la ~/.claude/*.pre-golem

# Run doctor
golem doctor
```

**Root Cause:**
- Breaking changes between versions
- User modified config files (golem skips overwriting)

**Fix:**
```bash
# Check what was skipped
ls -la ~/.claude/*.new

# Merge manually if needed
diff ~/.claude/settings.json ~/.claude/settings.json.new

# Or force clean install
golem uninstall --confirm
pnpm dlx golem-cc@latest
```

**Prevention:**
- Read CHANGELOG before upgrading
- Backup custom settings before upgrade
- Test in non-production project first

---

## Permission Denied Errors

### Symptom: Install fails with EACCES or permission errors

**Diagnosis:**
```bash
# Check ownership of home directory
ls -la ~/ | grep -E 'golem|claude'

# Check if sudo was used (BAD)
ls -la ~/.golem/ | head -5
```

**Root Cause:**
- ~/.golem/ or ~/.claude/ owned by root (installed with sudo)
- Filesystem permissions issue

**Fix:**
```bash
# Fix ownership (replace USER with your username)
sudo chown -R $USER:$USER ~/.golem ~/.claude ~/.mcp.json

# Retry install
pnpm dlx golem-cc
```

**Prevention:**
- NEVER use sudo with golem-cc
- golem installs to user home directory only

---

## Git Hooks Blocking All Commits

### Symptom: Every commit blocked with "BLOCKED: failed X checks"

**Diagnosis:**
```bash
# Check hook execution
~/.golem/hooks/security-scan.sh

# Check if hooks are enabled
cat ~/.claude/settings.json | grep githooks
```

**Root Cause:**
- jq missing (see "jq Missing" section above)
- Hook script has wrong permissions
- Hook script contains errors

**Fix:**
```bash
# Check jq
which jq || brew install jq

# Check hook permissions
ls -la ~/.golem/hooks/
chmod 755 ~/.golem/hooks/*.sh

# Test hook manually
echo '{}' | ~/.golem/hooks/security-scan.sh

# Emergency bypass (NOT RECOMMENDED)
git commit --no-verify
```

**Prevention:**
- Install jq before using golem
- Don't manually edit hook scripts
- Run `golem doctor` regularly

---

## Commands Not Found After Uninstall

### Symptom: After `golem uninstall`, old commands still show in PATH

**Diagnosis:**
```bash
# Check if ~/.golem still exists
ls -la ~/.golem

# Check PATH
echo $PATH | grep golem
```

**Root Cause:**
- Uninstall didn't remove PATH entry from shell RC
- Multiple PATH entries exist
- Terminal not restarted

**Fix:**
```bash
# Remove from RC file manually
# Edit ~/.zshrc or ~/.bashrc and remove line:
# export PATH="$PATH:$HOME/.golem/bin"

# Reload shell
source ~/.zshrc  # or ~/.bashrc

# Restart terminal
```

**Prevention:**
- Restart terminal after uninstall
- Verify with: `which golem` (should return nothing)

---

## State File Corrupted

### Symptom: `golem status` fails with "state.json is corrupted"

**Diagnosis:**
```bash
# Check state file
cat .golem/state.json

# Validate JSON
cat .golem/state.json | jq .
```

**Root Cause:**
- Manual editing introduced syntax error
- Partial write (editor crash, Ctrl+C)
- Disk corruption

**Fix:**
```bash
# Reset state
golem reset

# Or manually fix JSON syntax
# Open .golem/state.json and fix syntax errors
```

**Prevention:**
- Don't manually edit .golem/state.json
- Use golem commands to modify state
- Use JSON-aware editor if manual edit needed

---

## Out of Disk Space During Install

### Symptom: Install fails with ENOSPC error

**Diagnosis:**
```bash
# Check available space
df -h

# Check install size (estimate)
du -sh ~/.golem ~/.claude ~/.mcp.json
```

**Root Cause:**
- Disk full or nearly full

**Fix:**
```bash
# Free up space
# Remove old logs, caches, etc.

# Check space again
df -h

# Retry install
pnpm dlx golem-cc
```

**Prevention:**
- Monitor disk space: `df -h`
- Clean up regularly
- Install requires ~50MB (plus npm cache)

---

## Emergency Recovery

### Symptom: Everything is broken, nothing works

**Diagnosis:**
```bash
# Check if GOLEM_HOME exists
ls -la ~/.golem

# Check if installer works
which pnpm || which npx
```

**Root Cause:**
- Catastrophic failure
- Multiple issues compounding
- Unknown corruption

**Fix:**
```bash
# Nuclear option: full clean reinstall

# 1. Backup any custom settings
cp ~/.claude/settings.local.json ~/golem-backup.json 2>/dev/null

# 2. Full uninstall
golem uninstall --confirm 2>/dev/null || true
rm -rf ~/.golem
rm -rf ~/.claude
rm ~/.mcp.json 2>/dev/null

# 3. Remove PATH entry manually
# Edit ~/.zshrc or ~/.bashrc, remove golem line

# 4. Restart terminal

# 5. Fresh install
pnpm dlx golem-cc@latest

# 6. Restore custom settings if needed
# Merge ~/golem-backup.json into ~/.claude/settings.local.json
```

**Prevention:**
- Regular backups of custom settings
- Don't manually edit core files
- Use version control for .claude/ in projects

---

## Getting Help

If none of these solutions work:

1. **Run diagnostics**
   ```bash
   golem doctor
   ```

2. **Check logs**
   ```bash
   golem log
   ```

3. **Report issue**
   - GitHub: https://github.com/daresTheDevil/golem-cc/issues
   - Include: `golem doctor` output, OS version, Node version, error messages

4. **Discord/Slack** (if available)
   - Community support channels

---

**Document Version:** 1.0.0 (golem-cc v4.5.0)
**Last Updated:** 2026-02-15
