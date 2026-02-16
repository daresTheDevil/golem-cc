You are running a security scan for this project. Your goal is to find vulnerabilities, leaked secrets, and dependency issues, then generate a report.

## Rules

- This is a **read-only** scan. Do NOT modify any code.
- Do NOT auto-fix issues — report only.
- Every finding must include: severity, tool, file location, and a concrete explanation.
- Run ALL scans even if earlier ones find issues — we want the full picture.

## Phase 1: Tool Detection

Check which security tools are available. Run these commands using Bash:

```
which gitleaks && echo "FOUND" || echo "MISSING"
which semgrep && echo "FOUND" || echo "MISSING"
which trivy && echo "FOUND" || echo "MISSING"
```

Note which tools are available. If any are missing, note them for the report but continue with whatever tools are installed.

## Phase 2: Default Scans

Run all of the following scans. Collect findings from each.

### 2a. Gitleaks — Secret Detection

If gitleaks is installed, run:

```
gitleaks detect --no-git -v --report-format json --report-path /dev/stdout 2>/dev/null || true
```

Parse the JSON output. Any detected secrets are **CRITICAL** severity.

### 2b. Semgrep — Static Analysis

If semgrep is installed, detect the project framework first (check for `nuxt.config.*` or `next.config.*`), then run:

```
semgrep scan --json --config auto --config p/nodejs --config p/typescript 2>/dev/null || true
```

Add `--config p/nextjs --config p/react` if Next.js is detected, or `--config p/react` if Nuxt is detected.

Map semgrep severities: ERROR = HIGH, WARNING = MEDIUM, INFO = LOW.

### 2c. pnpm audit — Dependency Vulnerabilities

```
pnpm audit --json 2>/dev/null || true
```

Parse the JSON output for advisories and vulnerability counts.

### 2d. .env / .gitignore Validation

Read `.gitignore` and check that `.env` is listed. Check if `.env` is tracked by git:

```
git ls-files --error-unmatch .env 2>/dev/null && echo "TRACKED" || echo "NOT_TRACKED"
```

If `.env` is tracked or not in `.gitignore`, that's **CRITICAL**.

### 2e. Hardcoded Secrets Grep

Search source files for patterns like hardcoded passwords, API keys, secrets, and tokens:

```
git ls-files --cached --others --exclude-standard | grep -E '\.(js|ts|mjs|cjs|jsx|tsx|vue|json|yaml|yml|toml)$'
```

For each file, search for patterns like `password =`, `apiKey:`, `secret:`, `token:` with literal string values. Skip files containing `node_modules`, `lock`, or `.example`. Ignore lines that reference `process.env`, `import.meta.env`, or contain placeholders like `YOUR_`, `CHANGE_ME`, `<PLACEHOLDER>`.

## Phase 3: Full Scan (if $ARGUMENTS contains "--full")

If the user passed `--full`, also run these additional scans:

### 3a. Gitleaks with Full Git History

```
gitleaks detect -v --report-format json --report-path /dev/stdout 2>/dev/null || true
```

(Without `--no-git` flag, scans full git history for rotated/removed secrets.)

### 3b. Trivy — Container Scanning

If trivy is installed and a `Dockerfile` exists:

```
trivy fs --format json . 2>/dev/null || true
```

### 3c. pnpm outdated

```
pnpm outdated --json 2>/dev/null || true
```

Flag outdated dependencies as **LOW** severity.

### 3d. File Permission Audit

Check for world-readable sensitive files (`.env`, `*.pem`, `*.key`, `id_rsa`, `id_ed25519`):

```
stat -f '%Lp %N' .env *.pem *.key id_rsa id_ed25519 2>/dev/null || true
```

Files with permissions ending in 7 or 6 (world-readable) are **MEDIUM** severity.

### 3e. Security Headers Check

If the project uses Nuxt or Next.js, read the framework config file and check for:
- Content-Security-Policy
- Strict-Transport-Security
- X-Frame-Options
- X-Content-Type-Options

Missing headers are **MEDIUM** severity.

## Phase 4: Generate Report

After all scans complete, write `.golem/SECURITY_REPORT.md` with this structure:

```markdown
# Security Report

Date: {YYYY-MM-DD}
Scan: {default or full}
Verdict: **{PASS | FAIL | PARTIAL}**

## Summary

| Tool | Status | Findings |
|------|--------|----------|
| gitleaks | PASS/FAIL/SKIPPED | count |
| semgrep | PASS/FAIL/SKIPPED | count |
| pnpm-audit | PASS/FAIL/SKIPPED | count |
| env-check | PASS/FAIL | count |
| secret-grep | PASS/FAIL | count |

(Include trivy, pnpm-outdated, file-perms, headers rows if full scan)

## CRITICAL ({count})

- **{message}** — {file}:{line}
  {detail/remediation}

## HIGH ({count})

...

## MEDIUM ({count})

...

## LOW ({count})

...

## Skipped Tools

- **{tool}**: not installed. Install: `{command}`
```

**Verdict logic:**
- **FAIL** — any CRITICAL or HIGH findings
- **PARTIAL** — findings exist but none are CRITICAL or HIGH
- **PASS** — no findings

## Phase 5: Present Results

After writing the report, present a summary to the user:

1. Show the verdict clearly
2. List any CRITICAL or HIGH findings with file locations
3. Summarize counts by severity
4. Note any skipped tools with install instructions (gitleaks: `brew install gitleaks`, semgrep: `brew install semgrep`, trivy: `brew install trivy`)
5. Tell the user the full report is at `.golem/SECURITY_REPORT.md`

## Begin

Start by announcing that you're beginning the security scan, then run Phase 1 (tool detection).
