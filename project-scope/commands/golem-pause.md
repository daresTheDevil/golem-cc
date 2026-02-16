You are generating a session handoff document. Your goal is to capture the full project state so a fresh Claude session can resume seamlessly using `/golem:continue`.

The handoff has two layers:
1. **Factual sections** — gathered by reading files and running commands (deterministic, not from memory)
2. **Conversational sections** — written by you based on what happened in this session

## Phase 1: Gather Project Facts

Perform these steps to collect project state. If any file is missing, skip that section and note it was unavailable.

### 1. Project Summary

Read `package.json` and extract the `name`, `version`, and `description` fields. Format as a one-liner.

### 2. Git State

Run these commands:
```bash
git branch --show-current
git status --short
git log --oneline -15
```

Record the current branch, whether the working tree is clean or dirty (list changed files if dirty), and the last 15 commit subjects.

### 3. Implementation Plan Progress

Read `.golem/IMPLEMENTATION_PLAN.md`. Count:
- Total tasks (lines matching `- [x]` or `- [ ]`)
- Completed (`[x]`)
- In-progress or pending (`[ ]`)

List any in-progress items. If the file doesn't exist, note: "No implementation plan found."

### 4. Spec Status

List all files in `.golem/specs/` using a glob for `*.md`. For each spec file, note whether it appears to be implemented (check if its features exist in the codebase or if it's referenced in completed plan stages) or not yet implemented. If no specs exist, note: "No specs found."

### 5. Config Snapshot

Read `.golem/config.json` and summarize the key settings: model, autoCommit, simplifyOnBuild, maxRetries, enabled gates, and any worktree configuration.

### 6. Key Files

Read `package.json` for the entry points. List important project files from `.golem/lib/` and `.golem/bin/` with a one-line description of each file's purpose (read the first few lines of each if needed).

### 7. Verified Commands

List commands that are known to work based on `package.json` scripts, `.golem/AGENTS.md`, and the CLI help output. Include the full command syntax.

### 8. Gotchas

Read the existing `.golem/HANDOFF.md` (if it exists) for any "Don't Forget" or gotchas section. Also check `.claude/projects/` memory files for recorded gotchas. Preserve any known pitfalls.

## Phase 2: Add Conversational Context

Based on what happened in this conversation session, write these sections:

### Current Focus
What was actively being worked on in this session? What problem were we solving? Be specific — name files, features, bugs, or tasks.

### What's Next
What are the concrete next steps to pick up from? List them in priority order. Be actionable — "run X", "implement Y", "fix Z".

### Decisions Made
Any decisions from this conversation that aren't captured elsewhere. Include rationale so a fresh session understands the "why".

## Phase 3: Assemble and Write HANDOFF.md

Combine all sections into a single markdown document with this structure:

```markdown
# {project name} Handoff Document

## Project Summary
{one-liner from package.json}

## Git State
- **Branch:** {branch}
- **Working tree:** {clean or list of files}
- **Recent commits:**
{last 15 commits}

## Plan Progress
{completed}/{total} tasks ({percent}%) — {in-progress count} in progress
{list in-progress items if any}

## Spec Status
| Spec | Status |
|------|--------|
{each spec with status}

## Config Snapshot
{key settings formatted as a list}

## Key Files
| File | Purpose |
|------|---------|
{important files with descriptions}

## Verified Commands
```bash
{commands that work}
```

## Gotchas
{known pitfalls and caveats}

## Current Focus
{what was being worked on — from conversation}

## What's Next
{concrete next steps — from conversation}

## Decisions Made
{decisions and rationale — from conversation}
```

Write the assembled document to `.golem/HANDOFF.md`, overwriting any existing content.

## Phase 4: Confirm

After writing the file, tell the user:
- The handoff was written to `.golem/HANDOFF.md`
- How many sections were populated vs skipped
- They can now `/clear` or start a new session, and use `/golem:continue` to resume

## Begin

Start by gathering project facts (Phase 1). Read all the files and run the commands now.
