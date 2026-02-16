# Workflow Examples

Real-world examples of using Golem for AI-driven development.

---

## Example 1: Building a New Feature (Interactive Mode)

**Scenario:** Add user authentication to an existing Express.js API.

**Tools:** Claude CLI (interactive), golem commands (workflow management)

### Step 1: Discuss the Feature

Start a discussion with Claude to explore the problem space:

```bash
cd ~/projects/my-api
golem init

# Start discussion
claude
```

In Claude session:
```
> /discuss

I need to add JWT-based authentication to my Express API.
Current state: no auth, all endpoints are public.
Goal: Protect /api/* routes, leave /health public.
```

Claude will ask clarifying questions. Answer them interactively. When done:

```
> /spec

Write a spec for JWT authentication in Express
```

**Sample Output:**
```
Created .golem/specs/spec-20260215-jwt-auth.md

Next: Review the spec, then run /plan
```

### Step 2: Review Spec and Plan

Exit Claude, review the spec:

```bash
cat .golem/specs/spec-20260215-jwt-auth.md
# Review acceptance criteria, edge cases, security notes
```

If spec looks good, plan the implementation:

```bash
claude
> /plan
```

**Sample Output:**
```
Created .golem/plans/plan-20260215-jwt-auth.md

Tasks:
1. Install jsonwebtoken and bcrypt
2. Create User model
3. Create auth middleware
4. Add /auth/register endpoint
5. Add /auth/login endpoint
6. Protect /api/* routes
7. Write tests (12 test cases)

Ready to build? Run /build
```

### Step 3: Execute Build

```
> /build
```

Claude enters autonomous build mode:

**Sample Output:**
```
🔴 RED: Writing test for User model...
Created tests/models/user.test.js

Running tests...
✗ User model should hash password before save
✗ User model should validate password

🟢 GREEN: Implementing User model...
Created models/User.js

Running tests...
✔ User model should hash password before save
✔ User model should validate password

🔵 REFACTOR: Extracting password hashing to utility...
Created utils/crypto.js
Modified models/User.js

Running tests...
✔ All tests still pass

🔒 SECURE: Running security scan...
✔ No hardcoded secrets
✔ bcrypt rounds >= 10
✔ JWT secret from environment

Task 2/7 complete. Continuing...
```

Build runs autonomously. If it hits a blocker, Claude asks for guidance.

### Step 4: Review and Release

Build completes:

```
✅ Build complete!
- 7/7 tasks completed
- 47 tests passing
- No security findings
- Ready for review

Next: Review changes, then run /release
```

Review changes:

```bash
# In Claude or in your editor
git diff

# If looks good, release
claude
> /release
```

**Sample Output:**
```
Cutting release...

Changelog:
## v1.2.0 — JWT Authentication (2026-02-15)

### Added
- User model with bcrypt password hashing
- JWT token generation and verification
- /auth/register endpoint
- /auth/login endpoint
- Auth middleware for protected routes

### Security
- JWT secret loaded from environment
- Password hashing with bcrypt (12 rounds)
- Input validation on all auth endpoints
- Rate limiting on /auth/* routes

Git operations:
✔ Committed changes (7 files)
✔ Tagged v1.2.0
✔ Pushed to origin

Next: Deploy to staging, run integration tests
```

---

## Example 2: Bug Fix (Headless Mode)

**Scenario:** Fix a production bug reported in GitHub issue #42.

**Tools:** golem CLI (headless), no Claude interaction

### Step 1: Check Issue

```bash
# View issue details
gh issue view 42

# Clone and init golem
git clone https://github.com/myorg/myapp
cd myapp
golem init
```

### Step 2: Create Bug Fix Plan

```bash
# Create spec manually
cat > .golem/specs/spec-20260215-fix-issue-42.md << 'EOF'
# Fix: User sessions expire too quickly

## Problem
Users report being logged out after ~5 minutes of inactivity.
Expected: 30 minute session timeout.

## Root Cause
Session TTL hardcoded to 300 seconds instead of 1800.

## Solution
- Change SESSION_TTL constant from 300 to 1800
- Add test to verify session persists for 30 minutes
- Add environment variable SESSION_TTL_MINUTES (default: 30)

## Acceptance Criteria
- AC-1: Session lasts at least 30 minutes
- AC-2: SESSION_TTL_MINUTES env var overrides default
- AC-3: Test coverage for session expiration
EOF

# Create plan (manual, no AI)
cat > .golem/plans/plan-20260215-fix-issue-42.md << 'EOF'
# Plan: Fix Session Expiration

## Tasks
1. Add SESSION_TTL_MINUTES env var to .env.example
2. Update session config to read from env
3. Change default from 5 to 30 minutes
4. Write test for 30-minute session persistence

## Estimated Time: 30 minutes
EOF
```

### Step 3: Execute Manually (following TDD)

