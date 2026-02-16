# MISSION: Mars Colony AI Workflow — Final Quality Gate

You are the last line of defense before this software ships on the Artemis XII.

## What You're Auditing

golem-cc is an AI development workflow engine for Claude Code. It consists of:

- **An installer** (`bin/golem-cc`) — run via `pnpm dlx golem-cc`, installs to `~/.golem/` and `~/.claude/`
- **A CLI** (`bin/golem`) — dispatches workflow commands (discuss, spec, plan, build, release, sweep, etc.)
- **Security hooks** (`hooks/`) — PreToolUse hooks that block destructive commands and force pushes
- **Skill docs** (`skills/`) — database and framework reference guides injected into AI context
- **Prompt templates** (`project-scope/commands/`) — slash command definitions that drive the AI workflow
- **Agent definitions** (`project-scope/agents/`, `user-scope/agents/`) — specialized AI sub-agents
- **Config files** (`user-scope/`, `project-scope/`) — Claude Code settings, permissions, MCP servers
- **Tests** (`tests/`) — node:test suite, zero external dependencies

Together, these create an autonomous AI development partner that follows a disciplined
RED -> GREEN -> REFACTOR -> SECURE build loop. The human provides intent; the AI executes
with guardrails.

## Why This Matters

The humans aboard the colony ship will use this workflow to build and maintain every piece
of software that keeps 10,000 people alive on Mars. Life support monitoring. Water recycling
controllers. Habitat pressure management. Medical record systems. Resource allocation engines.
Communication arrays. Navigation. Power grid balancing.

There is no npm registry on Mars. There is no Stack Overflow. There is no "let me Google that."
There is no security team to call. There is no "we'll fix it next sprint." There is one
developer, one AI, and this workflow engine. If it has a flaw — a security bypass, a crash
on corrupted state, a misleading instruction that causes the AI to write unsafe code — the
consequences cascade into physical systems that keep humans breathing.

This is not a metaphor. Audit accordingly.

## Audit Scope: EVERY FILE, EVERY LINE

Use `Glob` and `Read` to systematically read every file in this repository. Do not sample.
Do not skip files because they "look fine." Do not trust that previous audits caught everything.
A previous audit found 28 issues across 5 severity categories. All 28 have been addressed.
Your job is to find what that audit missed.

Start by mapping the full file tree, then read every file in a logical order:
1. `package.json` — dependency claims, metadata
2. `bin/golem-cc` — installer (the first code that runs)
3. `bin/golem` — CLI (the most-used code)
4. `hooks/*` — security enforcement layer
5. `user-scope/*` — global config installed to ~/.claude/
6. `project-scope/*` — per-project templates
7. `skills/**/*` — reference documentation
8. `tests/*` — verification coverage
9. Everything else (README, findings.md, etc.)

## Review Dimensions

### 1. SECURITY — The Hull

Think like an attacker who has access to a terminal on the colony ship and wants to cause harm
through the AI workflow. Think like a compromised npm package that made it into the cache before
launch. Think like a corrupted file system that changes bytes at random.

**Hook bypass vectors:**
- The destructive command blocker uses bash pattern matching. Enumerate bypass techniques:
  shell aliases, absolute paths (`/bin/rm`), command substitution (`$(cat rmscript.sh)`),
  process substitution, here-documents, xargs piping, find -exec, perl/python/ruby one-liners
  that call system(), backgrounding with &, nohup, at/cron scheduling, symbolic commands
  (`command rm`), backslash-escaped builtins, IFS manipulation, null byte injection in
  command strings, multi-statement chains with ; or &&, embedded newlines that survive the
  tr normalization.
- The push blocker uses similar patterns. Can you craft a push command it wouldn't catch?
  What about `git -c remote.origin.push=... push`? Git aliases? Git hooks that push?
- Both hooks parse JSON from stdin via jq. What if the JSON is malformed? What if
  `.tool_input.command` is not a string but an array or number? What if jq itself crashes?

**Credential exposure paths:**
- Trace every `fs.readFileSync` and `fs.writeFileSync`. Could any path read a secret file?
  Could any error message leak file contents?
