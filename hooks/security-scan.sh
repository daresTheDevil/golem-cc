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

# ============================================================================
# Universal checks
# ============================================================================

echo "  Checking for hardcoded secrets..."
SECRETS=$(grep -rni \
  "password\s*=\s*['\"].\+['\"]\|api_key\s*=\s*['\"].\+['\"]\|apikey\s*=\s*['\"].\+['\"]\|secret\s*=\s*['\"].\+['\"]\|token\s*=\s*['\"].\+['\"]" \
  --include="*.ts" --include="*.js" --include="*.php" --include="*.env.*" \
  --include="*.json" --include="*.yaml" --include="*.yml" \
  --exclude-dir=node_modules --exclude-dir=vendor --exclude-dir=.git \
  --exclude="*.test.*" --exclude="*.spec.*" --exclude="package-lock.json" \
  2>/dev/null || true)

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

# Check for private keys
KEYS=$(find . -name "*.pem" -o -name "*.key" -o -name "*.p12" -o -name "*.pfx" 2>/dev/null | \
  grep -v node_modules | grep -v vendor | grep -v .git || true)
if [[ -n "$KEYS" ]]; then
  echo "  ⚠️  Private key files found:"
  echo "$KEYS"
  FINDINGS=$((FINDINGS + $(echo "$KEYS" | wc -l)))
fi

# ============================================================================
# Framework-specific checks
# ============================================================================

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

    echo "  Checking for XSS patterns..."
    XSS_JS=$(grep -rn "v-html\|dangerouslySetInnerHTML\|innerHTML\s*=" \
      --include="*.vue" --include="*.tsx" --include="*.jsx" --include="*.ts" --include="*.js" \
      --exclude-dir=node_modules 2>/dev/null || true)
    if [[ -n "$XSS_JS" ]]; then
      echo "  ⚠️  Potential XSS (raw HTML injection):"
      echo "$XSS_JS"
      FINDINGS=$((FINDINGS + $(echo "$XSS_JS" | wc -l)))
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
    SQLI=$(grep -rni "mysql_query\|mysqli_query\|pg_query\|\$wpdb.*prepare" --include="*.php" 2>/dev/null | \
      grep "\$_\(GET\|POST\|REQUEST\|COOKIE\)" || true)
    # Also catch string concatenation in queries
    SQLI_CONCAT=$(grep -rni "query\s*(.*\\..*\\\$_\|execute\s*(.*\\\$_" --include="*.php" \
      --exclude-dir=vendor 2>/dev/null || true)
    SQLI_ALL="${SQLI}${SQLI_CONCAT}"
    if [[ -n "$SQLI_ALL" ]]; then
      echo "  ⚠️  Potential SQL injection:"
      echo "$SQLI_ALL" | head -20
      FINDINGS=$((FINDINGS + $(echo "$SQLI_ALL" | grep -c . || true)))
    fi

    echo "  Checking for XSS patterns..."
    XSS=$(grep -rn "echo.*\$_\(GET\|POST\|REQUEST\)\|<?=.*\$_\(GET\|POST\|REQUEST\)" --include="*.php" 2>/dev/null | \
      grep -v "htmlspecialchars\|htmlentities\|esc_html\|esc_attr" || true)
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
