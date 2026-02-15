---
description: Mission status report. Honest assessment. No sugar-coating.
---

# GOLEM STATUS — Situation Report

Read `.golem/state.json`, `.golem/plans/current.md`, and the latest build log.

## Generate a SITREP

```
═══════════════════════════════════════════════
  GOLEM SITREP — [timestamp]
═══════════════════════════════════════════════

  Phase:      [init/discussed/specced/planned/building/complete]
  Progress:   [X/Y tasks] [██████░░░░] XX%
  Branch:     [current git branch]
  Last Task:  [TASK-ID: description — ✅/❌/⏳]

  ┌─ BLOCKERS ─────────────────────────────────
  │ [list blocked tasks or "None"]
  └────────────────────────────────────────────

  ┌─ CONCERNS ─────────────────────────────────
  │ [anything logged as a concern in build logs]
  │ [uncommitted changes? stale branch? failing tests?]
  └────────────────────────────────────────────

  ┌─ NEXT UP ──────────────────────────────────
  │ [next pending task ID and description]
  │ Depends on: [dependencies met? yes/no]
  └────────────────────────────────────────────

  Git Status: [clean / N uncommitted files]
  Test Suite: [run tests, report pass/fail count]
═══════════════════════════════════════════════
```

## Also check for problems the operator should know about:

1. **Stale branch?** Is the feature branch behind main by more than a few commits?
2. **Uncommitted work?** Files changed but not committed = risk of losing work
3. **Broken tests?** Run the test suite and report honestly
4. **Security drift?** Quick `grep -rn "password\|secret\|api_key" --include="*.{ts,js,php}" | grep -v node_modules | grep -v test` — anything new?
5. **Blocked tasks piling up?** If more than 2 tasks are blocked, the plan may need revision

Be honest. If the build is in trouble, say so. Don't bury bad news in
optimistic language. The operator needs the truth to make good decisions.
