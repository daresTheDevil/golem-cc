# Golem-CC Remediation Plan

**Generated:** 2026-02-15
**Source:** 8-agent comprehensive audit (security, quality, UX, vision)
**Priority:** Fix in order. Each tier must be clean before moving to the next.

---

## TIER 1 — HULL BREACHES (Do these first, no excuses)

These are the findings that could cause real damage, break user trust, or
prevent the tool from shipping. Each one has the exact code to change.

---

### 1.1 Command injection in `hasCommand()`

**File:** `bin/golem:62-67`
**Problem:** `execSync(\`command -v ${cmd}\`)` — string interpolation into shell.
**Current code:**
```javascript
function hasCommand(cmd) {
  try {
    execSync(`command -v ${cmd}`, { stdio: 'pipe' });
    return true;
  } catch { return false; }
}
```

**Fix:** Validate input AND use spawnSync:
```javascript
function hasCommand(cmd) {
  if (!/^[a-zA-Z0-9_-]+$/.test(cmd)) return false;
  try {
    const result = spawnSync('which', [cmd], { stdio: 'pipe' });
    return result.status === 0;
  } catch { return false; }
}
```

**Why `which` instead of `command -v`:** `command -v` is a shell builtin —
you can't call it directly via `spawnSync` without going through a shell.
`which` is a standalone binary that works as an argument to `spawnSync`.

---

### 1.2 Null status treated as success

**File:** `bin/golem:79, 356, 382`
**Problem:** `process.exit(result.status || 0)` — when a process is killed
by a signal, `result.status` is `null`. `null || 0` = `0` (success).

**Fix:** Three lines. Find and replace all three:
```javascript
// BEFORE (3 occurrences)
process.exit(result.status || 0);

// AFTER
process.exit(result.status ?? 1);
```

`??` (nullish coalescing) returns the right side only for `null`/`undefined`,
not for `0`. So exit code 0 stays 0, null becomes 1.

---

### 1.3 Security hooks fail-open without jq

**File:** `user-scope/settings.json:105, 114`
**File:** `project-scope/settings.json:64, 73`
**Problem:** Every destructive-command-blocking hook starts with:
```bash
command -v jq >/dev/null 2>&1 || exit 0;
```
If `jq` isn't installed, all hooks silently allow everything.

**Fix:** Change `exit 0` to `exit 2` in ALL FOUR locations:
```bash
command -v jq >/dev/null 2>&1 || { echo 'BLOCKED: jq required for safety hooks. Install jq.' >&2; exit 2; };
```

Also update `bin/golem` doctor check — `jq` is **required**, not optional:

**File:** `bin/golem:130-131`
```javascript
// BEFORE
checks.push({ name: 'jq', ok: hasCommand('jq'), detail: hasCommand('jq') ? 'found' : 'not found (optional)' });

// AFTER
checks.push({ name: 'jq', ok: hasCommand('jq'), detail: hasCommand('jq') ? 'found' : 'not found (REQUIRED for security hooks)' });
```

---

### 1.4 Shell injection in PreToolUse hooks

**File:** `user-scope/settings.json:105, 114`
**File:** `project-scope/settings.json:64, 73`
**Problem:** `read cmd` without `IFS=` or `-r`, `echo "$cmd"` without
`printf`, and only reads first line (multiline bypass).

**Fix:** Replace ALL four PreToolUse hook commands with this pattern:

For the destructive command blocker (user-scope line 105, project-scope line 64):
```bash
command -v jq >/dev/null 2>&1 || { echo 'BLOCKED: jq required for safety hooks.' >&2; exit 2; }; jq -r '.tool_input.command // empty' | { IFS= read -r -d '' cmd || true; cmd_lower=$(printf '%s' "$cmd" | tr '[:upper:]' '[:lower:]' | tr '\n' ' '); case "$cmd_lower" in *'rm -rf'*'/'*|*'rm -r '*'/'*|*'rm --recursive'*'/'*|*'rm -rf ~'*|*'rm -r ~'*|*'drop database'*|*'drop schema'*|*'drop table'*|*'truncate '*|*'> /dev/'*|*'mkfs'*|*'dd if'*) echo 'BLOCKED: Destructive command detected' >&2; exit 2;; *) exit 0;; esac; }
```