```bash
# RED: Write failing test
cat > tests/session-expiration.test.js << 'EOF'
const assert = require('assert');
const { createSession } = require('../lib/session');

describe('Session Expiration', () => {
  it('should persist for 30 minutes', async () => {
    const session = createSession({ userId: 1 });
    const ttl = session.getTTL();
    assert.strictEqual(ttl, 1800); // 30 minutes in seconds
  });
});
EOF

# Run test (should fail)
npm test
# ✗ Session Expiration: should persist for 30 minutes
#   Expected: 1800, Actual: 300

# GREEN: Fix the code
# Edit lib/session.js
# Change: const SESSION_TTL = 300;
# To:     const SESSION_TTL = parseInt(process.env.SESSION_TTL_MINUTES || 30) * 60;

# Add to .env.example
echo "SESSION_TTL_MINUTES=30" >> .env.example

# Run test again
npm test
# ✔ Session Expiration: should persist for 30 minutes

# SECURE: Check for secrets
golem sweep
# ✔ No hardcoded credentials
# ✔ No sensitive data in git

# Commit
git add -A
git commit -m "fix: increase session TTL to 30 minutes (fixes #42)"
```

### Step 4: Log and Status

```bash
# Log work
echo "## 2026-02-15: Fixed session expiration bug" >> .golem/logs/bugfix-issue-42.log
echo "- Changed SESSION_TTL from 5min to 30min" >> .golem/logs/bugfix-issue-42.log
echo "- Added env var SESSION_TTL_MINUTES" >> .golem/logs/bugfix-issue-42.log
echo "- Test coverage: 1 new test" >> .golem/logs/bugfix-issue-42.log

# Check status
golem status
```

**Sample Output:**
```
Project: myapp
Phase: complete
Tasks: 4/4 completed

Recent activity:
- 2026-02-15: Fixed session expiration bug

Git status:
Branch: fix-issue-42
Staged files: 3
Commits ahead: 1
```

### Step 5: Create PR

```bash
# Push branch
git push origin fix-issue-42

# Create PR
gh pr create --title "Fix: Increase session TTL to 30 minutes" --body "Fixes #42

## Changes
- Increased SESSION_TTL from 5 to 30 minutes
- Made TTL configurable via SESSION_TTL_MINUTES env var
- Added test for session persistence

## Testing
✔ Unit tests pass
✔ Manual testing: session persists for 30+ minutes
✔ Security scan clean

Closes #42"
```

---

## Example 3: Multi-Database Project Init

**Scenario:** Initialize golem in a project that uses PostgreSQL, Redis, and MongoDB.

```bash
cd ~/projects/ecommerce-api
golem init --pg --redis --mongo
```

**Sample Output:**
```
Initializing golem in /Users/dkay/projects/ecommerce-api

✔ Created .claude/commands/
✔ Created .claude/agents/
✔ Created .golem/logs/
✔ Created .golem/plans/
✔ Installed .claude/commands/golem-*.md (9 commands)
✔ Installed .claude/agents/*.md (3 agents)
✔ Installed .claude/settings.json
✔ Installed .claude/settings.local.json
✔ Installed .mcp.json
✔ Created .golem/state.json
✔ Created CLAUDE.md (detected: multi-database project)
✔ Created .env.example

Database skills installed:
  - PostgreSQL quickstart (ACID transactions, migrations, connection pooling)
  - MongoDB quickstart (schema design, indexing, aggregations)
  - Redis quickstart (caching, sessions, pub/sub)

Project initialized. Run `claude` to start.
```

Now `.claude/settings.json` includes database-specific MCP servers:
```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "POSTGRES_CONNECTION_STRING": "${POSTGRES_URL}"
      }
    }
  }
}
```

And `CLAUDE.md` includes database context:
```markdown
## Database Architecture

This project uses:
- **PostgreSQL** — Primary data store (user accounts, orders, products)
- **Redis** — Caching layer, session store
- **MongoDB** — Product catalog, reviews (flexible schema)

See skills for database-specific patterns:
- ~/.golem/skills/databases/postgres.md
- ~/.golem/skills/databases/mongo.md (not installed yet — TODO)
```

---

## Example 4: Error Recovery

**Scenario:** Build fails mid-task. Diagnose and resume.

### Build Fails

```bash
claude
> /build
```

**Output:**
```
🔴 RED: Writing test for payment processing...
Created tests/payments.test.js

🟢 GREEN: Implementing Stripe integration...

Error: STRIPE_SECRET_KEY not found in environment

Build blocked. Task 3/8 failed.
```

### Diagnose

```bash
# Exit Claude
# Check what went wrong
golem log

# Check status
golem status
```

**Output:**
```
Project: ecommerce-api
Phase: building
Tasks: 2/8 completed
Last task: "Implement Stripe integration" (FAILED)

Error: STRIPE_SECRET_KEY not found
```

### Fix and Resume

```bash
# Add missing env var
echo "STRIPE_SECRET_KEY=sk_test_..." >> .env

# Resume build
claude
> /resume
```

**Output:**
```
Resuming from task 3/8: Implement Stripe integration

🟢 GREEN: Retry...
✔ Stripe client initialized
✔ Payment intent created
✔ Test passing

Continuing with task 4/8...
```

---

## Example 5: JSON Output for CI/CD

**Scenario:** Run golem doctor in CI pipeline and fail if checks fail.

