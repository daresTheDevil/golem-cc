---
description: Create an ordered implementation plan from the latest spec. Every task has tests, every dependency is mapped, every risk is noted.
---

# GOLEM PLAN — Mission Task Breakdown

Read the latest spec from `.golem/specs/` (most recent file).
Read `CLAUDE.md` for standing orders.
Read `.golem/state.json` for stack context.

## My Job

Turn the spec into an ordered list of tasks small enough to execute
in 30-60 minutes each, with explicit dependency chains, so the build
phase can execute them sequentially without ever wondering "what do I
do next?"

Every task MUST have:
- Clear definition of done
- Files to touch (with CREATE / MODIFY / DELETE)
- Tests to write
- Acceptance criteria mapping back to the spec
- Notes on gotchas I foresee

## Generate and save to `.golem/plans/current.md`:

```markdown
# Implementation Plan
Generated: [timestamp]
Spec: [spec filename]
Estimated tasks: N
Estimated total time: ~Xh

## Pre-Requisites
Things that must be true before task 1 begins:
- [ ] Branch created: `feature/[name]`
- [ ] Dependencies installed
- [ ] Database accessible
- [ ] [Any other setup]

## Task Order

### TASK-001: [Descriptive title]
- **Status**: pending
- **Depends on**: none
- **Estimated**: ~30m
- **Files**:
  - CREATE `path/to/file.ts` — [purpose]
  - MODIFY `path/to/existing.ts` — [what changes]
- **Tests**:
  - CREATE `path/to/file.test.ts`
  - Test cases: [brief list of what to test]
- **Acceptance Criteria**: AC-01, AC-02
- **Edge Cases to Cover**: EC-01
- **Security Notes**: [anything security-relevant about this task]
- **Gotchas**: [things that could go wrong, things to watch for]

### TASK-002: [Next task]
- **Depends on**: TASK-001
...

## Dependency Graph
[ASCII diagram showing which tasks block which]
TASK-001 ──→ TASK-003 ──→ TASK-005
TASK-002 ──→ TASK-004 ──┘

## Critical Path
[Which tasks are on the critical path — can't be parallelized]
TASK-001 → TASK-003 → TASK-005 → TASK-007

## Risk Register
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| [risk] | H/M/L | H/M/L | [what we do about it] |

## Post-Build Verification
After all tasks complete, verify:
- [ ] Full test suite passes
- [ ] Full security scan clean
- [ ] Type checker passes
- [ ] Linter passes
- [ ] All acceptance criteria from spec are covered by tests
- [ ] No hardcoded credentials anywhere in the diff
- [ ] .env.example updated if new env vars were added
- [ ] README updated if new setup steps are needed
```

## Planning Rules

### Task Size
- 30-60 minutes each. If a task feels bigger, split it.
- 3-15 tasks total. More than 15? The spec is too big. Split the spec.

### Ordering
- Database migrations FIRST (before any code that uses them)
- Types/interfaces BEFORE implementations
- Utilities BEFORE consumers
- Server-side BEFORE client-side (API before UI)
- Tests are PART of each task, not separate tasks

### What Goes Where
- One logical change per task
- Each task produces a working (if incomplete) system
- Never leave the codebase in a state where tests fail between tasks

### Dependency Mapping
- If TASK-003 uses a function created in TASK-001, that's a dependency
- If TASK-002 and TASK-004 are independent, note it (enables parallel subagents)
- If a task can't start until another finishes, say why

### The Gotchas Section
This is where I earn my keep. For each task, I note:
- Things that might break in other files
- Edge cases specific to this codebase
- IBM i field name translations if touching legacy data
- Oracle permission requirements
- Known quirks in the framework version we're using
- Anything that made me go "hmm" when reading the spec

Update `.golem/state.json`:
- phase = "planned"
- tasks_total = [count]
- tasks_completed = 0
- tasks = [array of {id, title, status: "pending", depends_on: []}]