Key changes:
- `IFS= read -r -d '' cmd` reads the ENTIRE input including newlines
- `tr '\n' ' '` collapses multiline commands into one line for matching
- `printf '%s'` instead of `echo` (no command substitution risk)
- Added `rm -r` (without -f) and `rm --recursive` bypass vectors
- Added `drop schema` and `truncate ` (with space, avoids matching variable names)

For the main/master push blocker (user-scope line 114, project-scope line 73):
```bash
command -v jq >/dev/null 2>&1 || { echo 'BLOCKED: jq required for safety hooks.' >&2; exit 2; }; jq -r '.tool_input.command // empty' | { IFS= read -r -d '' cmd || true; cmd_lower=$(printf '%s' "$cmd" | tr '[:upper:]' '[:lower:]' | tr '\n' ' '); case "$cmd_lower" in *'git push'*origin*main*|*'git push'*origin*master*|*'git push'*'--force'*|*'git push'*'-f '*) echo 'BLOCKED: Direct push to main/master or force push. Use feature branches.' >&2; exit 2;; *) exit 0;; esac; }
```

---

### 1.5 `golem status` crashes on corrupted state.json

**File:** `bin/golem:292-311`
**Fix:** Wrap JSON.parse in try-catch:
```javascript
function cmdStatus() {
  const stateFile = path.join(process.cwd(), '.golem', 'state.json');
  if (!fs.existsSync(stateFile)) {
    console.log(`${YELLOW}No golem state found. Run 'golem init' first.${NC}`);
    process.exit(1);
  }

  let state;
  try {
    state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
  } catch (err) {
    console.error(`${RED}Error: .golem/state.json is corrupted.${NC}`);
    console.error(`${YELLOW}Run 'golem reset' to reinitialize state.${NC}`);
    process.exit(1);
  }

  console.log(`\n${BOLD}Golem Status${NC}`);
  console.log(`  Phase:     ${state.phase || 'unknown'}`);
  console.log(`  Tasks:     ${state.tasks_completed || 0}/${state.tasks_total || 0}`);
  console.log(`  Created:   ${state.created || 'unknown'}`);

  try {
    const branch = execSync('git branch --show-current', { stdio: 'pipe', cwd: process.cwd() }).toString().trim();
    const status = execSync('git status --short', { stdio: 'pipe', cwd: process.cwd() }).toString().trim();
    console.log(`  Branch:    ${branch}`);
    console.log(`  Git:       ${status ? status.split('\n').length + ' changed files' : 'clean'}`);
  } catch { /* not a git repo */ }
  console.log();
}
```

---

### 1.6 Skills are orphaned — never wired into project context

**File:** `bin/golem:243-267` (the CLAUDE.md generation section of cmdInit)
**Problem:** Skill files get installed to `~/.golem/skills/` but nothing
tells Claude to read them. They're dead weight.

**Fix:** When generating the project CLAUDE.md, inject skill references
based on auto-detection. Replace the CLAUDE.md generation block:

```javascript
    // Build skill references based on detection
    const skillRefs = [];
    if (projectType === 'Nuxt') skillRefs.push('~/.golem/skills/frameworks/nuxt.md');
    if (projectType === 'Next.js') skillRefs.push('~/.golem/skills/frameworks/next.md');
    if (projectType === 'PHP') skillRefs.push('~/.golem/skills/frameworks/php.md');

    // Detect databases from package.json, .env.example, config files
    const dbDetection = detectDatabases(); // new helper function, see below
    if (dbDetection.includes('postgres')) skillRefs.push('~/.golem/skills/databases/postgres.md');
    if (dbDetection.includes('oracle')) skillRefs.push('~/.golem/skills/databases/oracle.md');
    if (dbDetection.includes('mssql')) skillRefs.push('~/.golem/skills/databases/mssql.md');
    if (dbDetection.includes('ibmi')) skillRefs.push('~/.golem/skills/databases/ibmi.md');

    let claudeMdContent = `# ${path.basename(process.cwd())}

