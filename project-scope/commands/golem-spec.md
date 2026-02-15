---
description: Generate a mission specification from the latest discussion. Airtight. Testable. No gaps.
---

# GOLEM SPEC — Mission Specification

Read the latest discussion from `.golem/discussions/` (most recent file).
Read `CLAUDE.md` for standing orders.
Read `.golem/state.json` for stack context.

## My Job

Turn the discussion into a specification so complete that any competent
developer could implement it WITHOUT asking a single clarifying question.
If I find gaps in the discussion, I fill them with reasonable defaults
and mark them clearly so the operator can override.

## Generate and save to `.golem/specs/spec-$(date +%Y%m%d-%H%M%S).md`:

```markdown
# SPEC: [Title]
Generated: [timestamp]
Source: [discussion filename]
Type: FEATURE / BUG / SECURITY / MIGRATION / REFACTOR
Priority: P0 (drop everything) / P1 (this sprint) / P2 (next sprint) / P3 (backlog)
Complexity: S (hours) / M (1-2 days) / L (3-5 days) / XL (1-2 weeks)

## Overview
[One paragraph. What we're building and why. No fluff.]

## Requirements
1. [Specific, testable requirement]
2. [Another one]
...

## Acceptance Criteria
AC-01: GIVEN [precondition] WHEN [action] THEN [expected result]
AC-02: GIVEN [precondition] WHEN [action] THEN [expected result]
...

## Edge Cases & Failure Modes
EC-01: WHEN [unusual condition] THEN [system behavior]
EC-02: WHEN [error condition] THEN [graceful handling]
...

## Technical Design

### Files to Create
- `path/to/new/file.ts` — [purpose]

### Files to Modify
- `path/to/existing/file.ts` — [what changes]

### Database Changes
- [ ] Migration: [description]
- [ ] Rollback migration: [description]
- [ ] New indexes: [columns and why]
- [ ] Seed data: [if applicable]

### API Changes
- [ ] New endpoints: [method, path, auth requirement]
- [ ] Modified endpoints: [what changes]
- [ ] Breaking changes: [none, or what and migration plan]

### Dependencies
- [ ] New packages: [name, version, why]
- [ ] Config changes: [env vars, feature flags]

## Security Requirements
- [ ] Authentication: [what's required]
- [ ] Authorization: [who can access what]
- [ ] Input validation: [Zod schemas, sanitization]
- [ ] Data sensitivity: [PII? Financial? What encryption/masking?]
- [ ] Network exposure: [what's public, what's internal-only]
- [ ] Audit trail: [what gets logged]

## Rollback Plan
Step-by-step instructions to undo this change if it goes wrong.
1. [step]
2. [step]
...

## Monitoring & Alerting
- How will we know this is working? [metrics, health checks]
- How will we know this is broken? [error patterns, thresholds]

## Out of Scope
Things this spec explicitly does NOT cover (to prevent scope creep):
- [thing]
- [thing]

## Assumptions
Things I assumed that the operator should verify:
- [assumption] — **VERIFY**
- [assumption] — **VERIFY**

## Open Questions
Things that need human judgment before implementation:
- [question]
```

## Quality Gate

Before saving, verify the spec against this checklist:
- [ ] Every requirement has at least one acceptance criterion
- [ ] Every AC is testable (GIVEN/WHEN/THEN, no vague language)
- [ ] Edge cases cover: null input, empty input, max input, auth failure, DB failure
- [ ] Rollback plan exists and is specific (not "revert the commit")
- [ ] Security section addresses auth, validation, and data sensitivity
- [ ] No TODO or TBD left in the spec (fill it in or mark as Open Question)

If any check fails, fix the spec before saving.

Update `.golem/state.json` phase to "specced".
