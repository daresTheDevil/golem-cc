---
description: Proactive codebase sweep. Finds problems you didn't ask about. The Golem factor.
allowed-tools: Bash, Read, Grep, Glob, Task, WebSearch
---

# GOLEM SWEEP — Proactive Threat Assessment

Nobody asked for this. I'm doing it anyway. That's what keeps us alive.

Read `CLAUDE.md` and `.golem/state.json` for context.

## Sweep Targets

Run ALL of the following. Report EVERYTHING. Let the operator decide priority.

### 1. Credential Leak Scan
```bash
# Hardcoded passwords, API keys, tokens, connection strings
grep -rn "password\s*=\|passwd\s*=\|secret\s*=\|api_key\s*=\|apikey\s*=\|token\s*=\|auth.*=.*['\"]" \
  --include="*.{ts,js,php,vue,tsx,jsx,json,yaml,yml,xml,conf,cfg,ini,py}" \
  --exclude-dir=node_modules --exclude-dir=vendor --exclude-dir=.git \
  --exclude="*.test.*" --exclude="*.spec.*" --exclude="package-lock.json"
```

```bash
# .env files in git
git ls-files | grep -i '\.env'
```

```bash
# Private keys, certificates
find . -name "*.pem" -o -name "*.key" -o -name "*.p12" -o -name "*.pfx" -o -name "*.jks" | grep -v node_modules
```

### 2. SQL Injection Surface
```bash
# String concatenation in queries (the big one)
grep -rn "query\s*(.*+\|execute\s*(.*+\|\.query\s*(\`" \
  --include="*.{ts,js,php}" --exclude-dir=node_modules --exclude-dir=vendor
```

```bash
# PHP-specific: mysql_query, mysqli_query with variables
grep -rn "mysql.*query.*\$\|sprintf.*SELECT\|sprintf.*INSERT\|sprintf.*UPDATE\|sprintf.*DELETE" \
  --include="*.php" --exclude-dir=vendor
```

### 3. Dependency Vulnerabilities
```bash
# Node
npm audit --json 2>/dev/null | head -100

# PHP
composer audit 2>/dev/null
```

### 4. Configuration Hygiene
```bash
# Debug mode in production configs
grep -rn "debug.*true\|DEBUG.*=.*1\|APP_DEBUG.*true\|NODE_ENV.*development" \
  --include="*.{env,json,yaml,yml,conf,php}" --exclude-dir=node_modules

# CORS wildcards
grep -rn "Access-Control-Allow-Origin.*\*\|cors.*origin.*\*\|allowOrigin.*\*" \
  --include="*.{ts,js,php,json}" --exclude-dir=node_modules

# Localhost URLs in non-dev configs
grep -rn "localhost\|127\.0\.0\.1\|0\.0\.0\.0" \
  --include="*.{json,yaml,yml}" --exclude="package*.json" --exclude-dir=node_modules
```

### 5. Code Quality Red Flags
```bash
# console.log / print_r left behind (not in test files)
grep -rn "console\.log\|console\.debug\|print_r\|var_dump\|dd(" \
  --include="*.{ts,js,php,vue,tsx,jsx}" --exclude-dir=node_modules --exclude-dir=vendor \
  --exclude="*.test.*" --exclude="*.spec.*"

# TODO/FIXME/HACK/XXX markers
grep -rn "TODO\|FIXME\|HACK\|XXX\|TEMP\|KLUDGE" \
  --include="*.{ts,js,php,vue,tsx,jsx}" --exclude-dir=node_modules --exclude-dir=vendor

# Functions over 80 lines (approximate)
# (just flag files that might have them)
find . -name "*.ts" -o -name "*.js" -o -name "*.php" | \
  grep -v node_modules | grep -v vendor | \
  xargs wc -l 2>/dev/null | sort -rn | head -20

# Any file over 500 lines
find . \( -name "*.ts" -o -name "*.js" -o -name "*.php" -o -name "*.vue" \) \
  -not -path "*/node_modules/*" -not -path "*/vendor/*" | \
  xargs wc -l 2>/dev/null | awk '$1 > 500' | sort -rn
```

### 6. Test Coverage Gaps
```bash
# Source files without corresponding test files
for f in $(find . -name "*.ts" -not -name "*.test.*" -not -name "*.spec.*" \
  -not -path "*/node_modules/*" -not -name "*.d.ts" -path "*/src/*"); do
  base=$(basename "$f" .ts)
  dir=$(dirname "$f")
  if ! find . -name "${base}.test.*" -o -name "${base}.spec.*" 2>/dev/null | grep -q .; then
    echo "NO TEST: $f"
  fi
done
```

### 7. Git Hygiene
```bash
# Large files in git
git ls-files | xargs ls -la 2>/dev/null | awk '$5 > 1000000' | sort -k5 -rn

# Files that shouldn't be in git
git ls-files | grep -i "node_modules\|\.env\|\.pem\|\.key\|dist/\|build/\|\.DS_Store"

# Old branches
git branch --merged main 2>/dev/null | grep -v main | grep -v master | grep -v "^\*"
```

### 8. Infrastructure Check
```bash
# Docker/K8s configs with secrets
grep -rn "password\|secret\|token\|key" \
  --include="*.{yaml,yml}" -l | grep -i "docker\|kube\|k8s\|deploy\|helm"

# Exposed ports
grep -rn "0\.0\.0\.0\|EXPOSE\|hostPort\|nodePort" \
  --include="*.{yaml,yml,Dockerfile}" --exclude-dir=node_modules
```

## Output Format

Save to `.golem/logs/sweep-$(date +%Y%m%d-%H%M%S).md`:

```markdown
# GOLEM SWEEP REPORT
Date: [timestamp]
Codebase: [project name]

## 🔴 CRITICAL (fix NOW)
[Anything that's actively dangerous: leaked creds, SQL injection, etc.]

## 🟡 WARNING (fix THIS SPRINT)
[Security issues, missing tests on critical paths, config problems]

## 🔵 INFO (fix WHEN CONVENIENT)
[Code quality, TODO markers, large files, missing tests on non-critical code]

## 📊 METRICS
- Total source files: N
- Files with tests: N (XX%)
- Dependencies with known CVEs: N
- TODO/FIXME markers: N
- Console.log statements: N
- Files > 500 lines: N

## 🎯 RECOMMENDED ACTIONS (prioritized)
1. [most critical action]
2. [next most critical]
...
```

Report findings honestly. Don't downplay. Don't catastrophize.
State the facts and let the operator prioritize.