## Project Type
${projectType}

## Conventions
- Follow existing code style
- Write tests for new features
- Use conventional commits

## Environment
- See .env.example for required variables
`;

    if (skillRefs.length > 0) {
      claudeMdContent += `
## Stack Skills
Read these references before working on this project:
${skillRefs.map(s => `- ${s}`).join('\n')}
`;
    }

    claudeMdContent += `
## Golem Workflow
Available commands: discuss, spec, plan, build, release, sweep, recon, status
Run \`golem help\` for details.
`;

    fs.writeFileSync(claudeMdDest, claudeMdContent);
    console.log(`  ${GREEN}Created${NC}   CLAUDE.md (detected: ${projectType}${dbDetection.length > 0 ? ', DBs: ' + dbDetection.join(', ') : ''})`);
```

Add this helper function near the top of the file:
```javascript
function detectDatabases() {
  const dbs = [];
  const cwd = process.cwd();

  // Check package.json dependencies
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf-8'));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (allDeps.pg || allDeps['@prisma/client'] || allDeps.knex) dbs.push('postgres');
    if (allDeps.oracledb) dbs.push('oracle');
    if (allDeps.mssql || allDeps.tedious) dbs.push('mssql');
    if (allDeps.odbc || allDeps['idb-pconnector']) dbs.push('ibmi');
  } catch {}

  // Check .env.example for connection strings
  try {
    const envEx = fs.readFileSync(path.join(cwd, '.env.example'), 'utf-8').toLowerCase();
    if (envEx.includes('database_url') || envEx.includes('postgres') || envEx.includes('pg_')) dbs.push('postgres');
    if (envEx.includes('oracle') || envEx.includes('ora_')) dbs.push('oracle');
    if (envEx.includes('mssql') || envEx.includes('sqlserver') || envEx.includes('sa_password')) dbs.push('mssql');
    if (envEx.includes('ibmi') || envEx.includes('as400') || envEx.includes('iseries')) dbs.push('ibmi');
  } catch {}

  return [...new Set(dbs)]; // deduplicate
}
```

---

### 1.7 `golem resume` has no command file

**Problem:** `resume` is in WORKFLOW_COMMANDS and the README but
`project-scope/commands/golem-resume.md` doesn't exist.

**Fix:** Create `project-scope/commands/golem-resume.md`. This is a
new file — we'll write the content in the implementation phase.
Minimum viable version:

```markdown
---
name: golem-resume
description: Resume an interrupted golem build session
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# Resume Build

Read `.golem/state.json` and `.golem/plans/current.md`.

## Steps

1. Read the current state from `.golem/state.json`
2. Read the plan from `.golem/plans/current.md`
3. Identify the last completed task (by `tasks_completed` count)
4. Show a summary of what was done and what remains
5. Ask the operator: "Resume from task N?" (unless `$ARGUMENTS` includes `--yes`)
6. If yes, continue the build using the same /golem-build protocol
   starting from the next incomplete task

## Important
- Do NOT restart completed tasks
- Do NOT regenerate the plan
- If state.json is corrupted, tell the operator to run `golem reset`
- Follow the same Red/Green/Refactor/Secure loop as golem-build
```

---

### 1.8 README advertises unimplemented features

**File:** `README.md`
**Problem:** `--nuxt`, `--pg`, `--oracle`, `--mssql`, `--php`, `--ibmi`,
`--update`, `log [N]` — all documented, none implemented.

**Fix:** Two options — implement or remove. For tomorrow, **remove them
from the README** and add a "Planned" section. Then implement in a
follow-up pass.

Lines to change in README.md:
- Line 37-39: Remove the `--nuxt --pg` examples. Replace with just
  `golem init` since auto-detection is what actually works.
- Line 90: Change `golem log [N]` to just `golem log`
- Line 99: Remove `golem init --update` row entirely
- Add a `## Roadmap` section at the bottom listing these as planned features

---

### 1.9 npm package name collision

**File:** `package.json:2`
**Problem:** `golem-cc` v3.0.2 already exists on npm with a different codebase.