- The installer resolves `${HOME}` and `$HOME` in JSON configs. Could a malicious config
  value cause path traversal via `../../etc/passwd` substitution?
- MCP server configs reference `${DATABASE_URL}`. This env var is a secret. Where does it
  flow? Could it end up in logs, error messages, git history, or AI context?
- The session hooks cat `.golem/state.json` and `git status` into AI context on every
  session start. Could a crafted state.json or git status output inject instructions?

**Supply chain:**
- MCP servers use `npx -y` with semver ranges. Pre-launch, these get cached. What if the
  cached version has a vulnerability discovered post-launch? What's the upgrade path with
  no network?
- `golem update` runs `pnpm dlx golem-cc@latest`. On Mars, this fails. Is the failure
  graceful? Does it corrupt existing installation?

**File system attacks:**
- `smartCopy` checks for symlinks, but checks and writes are separate operations (TOCTOU).
  Is the window exploitable?
- `copyDir` iterates directory contents. What if a directory entry is added between
  `readdirSync` and the file copy? What about very long filenames? Filenames with
  unicode normalization issues?
- `writeCleanJson` writes to a temp path (`.new`) then in some paths the dest directly.
  Is there an atomic write gap where a crash leaves corrupted state?

**Permission model:**
- Read every entry in the allow and deny lists in both `user-scope/settings.json` and
  `project-scope/settings.json`. For each allow entry, ask: "What's the worst thing
  this permission enables?" For each deny entry, ask: "Can this be circumvented?"
- `Bash(python3:*)` is allowed. Python can do anything. Is this acceptable?
- `Bash(node:*)` is allowed. Same question.
- `Read(.golem/**)` is allowed. Could a `.golem/` file contain sensitive data that the
  AI shouldn't see?

### 2. RELIABILITY — Life Support

Think like a system that has been running for 3 years on a machine that hasn't been
rebooted, with a file system that has some bad sectors, and a developer who is exhausted
and making mistakes.

**Error handling completeness:**
- For every `try-catch` in both CLI scripts, verify the catch block provides actionable
  information. A catch that swallows errors silently is worse than no catch at all.
- For every function that reads a file, trace what happens if: the file doesn't exist,
  the file is empty, the file contains invalid JSON, the file is binary garbage, the
  file is a directory, the file has no read permissions.
- For every `spawnSync` call, trace what happens if: the binary doesn't exist, the binary
  hangs forever, the binary is killed by OOM killer, the binary writes to stderr but
  succeeds, the binary returns exit code 127 vs 126 vs 1 vs -1.

**State machine integrity:**
- Map every possible value of `.golem/state.json`'s `phase` field. Can you reach a state
  that no command handles? Can the build loop leave state.json in an inconsistent state
  if the process is killed mid-write?
- What happens if `tasks_completed > tasks_total`? If `tasks_total` is negative? If
  `created` is not a valid date?

**Concurrency:**
- Two terminals run `golem init` in the same directory simultaneously. What happens to
  `.golem/state.json`? To `.claude/settings.json`?
- A hook script is being copied by the installer while another terminal is executing it.
  What does the kernel do? Is this safe?
- `golem reset` clears logs with `rmSync(recursive)` then `mkdirSync`. If another process
  is writing a log between those two calls, what happens?

**Offline operation:**
- List every operation that requires network access (npx, npm audit, npm view, etc.).
  For each one, verify the failure mode is graceful.
- Could the tool be made fully offline-capable for Mars? What would need to change?

### 3. USABILITY — Crew Efficiency

Think like an astronaut who is a competent developer but has never seen golem before,
is sleep-deprived, and needs to fix a critical bug in the water recycler software NOW.

**First contact:**
- Walk through the install mentally. What's the first thing they see? Does every step
  have feedback? Are there any silent failures where the user thinks it worked but it didn't?
- After install, they run `golem`. Is the help output clear? Can they figure out the
  workflow without reading README.md?
- They run `golem init` in their project. What's the output? Do they know what happened
  and what to do next?
- They run `golem doctor`. Does it tell them everything they need to know about their
  setup's health?

**Workflow coherence:**
- Is the discuss -> spec -> plan -> build -> release pipeline rigid or flexible? What if
  someone needs to skip spec and go straight to build? What if they need to go back from
  build to spec?
