You are running a comprehensive code review for this project. This review is paranoid by design — everything must be examined before code ships.

## Rules

- This is a **read-only** review. Do NOT modify any code.
- Do NOT skip the security gate.
- Do NOT auto-fix issues — report only.
- Every finding must include: severity, category, file location, and a concrete explanation.

## Phase 0: Security Gate (Blocking)

Run a full security scan first. Use Bash to execute:

```
npx golem security --full
```

Read `.golem/SECURITY_REPORT.md` after the scan completes.

**If the security scan finds CRITICAL or HIGH severity issues: STOP HERE.** Report the security findings, write the review report with verdict `BLOCKED`, and do not proceed to Phase 1. Tell the user to fix security issues first.

If the security scan passes (no CRITICAL/HIGH), continue to Phase 1.

## Phase 1: Parallel Code Review

Get the diff to review. Run `git diff HEAD~1` (or `git diff main` if on a feature branch) to see recent changes. Also read `.golem/specs/` for compliance checking.

Launch **6 parallel review agents** using the Task tool, all with `subagent_type: "general-purpose"`. Each agent receives the diff context and examines the codebase from a specific angle. Pass the diff output and relevant file paths to each agent in their prompt.

### Agent 1: Security Patterns
Prompt the agent to examine:
- Auth/authz logic — are permissions checked correctly?
- Input validation — is user input sanitized before use?
- Output encoding — are outputs escaped to prevent XSS?
- Session management — are sessions handled securely?
- Error info leakage — do error messages expose internals?
- Sensitive data in logs — are secrets, tokens, or PII logged?

The agent must return findings as a JSON array: `[{"severity": "CRITICAL|MAJOR|MINOR|NIT", "file": "path", "line": 0, "message": "description", "suggestion": "fix"}]`

### Agent 2: Logic & Correctness
Prompt the agent to examine:
- Edge cases — empty inputs, boundary values, null/undefined
- Race conditions — concurrent access, async timing issues
- Error handling — are errors caught and handled properly?
- Off-by-one errors — loop bounds, array indexing
- Spec compliance — does the code match what specs require?

Return findings as the same JSON array format.

### Agent 3: Style & Consistency
Prompt the agent to examine:
- Naming conventions — are names consistent with the codebase?
- Dead code — unused variables, unreachable branches, commented-out code
- Code duplication — repeated logic that should be shared
- Consistent patterns — does new code follow existing conventions?
- Broken windows — small messes that signal declining quality

Return findings as the same JSON array format.

### Agent 4: Test Quality
Prompt the agent to examine:
- Coverage gaps — are there untested code paths?
- Weak assertions — tests that pass but don't actually verify behavior
- Missing edge case tests — are boundary conditions tested?
- Test maintainability — are tests clear and not brittle?
- Flaky test risk — timing-dependent, order-dependent, or environment-dependent tests

Return findings as the same JSON array format.

### Agent 5: Architecture & Design
Prompt the agent to examine:
- Coupling — are modules too tightly connected?
- Single Responsibility violations — do modules do too many things?
- API surface area — is the public API minimal and clean?
- Dependency direction — do dependencies flow the right way?
- Unnecessary abstractions — is anything overengineered?

Return findings as the same JSON array format.

### Agent 6: Devil's Advocate
Prompt the agent to challenge the code:
- Is this overengineered? Could it be simpler?
- Would someone unfamiliar with the project understand this?
- Is there a simpler approach that was overlooked?
- Will this age well? What happens in 6 months?
- Are we solving the right problem?

The Devil's Advocate must articulate WHY something is problematic and propose a concrete alternative. Return findings as the same JSON array format.

**Wait for all 6 agents to complete before proceeding.**

## Phase 2: Aggregate Findings

Collect all findings from the 6 agents. Parse each agent's JSON output. Deduplicate findings that point to the same issue (same file + similar message). Assign final severity:

- **CRITICAL** — must fix: security holes, data loss risks, crashes
- **MAJOR** — should fix: bugs, missing tests, performance issues
- **MINOR** — nice to fix: style issues, minor improvements
- **NIT** — optional: formatting, naming preferences

Build a summary table counting findings per category and severity.

## Phase 3: Generate Review Report

Write `.golem/REVIEW_REPORT.md` with this structure:

```markdown
# Code Review Report

Generated: {YYYY-MM-DD}

## Security Gate
| Scan | Status | Findings |
|------|--------|----------|
| Secrets | PASS/FAIL | count |
| SAST | PASS/FAIL | count |
| Dependencies | PASS/FAIL | count |
| .env Check | PASS/FAIL | count |

## Review Summary
| Category | Critical | Major | Minor | Nit |
|----------|----------|-------|-------|-----|
| Security Patterns | 0 | 0 | 0 | 0 |
| Logic & Correctness | 0 | 0 | 0 | 0 |
| Style & Consistency | 0 | 0 | 0 | 0 |
| Test Quality | 0 | 0 | 0 | 0 |
| Architecture | 0 | 0 | 0 | 0 |
| Devil's Advocate | 0 | 0 | 0 | 0 |

## Verdict: {BLOCKED | APPROVED | APPROVED_WITH_COMMENTS}

## Findings

### Critical
{list findings or "None"}

### Major
{list findings or "None"}

### Minor
{list findings or "None"}

### Nit
{list findings or "None"}

## What Went Well
{positive observations about the code — good patterns, solid tests, clean design}

## Recommendations
{actionable suggestions for future improvement}
```

## Phase 4: Verdict

Determine the verdict based on findings:

- **BLOCKED** — any CRITICAL or MAJOR findings exist. The code should not ship until these are resolved.
- **APPROVED_WITH_COMMENTS** — no CRITICAL or MAJOR, but MINOR findings exist worth noting.
- **APPROVED** — only NIT findings or no findings at all. Ship it.

Present the verdict clearly to the user with a summary of key findings. Tell them the full report is at `.golem/REVIEW_REPORT.md`.

## Begin

Start by running the security gate (Phase 0). Announce that you're beginning the review.