**Decision needed from operator:** Pick ONE:
- **Option A:** Publish as `@daresthedevil/golem-cc` (scoped under your GitHub username)
- **Option B:** Rename to something like `super-golem` or `golem-workflow`
- **Option C:** If you own the existing `golem-cc` on npm (the v3.0.2),
  publish as v4.0.0 with deprecation notice on v3.x

**If you pick Option A**, change in `package.json`:
```json
"name": "@daresthedevil/golem-cc",
```
And update README install command:
```bash
pnpm dlx @daresthedevil/golem-cc
```
And update `bin/golem:352`:
```javascript
const result = spawnSync('pnpm', ['dlx', '@daresthedevil/golem-cc@latest'], {
```

---

## TIER 2 — STRUCTURAL REPAIRS (Do after Tier 1 is clean)

These are significant issues that affect robustness and security but
won't cause immediate harm if deployed to your own machine.

---

### 2.1 Path traversal — symlink protection in copyDir and smartCopy

**File:** `bin/golem-cc:88-98, 43-86`
**Fix:** Add symlink checks to both functions:

In `copyDir`:
```javascript
function copyDir(srcDir, destDir) {
  ensureDir(destDir);
  if (!fs.existsSync(srcDir)) return;
  for (const file of fs.readdirSync(srcDir)) {
    if (file.includes('..') || file.includes('/') || file.includes('\\')) {
      warn(`Skipped suspicious filename: ${file}`);
      continue;
    }
    const srcFile = path.join(srcDir, file);
    const stats = fs.lstatSync(srcFile);
    if (stats.isSymbolicLink()) {
      warn(`Skipped symlink: ${file}`);
      continue;
    }
    if (stats.isFile()) {
      smartCopy(srcFile, destFile);
    }
  }
}
```

At the top of `smartCopy`, add:
```javascript
function smartCopy(src, dest, { label = '' } = {}) {
  // Symlink protection
  if (fs.existsSync(dest) && fs.lstatSync(dest).isSymbolicLink()) {
    warn(`Refusing to overwrite symlink: ${dest.replace(HOME, '~')}`);
    return 'blocked';
  }
  // ... rest of function
```

---

### 2.2 Installer error handling — wrap main phases in try-catch

**File:** `bin/golem-cc` (the entire main body after the banner)
**Problem:** Every filesystem operation is unguarded. Disk full, permission
denied, etc. all produce raw stack traces.

**Fix:** Wrap the main installation in a try-catch at the end of the file.
The simplest approach — add this around the entire body from line 157 to 321:

```javascript
try {
  // === All existing installation code from line 157 to 321 ===
} catch (err) {
  console.error(`\n${RED}Installation failed:${NC} ${err.message}`);
  if (err.code === 'EACCES') {
    console.error(`${YELLOW}Permission denied. Check ownership of ~/.claude/ and ~/.golem/${NC}`);
  } else if (err.code === 'ENOSPC') {
    console.error(`${YELLOW}Disk full. Free up space and try again.${NC}`);
  } else {
    console.error(`${DIM}${err.stack}${NC}`);
  }
  process.exit(1);
}
```

---

### 2.3 `writeCleanJson` doesn't detect user modifications

**File:** `bin/golem-cc:113-140`
**Problem:** `writeCleanJson` has simpler logic than `smartCopy` and will
overwrite user customizations to `settings.json` without warning.

**Fix:** Align `writeCleanJson` with `smartCopy`'s 4-way comparison:

```javascript
function writeCleanJson(src, dest) {
  const raw = fs.readFileSync(src, 'utf-8');
  let obj;
  try { obj = JSON.parse(raw); } catch { fs.copyFileSync(src, dest); return; }
  const clean = JSON.stringify(cleanCommentKeys(obj), null, 2);
  const prettyDest = dest.replace(HOME, '~');
  const newHash = crypto.createHash('sha256').update(clean).digest('hex');
  const destHash = fs.existsSync(dest)
    ? crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex')
    : null;

  if (!destHash) {
    fs.writeFileSync(dest, clean);
    log(`Installed ${prettyDest}`);
    return;
  }

  if (destHash === newHash) {
    log(`${DIM}Unchanged ${prettyDest}${NC}`);
    return;
  }

  // Check if user has customized the file since last install
  const backupPath = dest + '.pre-golem';
  const prevHash = fs.existsSync(backupPath)
    ? crypto.createHash('sha256').update(fs.readFileSync(backupPath)).digest('hex')
    : null;

  if (prevHash && prevHash === destHash) {
    // User hasn't modified — safe to update
    fs.writeFileSync(dest, clean);
    log(`Updated ${prettyDest}`);
    return;
  }

  if (prevHash) {
    // User HAS modified — don't overwrite
    warn(`${prettyDest} has local modifications — not overwriting`);
    warn(`  New version saved as ${prettyDest}.new — merge manually`);
    fs.writeFileSync(dest + '.new', clean);
    return;
  }

  // First install over existing file — back it up
  fs.copyFileSync(dest, backupPath);
  warn(`Backed up existing ${path.basename(dest)} → ${path.basename(backupPath)}`);
  fs.writeFileSync(dest, clean);
  log(`Updated ${prettyDest}`);
}
```

---

### 2.4 Switch from MD5 to SHA-256

**File:** `bin/golem-cc:37-40`
**Fix:**
```javascript
function fileHash(filepath) {
  if (!fs.existsSync(filepath)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(filepath)).digest('hex');
}
```

Also update the inline hash in `writeCleanJson` (done above in 2.3).

---

### 2.5 Pin MCP server versions

**File:** `user-scope/mcp.json`, `project-scope/mcp.json`
**Problem:** `@latest` means supply chain attack = instant compromise.

**Fix:** Look up current versions and pin them:
```bash
npm view @upstash/context7-mcp version
npm view @modelcontextprotocol/server-memory version
npm view @modelcontextprotocol/server-postgres version
npm view @modelcontextprotocol/server-sequential-thinking version
npm view @modelcontextprotocol/server-filesystem version
```

Then replace all `@latest` and bare package names with pinned versions:
```json
"args": ["-y", "@upstash/context7-mcp@1.x.x"]
"args": ["-y", "@modelcontextprotocol/server-memory@0.x.x"]
```

Use `@^major.minor.patch` for semver-safe pinning.

---

### 2.6 PATH: append instead of prepend

**File:** `bin/golem-cc:262`
**Problem:** Prepending `~/.golem/bin` to PATH means anything in that
directory shadows system binaries. If compromised, every command is hijacked.

**Fix:**
```javascript
// BEFORE
const pathLine = `\n# Super Golem\nexport PATH="$HOME/.golem/bin:$PATH"\n`;