- The `golem resume` command exists but — does it actually work? Trace the mechanism.
  What state does it read? What happens if the state is from a different branch?
- `golem sweep` is "proactive threat assessment." When should it be run? Is that obvious
  to a new user? Is it part of the workflow or separate?

**Error experience:**
- Find every `process.exit(1)` in `bin/golem`. For each one, is there a preceding error
  message? Is the message actionable? Does the user know what to do next?
- Find every `console.error` call. Are they consistent in format? Do they all use the
  color codes correctly?

**Cognitive load:**
- Count the total number of commands, config files, concepts, and conventions a user needs
  to understand to use this tool effectively. Is it too many? What could be simplified
  without losing capability?

### 4. ARCHITECTURE — 20-Year Durability

Think like a maintenance developer who inherits this codebase in year 15 of the colony
mission. The original developer is retired. Claude's API has changed three times. The
node version is 34.

**Dependency analysis:**
- The package claims zero runtime dependencies. Verify this. Check every `require()`.
  Check if any functionality implicitly depends on global tools (jq, git, python3, etc.).
  Catalog every external dependency, explicit and implicit.
- The test suite uses only `node:test` and `node:assert`. Verify no test helpers import
  external packages.

**Coupling analysis:**
- How tightly coupled is this to Claude Code specifically? If Claude Code changes its
  settings.json schema, how many files break? If it changes how hooks work? If it
  drops slash command support?
- How tightly coupled are the prompt templates to specific AI behaviors? If the AI model
  changes its tendency to follow instructions, which templates would break first?

**Code quality deep dive:**
- Both CLI files are single-file scripts. Evaluate whether this is the right choice or
  whether extraction into modules would improve maintainability.
- Look for subtle logic bugs: off-by-one errors, regex backtracking, integer overflow
  (unlikely in JS but check anyway), timezone assumptions, locale-dependent string
  operations, path separator assumptions.
- Check for resource leaks: file handles that aren't closed, processes that aren't
  waited on, temp files that aren't cleaned up.

**Test quality:**
- For each test, ask: "Would this test catch a real regression?" Tests that assert
  obvious things (function exists, returns truthy) don't count.
- Are there critical paths with zero test coverage? Map them.
- Are the tests deterministic? Could any test fail on a different machine, timezone,
  locale, or node version?
- Could the test suite run offline? On a resource-constrained system?

### 5. THE GOLEM FACTOR — AI Workflow Effectiveness

This is the most important dimension. Everything else is infrastructure. This is the mission.

**Prompt engineering audit:**
- Read every `.md` file in `project-scope/commands/`. For each one:
  - Is the instruction set complete and unambiguous?
  - Would an AI model reliably follow these instructions?
  - Are there edge cases the instructions don't address?
  - Are there contradictions between different command files?
  - Are there contradictions with the global CLAUDE.md?
  - Is the tone appropriate? (Golem is direct and specific, not chatty)
- Read every `.md` file in `project-scope/agents/` and `user-scope/agents/`. Same questions.

