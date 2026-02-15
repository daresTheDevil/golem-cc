#!/usr/bin/env bash
# ============================================================================
# Security Scan Hook
# Runs as part of the SECURE phase of each build task
# Exit 0 = clean, Exit 1 = findings that need fixing
# ============================================================================
set -euo pipefail

FRAMEWORK="${1:-unknown}"
FINDINGS=0

echo "🔒 Running security scan for framework: $FRAMEWORK"

# Universal checks
echo "  Checking for hardcoded secrets..."
SECRETS=$(grep -rn "password\s*=\s*['\"].\+['\"]" \
  --include="*.ts" --include="*.js" --include="*.php" --include="*.env.*" \
  --exclude-dir=node_modules --exclude-dir=vendor --exclude-dir=.git \
  --exclude="*.test.*" --exclude="*.spec.*" 2>/dev/null || true)

if [[ -n "$SECRETS" ]]; then
  echo "  ⚠️  POTENTIAL HARDCODED SECRETS FOUND:"
  echo "$SECRETS" | head -20
  FINDINGS=$((FINDINGS + $(echo "$SECRETS" | wc -l)))
fi

# Check for .env files that shouldn't be committed
if git ls-files --cached | grep -q "\.env$\|\.env\.local$\|\.env\.production$"; then
  echo "  ⚠️  .env file tracked by git!"
  FINDINGS=$((FINDINGS + 1))
fi

# Framework-specific checks
case "$FRAMEWORK" in
  nuxt|next)
    echo "  Running npm audit..."
    npm audit --audit-level=moderate 2>/dev/null && echo "  ✅ npm audit clean" || {
      echo "  ⚠️  npm audit found vulnerabilities"
      FINDINGS=$((FINDINGS + 1))
    }

    echo "  Checking for eval() usage..."
    EVALS=$(grep -rn "eval(" --include="*.ts" --include="*.js" --include="*.vue" --include="*.tsx" --include="*.jsx" \
      --exclude-dir=node_modules 2>/dev/null || true)
    if [[ -n "$EVALS" ]]; then
      echo "  ⚠️  eval() usage found:"
      echo "$EVALS"
      FINDINGS=$((FINDINGS + $(echo "$EVALS" | wc -l)))
    fi

    if command -v semgrep &>/dev/null; then
      echo "  Running semgrep..."
      semgrep --config auto --quiet --json 2>/dev/null | \
        python3 -c "import json,sys; r=json.load(sys.stdin); print(f'  semgrep: {len(r.get(\"results\",[]))} findings')" \
        2>/dev/null || echo "  semgrep: skipped"
    fi
    ;;

  php)
    echo "  Checking PHP syntax..."
    PHP_ERRORS=$(find . -name "*.php" ! -path "./vendor/*" -exec php -l {} \; 2>&1 | grep -i "error" || true)
    if [[ -n "$PHP_ERRORS" ]]; then
      echo "  ⚠️  PHP syntax errors:"
      echo "$PHP_ERRORS"
      FINDINGS=$((FINDINGS + $(echo "$PHP_ERRORS" | wc -l)))
    fi

    echo "  Checking for SQL injection patterns..."
    SQLI=$(grep -rn "mysql_query\|mysqli_query\|pg_query" --include="*.php" 2>/dev/null | \
      grep "\$_\(GET\|POST\|REQUEST\|COOKIE\)" || true)
    if [[ -n "$SQLI" ]]; then
      echo "  ⚠️  Potential SQL injection:"
      echo "$SQLI"
      FINDINGS=$((FINDINGS + $(echo "$SQLI" | wc -l)))
    fi

    echo "  Checking for XSS patterns..."
    XSS=$(grep -rn "echo.*\$_\(GET\|POST\|REQUEST\)" --include="*.php" 2>/dev/null | \
      grep -v "htmlspecialchars\|htmlentities" || true)
    if [[ -n "$XSS" ]]; then
      echo "  ⚠️  Potential XSS:"
      echo "$XSS"
      FINDINGS=$((FINDINGS + $(echo "$XSS" | wc -l)))
    fi
    ;;
esac

echo ""
if [[ $FINDINGS -gt 0 ]]; then
  echo "🔒 Security scan complete: $FINDINGS finding(s) need attention"
  exit 1
else
  echo "🔒 Security scan complete: CLEAN ✅"
  exit 0
fi