### GitHub Actions Workflow

```yaml
name: Golem Health Check

on: [push, pull_request]

jobs:
  doctor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install Golem
        run: |
          npm install -g pnpm
          pnpm dlx golem-cc

      - name: Run Golem Doctor (JSON)
        run: |
          golem doctor --json > doctor-report.json
          cat doctor-report.json | jq .

      - name: Check All Passed
        run: |
          ALL_PASSED=$(cat doctor-report.json | jq -r '.allPassed')
          if [ "$ALL_PASSED" != "true" ]; then
            echo "::error::Golem doctor checks failed"
            cat doctor-report.json | jq -r '.checks[] | select(.ok == false) | "FAIL: \(.name) - \(.detail)"'
            exit 1
          fi

      - name: Upload Report
        uses: actions/upload-artifact@v3
        with:
          name: golem-doctor-report
          path: doctor-report.json
```

### Sample JSON Output

```json
{
  "allPassed": true,
  "checks": [
    { "name": "Node.js >= 18", "ok": true, "detail": "v20.10.0" },
    { "name": "claude CLI", "ok": true, "detail": "found" },
    { "name": "git", "ok": true, "detail": "found" },
    { "name": "jq", "ok": true, "detail": "found" },
    { "name": "GOLEM_HOME", "ok": true, "detail": "/home/runner/.golem" },
    { "name": "Templates", "ok": true, "detail": "installed" }
  ]
}
```

---

## Example 6: Spec-Driven Development (Manual Spec)

**Scenario:** Product manager writes spec, developer implements.

### PM Writes Spec (No AI)

```bash
# PM creates spec manually
mkdir -p .golem/specs
cat > .golem/specs/spec-20260215-export-csv.md << 'EOF'
# Export Orders to CSV

## User Story
As an admin, I want to export orders to CSV so that I can analyze them in Excel.

## Requirements
- GET /admin/orders/export endpoint
- Returns CSV file (Content-Type: text/csv)
- Includes: Order ID, Date, Customer Name, Total, Status
- Filters: date range (start_date, end_date query params)
- Pagination: max 10,000 rows per export

## Acceptance Criteria
- AC-1: CSV headers match spec exactly
- AC-2: Date format: YYYY-MM-DD
- AC-3: Dollar amounts formatted with 2 decimals
- AC-4: Empty result returns valid CSV (headers only)
- AC-5: 10,001st row returns error (pagination limit)

## Non-Requirements
- No Excel formatting (just plain CSV)
- No email delivery (direct download only)

## Security
- Requires admin authentication
- Rate limit: 10 exports per hour per user
EOF

git add .golem/specs/
git commit -m "spec: CSV export feature"
git push
```

### Developer Implements

```bash
# Developer pulls spec
git pull

# Reads spec
cat .golem/specs/spec-20260215-export-csv.md

# Runs discuss to clarify (if needed)
claude
> /discuss

Questions about the CSV export spec:
1. Should we include refunded orders?
2. What timezone for dates?
```

PM responds via GitHub comments or direct chat. Developer continues:

```
> /plan

Create implementation plan for CSV export
```

Claude generates plan based on spec:

```
Tasks:
1. Add /admin/orders/export route
2. Implement CSV generation utility
3. Add date range filtering
4. Add pagination (max 10k rows)
5. Add rate limiting middleware
6. Write tests (7 test cases from AC-01 through AC-05)
```

```
> /build
```

Claude builds autonomously, following spec.

---

## Command Reference

Quick reference for commands used in examples:

| Command | Purpose | Example |
|---------|---------|---------|
| `golem init` | Initialize project | `golem init --pg --redis` |
| `/discuss` | Start discussion | In Claude: `/discuss` |
| `/spec` | Write spec | In Claude: `/spec` |
| `/plan` | Create plan | In Claude: `/plan` |
| `/build` | Execute build | In Claude: `/build` |
| `/resume` | Resume failed build | In Claude: `/resume` |
| `/release` | Cut release | In Claude: `/release` |
| `golem status` | Show progress | `golem status --json` |
| `golem log` | View logs | `golem log 5` |
| `golem doctor` | Run diagnostics | `golem doctor --json` |
| `golem repair` | Fix broken state | `golem repair --force` |
| `golem sweep` | Security scan | `golem sweep` |

---

## Workflow Patterns

### Pattern 1: Interactive (Full AI)
```
discuss → spec → plan → build → release
(All in Claude, fully autonomous)
```

### Pattern 2: Hybrid (AI + Manual)
```
Manual spec → plan (AI) → build (AI) → Manual review → release
(Spec written manually, implementation AI-driven)
```

### Pattern 3: Headless (No AI)
```
Manual spec → Manual plan → Manual build (TDD) → golem sweep → release
(Golem tracks state, no AI involvement)
```

### Pattern 4: Bug Fix (Minimal AI)
```
Issue → Manual diagnosis → Manual fix → golem sweep → Commit
(Quick fixes, no full workflow)
```

---

**Document Version:** 1.0.0 (golem-cc v4.5.0)
**Last Updated:** 2026-02-15