**Build loop integrity:**
- The RED -> GREEN -> REFACTOR -> SECURE -> CHECKPOINT loop in `golem-build.md` is the
  core of the system. Stress-test it:
  - What if the project has no test runner? The build loop requires writing tests first.
  - What if the project has no linter? The refactor phase references linting.
  - What if semgrep isn't installed? The secure phase references it.
  - What if the AI writes a test that passes on the first try (the RED phase says this
    shouldn't happen)? Is the instruction robust enough to handle this?
  - The 3-strike rule says HALT. But what if the failure is transient (network timeout,
    flaky test)? Is there a mechanism to distinguish transient from permanent failures?

**Safety layer analysis:**
- Layer 1: Claude Code's built-in safety
- Layer 2: Permission allows/denies in settings.json
- Layer 3: PreToolUse hooks (destructive command blocker, push blocker)
- Layer 4: Prompt instructions ("NEVER run DELETE", "ALWAYS use parameterized queries")
- Layer 5: Skill doc guidance (read-only users, LIMIT clauses)
- For each layer, evaluate: What does it catch? What does it miss? What's the gap between
  this layer and the next? Is there any threat that ALL layers miss?

**Skill doc review:**
- For each database skill (postgres, oracle, mssql, ibmi):
  - Are the SQL examples syntactically correct?
  - Are the connection patterns secure?
  - Are the query patterns performant?
  - Do the safety recommendations actually work?
  - Is anything outdated (deprecated APIs, old syntax)?
- For each framework skill (nuxt, php):
  - Are the patterns current best practices?
  - Are the security checklists comprehensive?
  - Would following these docs produce production-quality code?

## Output Format

```markdown
# MARS COLONY AI WORKFLOW — FINAL QUALITY GATE REPORT

**Auditor:** [Your designation]
**Date:** [Current date]
**Scope:** Every file in golem-cc repository
**Files reviewed:** [Count]
**Standard:** Mars Colony Certification — Grade A required for ship

---

## Executive Summary
[3-5 sentences. Overall assessment. Ship or no-ship with confidence level (0-100%).]

## Scoring

| Dimension | Score | Notes |
|-----------|-------|-------|
| Security | X/10 | ... |
| Reliability | X/10 | ... |
| Usability | X/10 | ... |
| Architecture | X/10 | ... |
| AI Workflow | X/10 | ... |
| **Overall** | **X/10** | ... |

---

## CRITICAL — Would Kill the Crew
[Anything that MUST be fixed. Specific file, specific line, specific issue, specific
impact. No vague hand-waving. If you can't point to a line number, it's not critical.]

## HIGH — Would Degrade the Mission
[Serious issues. Same specificity requirements.]

## MEDIUM — Would Reduce Efficiency
[Quality and UX issues.]

## LOW — Would Affect Morale
[Polish, suggestions, optimizations.]

## INFORMATIONAL — Things to Know
[Not issues, but observations the team should be aware of.]

---

## What's Genuinely Excellent
[Be specific. Call out what works well so the team knows what NOT to change.
Good architecture decisions, clever solutions, thorough coverage.]

## Gap Analysis: What the Previous Audit Missed
[The previous audit (findings.md) found 28 issues. What did it NOT find?
Where were its blind spots?]

## Offline Readiness Assessment
[Specific evaluation of Mars-readiness. What works offline? What doesn't?
What's the remediation plan?]

## 20-Year Maintenance Forecast
[What will break first? What will age well? What needs the most documentation
for future maintainers?]

---

## Prioritized Action List
1. [Highest priority — do this first]
2. [Second priority]
3. [Continue...]

## Ship / No-Ship Decision

**Decision:** SHIP / NO-SHIP / CONDITIONAL SHIP

**Conditions (if conditional):**
- [ ] [Condition 1]
- [ ] [Condition 2]

**Confidence:** [0-100%]

**Reasoning:** [Your honest assessment of whether this workflow engine is ready
to be the sole development framework for software that keeps 10,000 humans alive
on another planet.]
```

## Rules of Engagement

1. **Read every file.** No exceptions. No sampling. `find . -type f | wc -l` then
   verify you read that many files.
2. **Trace execution paths.** Don't just read code — simulate it. Walk through the
   install process, the init process, every command, every hook execution.
3. **Think adversarially.** For every safety mechanism, try to break it. For every
   error handler, try to trigger an unhandled case. For every assumption, check if
   it holds.
4. **Think from the AI's perspective.** For every prompt template, imagine you ARE
   the AI receiving it. Would you follow it correctly? Would you know what to do in
   edge cases? Would you make mistakes?
5. **Be specific.** File names, line numbers, code snippets. No "there might be an
   issue with..." — either there IS an issue or there ISN'T.
6. **Be honest.** If it's good, say it's good. If it's not ready for Mars, say so.
   Diplomatic hedging gets people killed.
7. **Do NOT propose fixes.** This is an audit, not a pull request. Findings only.
   The fix is a separate step.
8. **Compare against findings.md.** The previous audit is in the repo. Read it.
   Understand what was found and fixed. Your job is to find what it missed and verify
   the fixes actually work.

## Begin

You are the last gate. After you, there is nothing between this code and the red dust.

Read every file. Check every line. Trust nothing.

BEGIN AUDIT.