// AFTER
const pathLine = `\n# Super Golem\nexport PATH="$PATH:$HOME/.golem/bin"\n`;
```

---

### 2.7 `cmdEject` needs confirmation

**File:** `bin/golem:339-348`
**Fix:**
```javascript
function cmdEject() {
  const golemDir = path.join(process.cwd(), '.golem');
  if (!fs.existsSync(golemDir)) {
    console.log(`${YELLOW}No .golem directory found.${NC}`);
    return;
  }

  if (!args.includes('--confirm') && !args.includes('-y')) {
    console.log(`${YELLOW}This will permanently delete:${NC}`);
    console.log(`  ${golemDir}/  (all state, logs, plans, specs)`);
    console.log(`\n${BOLD}Run with --confirm to proceed:${NC} golem eject --confirm`);
    return;
  }

  fs.rmSync(golemDir, { recursive: true });
  console.log(`${GREEN}Removed${NC} .golem/`);
  console.log(`${DIM}.claude/ left intact (contains your commands and settings).${NC}`);
  console.log(`${GREEN}Golem ejected. Your code is untouched.${NC}`);
}
```

Note: This requires `args` to be accessible — update the dispatch section
so `cmdEject()` receives the args array.

---

### 2.8 `cmdReset` crash on subdirectories

**File:** `bin/golem:329-335`
**Fix:**
```javascript
// Clear logs
const logsDir = path.join(golemDir, 'logs');
if (fs.existsSync(logsDir)) {
  fs.rmSync(logsDir, { recursive: true });
  fs.mkdirSync(logsDir, { recursive: true });
}
```

---

### 2.9 `cmdInit` blocked directory guard

**File:** `bin/golem:171` (top of cmdInit)
**Fix:** Add at the start of `cmdInit()`:
```javascript
function cmdInit() {
  const cwd = process.cwd();
  const blocked = ['/', '/usr', '/bin', '/sbin', '/etc', '/var', '/opt', '/tmp',
                   '/Library', '/System', HOME];
  if (blocked.includes(cwd)) {
    console.error(`${RED}Cannot initialize golem in ${cwd}${NC}`);
    console.error(`${YELLOW}Navigate to a project directory first.${NC}`);
    process.exit(1);
  }
  // ... rest of function
```

---

### 2.10 `.env.example` blocked by Read deny pattern

**File:** `user-scope/settings.json:51`, `project-scope/settings.json:31`
**Problem:** `Read(./.env.*)` blocks `.env.example` which is supposed to be
safe and is generated by `golem init`.

**Fix:** Change the deny list in both files:
```json
"deny": [
  "Read(./.env)",
  "Read(./.env.local)",
  "Read(./.env.production)",
  "Read(./.env.development)",
  "Read(./.env.*.local)",
  "Read(./secrets/**)",
  "Read(./**/credentials*)",
  "Read(./**/*.pem)",
  "Read(./**/*.key)"
]
```

This explicitly blocks the dangerous env files while allowing `.env.example`.

---

### 2.11 DB Explorer has Bash access despite read-only mandate

**File:** `project-scope/agents/db-explorer.md:4`
**Fix:**
```yaml
tools: Read, Grep, Glob, WebSearch
```

Remove `Bash`. The db-explorer should use MCP database servers for queries,
not direct shell access. If direct queries are needed, the operator should
run them manually.

---

### 2.12 `golem-build` 3-strike rule contradicts CLAUDE.md

**File:** `project-scope/commands/golem-build.md` (around line 170)
**Problem:** Build says "if next task is independent, continue." CLAUDE.md
says "hard eject, stop everything."

**Fix:** Align build with CLAUDE.md — the hard stop is the correct behavior:
```markdown
### 3-Strike Rule
If a task fails 3 times:
1. STOP. Do not continue to the next task.
2. Write a detailed blocker report to `.golem/logs/blocker-[timestamp].md`
3. Update state.json with `"phase": "blocked"`
4. Report to operator with: what failed, why, what you tried, what to try next
```

---

### 2.13 Project-scope SessionStart hook requires python3

**File:** `project-scope/settings.json:52`
**Problem:** Uses `python3 -c "import json; ..."` but python3 is listed as
optional in doctor. Also fragile quoting.

**Fix:** Replace with jq (which is now required per 1.3):
```json
{
  "type": "command",
  "command": "if [ -f .golem/state.json ] && command -v jq >/dev/null 2>&1; then echo \"[GOLEM] Phase: $(jq -r '.phase // \"unknown\"' .golem/state.json) | Tasks: $(jq -r '\"\\(.tasks_completed // 0)/\\(.tasks_total // 0)\"' .golem/state.json)\"; fi"
}
```

---

### 2.14 MCP `${HOME}` may not expand

**File:** `user-scope/mcp.json:19`
**Problem:** Known prior bug — `${HOME}` in env settings doesn't get
shell-expanded.

**Two options:**
- **Option A (simple):** Resolve during installation in `writeCleanJson`
  by doing string replacement before writing:
  ```javascript
  const clean = JSON.stringify(cleanCommentKeys(obj), null, 2)
    .replace(/\$\{HOME\}/g, HOME)
    .replace(/\$HOME/g, HOME);
  ```
- **Option B (clean):** Change the MCP config to use a relative path
  or a well-known absolute path that doesn't need expansion.

Option A is the quick fix. Do it in `writeCleanJson` specifically for
the mcp.json destination.

---

## TIER 3 — QUALITY HARDENING (Do after Tier 2)

These make golem professional-grade.

---

### 3.1 Write tests

**Priority files to test:**
1. `bin/golem-cc` — `smartCopy()`, `writeCleanJson()`, `copyDir()`,
   `cleanCommentKeys()`, `fileHash()`
2. `bin/golem` — `hasCommand()`, `cmdStatus()` (with corrupted state),
   `cmdInit()` (detection logic), `cmdReset()`, `cmdEject()`

**Recommended test stack:** Since this is a zero-dependency project,
use Node's built-in test runner (`node --test`) which ships with Node 18+.
No dependencies needed.

Create `tests/` directory with:
```
tests/
  installer.test.js    — smartCopy, writeCleanJson, copyDir
  cli.test.js          — hasCommand, command dispatch, status
  hooks.test.js        — test the hook shell commands in isolation
```

Add to `package.json`:
```json
"scripts": {
  "test": "node --test tests/"
}
```

---

### 3.2 Overly permissive auto-approvals

**File:** `user-scope/settings.json`
**Changes:**
- Remove `Bash(chmod:*)` — too broad. Replace with specific patterns:
  ```json
  "Bash(chmod +x:*)"
  ```
- Remove `Bash(curl:*)` — data exfiltration vector. Move to
  `settings.local.json` for users who need it.
- Remove `Bash(docker:*)` — can mount host filesystem. Move to
  `settings.local.json`.
- Remove `Bash(kubectl:*)` — can modify cluster. Move to
  `settings.local.json`.

---

### 3.3 Improve help output with workflow progression

**File:** `bin/golem:82-101`
**Fix:** Replace the workflow section of `printHelp()`:
```javascript
console.log(`\n${BOLD}Workflow:${NC} ${DIM}(run in order)${NC}`);
const workflowOrder = [
  ['discuss', '1. Start a discussion about the project'],
  ['spec', '2. Write or refine a specification'],
  ['plan', '3. Create an implementation plan'],
  ['build', '4. Execute the build loop (Red/Green/Refactor/Secure)'],
  ['release', '5. Cut a release'],
  ['resume', '   Resume an interrupted build'],
];
for (const [cmd, desc] of workflowOrder) {
  console.log(`  ${GREEN}${cmd.padEnd(12)}${NC} ${desc}`);
}
```

---

### 3.4 `golem-release.md` — remove Pearl River Resort hardcoding

**File:** `project-scope/commands/golem-release.md` (around line 55-67)
**Fix:** Replace the hardcoded `dev.pearlriverresort.com` check with a
generic Gitea detection. Check the git remote URL for non-github.com,
non-gitlab.com hosts and offer Gitea release flow.

---

### 3.5 `golem-sweep.md` invalid regex

**File:** `project-scope/commands/golem-sweep.md:38`
**Problem:** `(.*+` is invalid regex.
**Fix:** Change to `(.*` or `([^)]*` depending on intent.

---

### 3.6 `.npmignore` — expand exclusions

**File:** `.npmignore`
```
.git/
.github/
tests/
TODO.md
REMEDIATION.md
findings.md
*.tar.gz
*.tgz
.DS_Store
.vscode/
.idea/
coverage/
```

---

### 3.7 `package.json` — add type field and test script

**File:** `package.json`
Add:
```json
"type": "commonjs",
"scripts": {
  "test": "node --test tests/"
},
```

---

### 3.8 Fix file permissions on sensitive files

**File:** `bin/golem-cc`
After writing settings files, set restrictive permissions:
```javascript
// After writeCleanJson for settings.json
fs.chmodSync(path.join(CLAUDE_HOME, 'settings.json'), 0o600);

// After writing state files
fs.chmodSync(stateDest, 0o600);
```

Hooks can stay 0o755 (need to be executable), but config files should
be 0o600 (owner read/write only).

---

### 3.9 `LICENSE` year

**File:** `LICENSE`
Change `2025` to `2025-2026` or just `2026`.

---

## TIER 4 — AWESOMENESS UPGRADES (Do when Tiers 1-3 are done)

These take golem from "good tool" to "must-have tool."

---

### 4.1 Generalize the CLAUDE.md template

The spaceship metaphor is universal. The casino examples are not. Create
a domain-agnostic default that keeps the philosophy but swaps examples:

- "casino floor at 2am on NYE" → "production systems at 3am when your phone is ringing"
- Remove IBM i / Oracle specific references from the default
- Keep them available as opt-in stack skills (which now work per 1.6)

This is the single highest-leverage change for adoption.

---

### 4.2 Implement `golem init` flags

Now that skills are wired up (1.6) and database detection exists (1.6),
add explicit flag parsing:

```javascript
function cmdInit() {
  const flags = new Set(args.filter(a => a.startsWith('--')).map(a => a.slice(2)));
  // ... use flags to override auto-detection
}
```

Supported flags: `--nuxt`, `--next`, `--php`, `--postgres`/`--pg`,
`--oracle`, `--mssql`, `--ibmi`, `--update`

---

### 4.3 Implement `golem uninstall`

Add a maintenance command that reverses the installer:
1. Restore all `.pre-golem` backup files
2. Remove `~/.golem/` directory
3. Remove PATH line from shell RC files
4. List what was cleaned up

---

### 4.4 Implement `golem log [N]`

```javascript
function cmdLog() {
  // ... existing checks ...
  const count = parseInt(args[0]) || 1;
  const toShow = files.slice(0, count);
  for (const file of toShow) {
    console.log(`${BOLD}${file}${NC}`);
    console.log(fs.readFileSync(path.join(logsDir, file), 'utf-8'));
    console.log();
  }
}
```

---

### 4.5 Add `golem help <command>`

```javascript
if (command === 'help' && args[0]) {
  const cmdFile = path.join(process.cwd(), '.claude', 'commands', `golem-${args[0]}.md`);
  if (fs.existsSync(cmdFile)) {
    // Read the frontmatter description
    const content = fs.readFileSync(cmdFile, 'utf-8');
    const match = content.match(/description:\s*(.+)/);
    if (match) console.log(`\n${BOLD}golem ${args[0]}${NC}: ${match[1]}\n`);
  } else {
    console.log(`${YELLOW}No detailed help for '${args[0]}'${NC}`);
  }
  process.exit(0);
}
```

---

## EXECUTION ORDER

Tomorrow, work through these in order:

```
Morning (Tier 1 — the hull breaches):
  [ ] 1.1  Fix hasCommand() injection
  [ ] 1.2  Fix null status (3 lines)
  [ ] 1.3  Fix hooks fail-open (4 locations + doctor)
  [ ] 1.4  Fix hook shell injection (4 locations)
  [ ] 1.5  Fix status crash (try-catch)
  [ ] 1.6  Wire up skills to project CLAUDE.md
  [ ] 1.7  Create golem-resume.md
  [ ] 1.8  Clean up README (remove lies)
  [ ] 1.9  Decide on package name

Afternoon (Tier 2 — structural):
  [ ] 2.1  Symlink protection
  [ ] 2.2  Installer try-catch
  [ ] 2.3  writeCleanJson user-mod detection
  [ ] 2.4  SHA-256
  [ ] 2.5  Pin MCP versions
  [ ] 2.6  PATH append
  [ ] 2.7  Eject confirmation
  [ ] 2.8  Reset crash fix
  [ ] 2.9  Init blocked dirs
  [ ] 2.10 .env.example access
  [ ] 2.11 DB explorer tools
  [ ] 2.12 3-strike alignment
  [ ] 2.13 Project SessionStart jq
  [ ] 2.14 MCP HOME expansion

Evening (Tier 3 — hardening):
  [ ] 3.1  Write tests
  [ ] 3.2  Tighten permissions
  [ ] 3.3  Help output
  [ ] 3.4  Remove Pearl River hardcoding
  [ ] 3.5  Fix sweep regex
  [ ] 3.6  .npmignore
  [ ] 3.7  package.json type + test script
  [ ] 3.8  File permissions
  [ ] 3.9  License year

Later (Tier 4 — awesomeness):
  [ ] 4.1  Generalize CLAUDE.md
  [ ] 4.2  Init flags
  [ ] 4.3  Uninstall command
  [ ] 4.4  Log [N]
  [ ] 4.5  Help <command>
```

---

Sleep well. The ship is docked. We patch the hull tomorrow.
