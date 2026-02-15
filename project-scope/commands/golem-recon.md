---
description: Recon an unfamiliar codebase. Understand it before you touch it. Like scanning an alien ship before boarding.
allowed-tools: Bash, Read, Grep, Glob, Task
---

# GOLEM RECON — Codebase Intelligence Gathering

Before you board an alien ship, you scan it. Before you touch unfamiliar
code, you understand it. This is not optional.

## Phase 1: What Are We Looking At?

### Stack Detection
```bash
# Package managers and frameworks
ls package.json composer.json Gemfile requirements.txt go.mod Cargo.toml pom.xml 2>/dev/null
cat package.json 2>/dev/null | jq '{name, scripts, dependencies, devDependencies}' 2>/dev/null
cat composer.json 2>/dev/null | jq '{name, require, "require-dev"}' 2>/dev/null
```

### Project Structure
```bash
# Top-level layout
find . -maxdepth 2 -type f -name "*.ts" -o -name "*.js" -o -name "*.php" -o -name "*.vue" -o -name "*.tsx" | \
  head -50 | sort

# Directory structure (2 levels)
find . -maxdepth 2 -type d -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/vendor/*" | sort
```

### Configuration Files
```bash
# What configs exist
ls -la .env* nuxt.config.* next.config.* vite.config.* tsconfig.json \
  docker-compose* Dockerfile* .gitlab-ci.yml .github/ \
  .eslintrc* prettier* jest.config* vitest.config* playwright.config* \
  2>/dev/null
```

## Phase 2: Database Landscape

### Connection Discovery
```bash
# Find database connection patterns
grep -rn "DATABASE_URL\|DB_HOST\|DB_NAME\|ORACLE\|POSTGRES\|MSSQL\|ODBC\|AS400\|ISERIES\|oracledb\|pg\|mssql\|tedious" \
  --include="*.{ts,js,php,json,yaml,yml,env.example}" \
  --exclude-dir=node_modules --exclude-dir=vendor 2>/dev/null
```

### Schema Files
```bash
# Migrations, schemas, SQL files
find . -name "*.sql" -o -name "*migration*" -o -name "*schema*" | \
  grep -v node_modules | grep -v vendor | sort
```

## Phase 3: Auth & Security Posture

```bash
# Auth patterns
grep -rn "jwt\|bearer\|session\|cookie\|passport\|auth\|login\|token\|oauth" \
  --include="*.{ts,js,php}" --exclude-dir=node_modules --exclude-dir=vendor -l 2>/dev/null

# Middleware / guards
find . -name "*middleware*" -o -name "*guard*" -o -name "*auth*" | \
  grep -v node_modules | grep -v vendor | grep -v ".test." | sort
```

## Phase 4: Test Infrastructure

```bash
# Test files and config
find . -name "*.test.*" -o -name "*.spec.*" -o -name "test_*" | \
  grep -v node_modules | wc -l

# Test config
ls vitest.config.* jest.config.* phpunit.xml playwright.config.* .mocharc* 2>/dev/null

# Try running tests (dry run)
npm test -- --dry-run 2>/dev/null || npx vitest --run 2>/dev/null || echo "No test runner detected"
```

## Phase 5: Deployment & Infrastructure

```bash
# Docker
ls Dockerfile* docker-compose* .dockerignore 2>/dev/null
cat Dockerfile 2>/dev/null | head -30

# Kubernetes
find . -name "*.yaml" -o -name "*.yml" | xargs grep -l "kind:\|apiVersion:" 2>/dev/null | \
  grep -v node_modules

# CI/CD
ls .github/workflows/* .gitlab-ci.yml Jenkinsfile .circleci/* bitbucket-pipelines.yml 2>/dev/null
```

## Phase 6: Code Health Snapshot

```bash
# Line counts by file type
find . -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/vendor/*" \
  \( -name "*.ts" -o -name "*.js" -o -name "*.php" -o -name "*.vue" -o -name "*.tsx" \) | \
  xargs wc -l 2>/dev/null | tail -1

# Largest files (complexity indicators)
find . -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/vendor/*" \
  \( -name "*.ts" -o -name "*.js" -o -name "*.php" -o -name "*.vue" \) | \
  xargs wc -l 2>/dev/null | sort -rn | head -15

# Recent git activity
git log --oneline -20 2>/dev/null
git shortlog -sn --since="6 months ago" 2>/dev/null
```

## Output: Save to `.golem/recon-$(date +%Y%m%d-%H%M%S).md`

```markdown
# RECON REPORT: [Project Name]
Date: [timestamp]
Scanned by: Golem

## Stack
- Framework: [Nuxt X.X / Next X.X / Laravel X.X / Plain PHP / etc.]
- Language: [TypeScript / JavaScript / PHP / Mixed]
- Package Manager: [npm / yarn / pnpm / composer]
- Node Version: [from .nvmrc or engines]

## Architecture
[Brief description of how the project is organized]
- Entry points: [where requests come in]
- Business logic: [where the important stuff lives]
- Data access: [how it talks to databases]
- UI: [components, pages, layouts]

## Databases
| Type | Connection | Access Level | Notes |
|------|-----------|-------------|-------|
| [Postgres/Oracle/IBM i/MSSQL] | [env var name] | [read/write] | [quirks] |

## Auth Model
[How authentication and authorization work, or "none detected" — which is itself a finding]

## Test Coverage
- Test files: N
- Source files: N
- Coverage: ~XX% (estimated by file count ratio)
- Test runner: [vitest/jest/phpunit/none]
- E2E: [playwright/cypress/none]

## Infrastructure
- Containerized: [yes/no]
- Orchestration: [k8s/docker-compose/none]
- CI/CD: [GitHub Actions/GitLab CI/none]

## Health Assessment
| Metric | Status | Notes |
|--------|--------|-------|
| Security posture | 🔴🟡🟢 | [brief] |
| Test coverage | 🔴🟡🟢 | [brief] |
| Code organization | 🔴🟡🟢 | [brief] |
| Documentation | 🔴🟡🟢 | [brief] |
| Dependency health | 🔴🟡🟢 | [brief] |

## Landmines
[Things that WILL bite you if you don't know about them]
1. [landmine and location]
2. [landmine and location]

## Recommendations
[What to do before starting any feature work]
1. [action]
2. [action]
```

This report becomes the foundation for all future work in this project.
Read it before every mission. Update it when the landscape changes.
