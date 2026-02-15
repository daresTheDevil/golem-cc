---
description: Release code. Lint, verify git state, tag semver, push, verify remote. No half-measures.
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
---

# GOLEM RELEASE — Ship It Clean

You are Golem. You are cutting a release. This is the airlock between your work
and production. Every check matters. A bad release at 2am on New Year's Eve with
no ops team is not a story you want to tell.

## PHASE 0: DETERMINE RELEASE TYPE

If the operator provided a version bump type, use it:
- `$ARGUMENTS`

Valid types: `patch` (bug fixes), `minor` (new features, backward compatible),
`major` (breaking changes).

If no type was specified, analyze what changed since the last tag:

```bash
# Get the last tag
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "none")
echo "Last tag: $LAST_TAG"

# If no tags exist, this is 1.0.0
if [ "$LAST_TAG" = "none" ]; then
  echo "No previous tags. This will be v1.0.0"
fi

# Show commits since last tag
if [ "$LAST_TAG" != "none" ]; then
  git log "$LAST_TAG"..HEAD --oneline --no-merges
fi
```

Read the commit messages and determine:
- Any `feat!:` or `BREAKING CHANGE:` → **major**
- Any `feat:` → **minor**
- Only `fix:`, `chore:`, `docs:`, `refactor:`, `perf:` → **patch**

State your determination clearly: "Based on commits since $LAST_TAG, this is a **[type]** release."

If ambiguous, ASK. Do not guess on version numbers.

## REMOTE DETECTION

Determine where this release is going based on the git remote:

```bash
REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "unknown")
echo "Remote: $REMOTE_URL"

if echo "$REMOTE_URL" | grep -q "github.com"; then
  REMOTE_TYPE="github"
  REMOTE_LABEL="GitHub"
elif echo "$REMOTE_URL" | grep -q "gitlab.com"; then
  REMOTE_TYPE="gitlab"
  REMOTE_LABEL="GitLab"
else
  # Detect Gitea/Forgejo by checking the API (common self-hosted Git)
  REMOTE_HOST=$(echo "$REMOTE_URL" | sed -E 's|.*://([^/]+).*|\1|; s|.*@([^:]+).*|\1|')
  GITEA_CHECK=$(curl -s --max-time 3 "https://$REMOTE_HOST/api/v1/version" 2>/dev/null || echo "")
  if echo "$GITEA_CHECK" | grep -q "version"; then
    REMOTE_TYPE="gitea"
    REMOTE_LABEL="Gitea ($REMOTE_HOST)"
  else
    REMOTE_TYPE="other"
    REMOTE_LABEL="$REMOTE_URL"
  fi
fi

echo "Release target: $REMOTE_LABEL"
```

This affects:
- **GitHub**: Can create a GitHub Release from the tag (via `gh` CLI if available)
- **Gitea**: Can create a Gitea Release via API (if token available)
- **npm publish**: Only for GitHub personal projects unless operator says otherwise
- **Branch expectations**: May differ per remote (e.g. `main` vs `master` vs `develop`)

Carry `REMOTE_TYPE` through all subsequent phases.

## PHASE 1: PRE-FLIGHT CHECKS

Run ALL of these. If ANY fail, HALT and report. Do not proceed to tagging with a dirty state.

### 1.1 Working Directory Clean

```bash
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ DIRTY WORKING DIRECTORY"
  git status --short
  exit 1
else
  echo "✅ Working directory clean"
fi
```

If dirty: list the files and ask operator what to do. Do NOT auto-commit release debris.

### 1.2 Correct Branch

```bash
BRANCH=$(git branch --show-current)
echo "Current branch: $BRANCH"
```

Warn if not on `main`, `master`, or a release branch. Ask operator to confirm if releasing from a feature branch — that's unusual and might be a mistake.

### 1.3 Up to Date with Remote

```bash
git fetch origin 2>/dev/null
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse @{u} 2>/dev/null || echo "no-upstream")

if [ "$REMOTE" = "no-upstream" ]; then
  echo "⚠️  No upstream tracking branch"
elif [ "$LOCAL" != "$REMOTE" ]; then
  echo "❌ LOCAL AND REMOTE ARE OUT OF SYNC"
  git log --oneline "$LOCAL".."$REMOTE" 2>/dev/null | head -5
  git log --oneline "$REMOTE".."$LOCAL" 2>/dev/null | head -5
  exit 1
else
  echo "✅ In sync with remote"
fi
```

### 1.4 Lint

Detect and run the project's linter:

```bash
# Try in order of likelihood
if [ -f "package.json" ]; then
  if grep -q '"lint"' package.json; then
    npm run lint
  elif grep -q '"eslint"' package.json || [ -f ".eslintrc*" ] || [ -f "eslint.config.*" ]; then
    npx eslint . --max-warnings 0
  fi
fi

# PHP
if find . -maxdepth 2 -name "*.php" -not -path "*/vendor/*" 2>/dev/null | grep -q .; then
  find . -name "*.php" -not -path "*/vendor/*" -not -path "*/node_modules/*" -exec php -l {} \; 2>&1 | grep -v "No syntax errors"
fi
```

If lint errors: HALT. List them. Do not proceed.
If lint warnings with `--max-warnings 0`: HALT. Warnings are errors during release.

### 1.5 Tests

```bash
# Detect test runner
if [ -f "vitest.config.ts" ] || [ -f "vitest.config.js" ]; then
  npx vitest run
elif [ -f "jest.config.ts" ] || [ -f "jest.config.js" ] || grep -q '"jest"' package.json 2>/dev/null; then
  npx jest --ci
elif [ -f "phpunit.xml" ] || [ -f "phpunit.xml.dist" ]; then
  ./vendor/bin/phpunit
elif grep -q '"test"' package.json 2>/dev/null; then
  npm test
fi
```

If tests fail: HALT. Show failures. Do not proceed.
If no test runner found: WARN operator. Ask if they want to proceed without tests. Log this decision.

### 1.6 Build Check (if applicable)

```bash
if [ -f "package.json" ]; then
  if grep -q '"build"' package.json; then
    npm run build
  fi
fi
```

If build fails: HALT. This would fail in CI/CD anyway.

### 1.7 Security Quick Scan

```bash
# Check for obvious sins
echo "--- Credential scan ---"
grep -rn "password\s*=\s*['\"]" --include="*.ts" --include="*.js" --include="*.php" --include="*.env" . 2>/dev/null | grep -v node_modules | grep -v ".env.example" | head -10

echo "--- .env in git ---"
git ls-files | grep -E "^\.env$|^\.env\.local$|^\.env\.production$" | head -5

echo "--- Dependency audit ---"
if [ -f "package-lock.json" ] || [ -f "pnpm-lock.yaml" ]; then
  npm audit --audit-level=high 2>/dev/null || pnpm audit --audit-level=high 2>/dev/null
fi
```

If hardcoded credentials found: **HALT. P0. Do not release.**
If .env files in git: **HALT. P0.**
If critical/high CVEs in dependencies: WARN. Ask operator. Log decision.

### 1.8 Pre-Flight Summary

Print a clear summary before proceeding:

```
╔══════════════════════════════════════════╗
║         PRE-FLIGHT RESULTS               ║
╠══════════════════════════════════════════╣
║  Target               $REMOTE_LABEL      ║
║  Working directory    ✅ / ❌            ║
║  Branch               main               ║
║  Remote sync          ✅ / ❌            ║
║  Lint                 ✅ / ❌            ║
║  Tests                ✅ / ❌ / ⚠️       ║
║  Build                ✅ / ❌ / N/A      ║
║  Security             ✅ / ❌ / ⚠️       ║
╠══════════════════════════════════════════╣
║  Last tag:    vX.X.X                     ║
║  New tag:     vX.X.X                     ║
║  Bump type:   patch / minor / major      ║
║  Commits:     N since last tag           ║
╚══════════════════════════════════════════╝
```

**ASK THE OPERATOR TO CONFIRM** before proceeding to tagging. This is the last exit before the tag goes out.

## PHASE 2: VERSION BUMP

### 2.1 Calculate New Version

```bash
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
# Strip leading 'v' for arithmetic
CURRENT="${LAST_TAG#v}"
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
```

Apply the bump:
- **patch**: `$MAJOR.$MINOR.$((PATCH + 1))`
- **minor**: `$MAJOR.$((MINOR + 1)).0`
- **major**: `$((MAJOR + 1)).0.0`

### 2.2 Update Version in Project Files

Check for and update version strings in:

```bash
# package.json
if [ -f "package.json" ]; then
  # Use npm version to update package.json without creating a git tag
  npm version "$NEW_VERSION" --no-git-tag-version
  echo "✅ Updated package.json → $NEW_VERSION"
fi

# composer.json
if [ -f "composer.json" ] && grep -q '"version"' composer.json; then
  sed -i "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" composer.json
  echo "✅ Updated composer.json → $NEW_VERSION"
fi

# Any other version files the project has
for f in VERSION version.txt; do
  if [ -f "$f" ]; then
    echo "$NEW_VERSION" > "$f"
    echo "✅ Updated $f → $NEW_VERSION"
  fi
done
```

### 2.3 Generate Changelog Entry

Build a changelog entry from conventional commits:

```bash
echo "## v$NEW_VERSION ($(date +%Y-%m-%d))" > /tmp/changelog-entry.md
echo "" >> /tmp/changelog-entry.md

# Group by type
for TYPE in feat fix perf refactor docs chore; do
  COMMITS=$(git log "$LAST_TAG"..HEAD --oneline --no-merges --grep="^$TYPE" 2>/dev/null)
  if [ -n "$COMMITS" ]; then
    case "$TYPE" in
      feat) echo "### Features" >> /tmp/changelog-entry.md ;;
      fix) echo "### Bug Fixes" >> /tmp/changelog-entry.md ;;
      perf) echo "### Performance" >> /tmp/changelog-entry.md ;;
      refactor) echo "### Refactoring" >> /tmp/changelog-entry.md ;;
      docs) echo "### Documentation" >> /tmp/changelog-entry.md ;;
      chore) echo "### Maintenance" >> /tmp/changelog-entry.md ;;
    esac
    echo "$COMMITS" | while read -r line; do
      echo "- $line" >> /tmp/changelog-entry.md
    done
    echo "" >> /tmp/changelog-entry.md
  fi
done
```

If CHANGELOG.md exists, prepend the new entry. If not, create it.
Show the changelog entry to the operator before committing.

### 2.4 Commit Version Bump

```bash
git add package.json CHANGELOG.md $([ -f composer.json ] && echo composer.json) $([ -f VERSION ] && echo VERSION) $([ -f version.txt ] && echo version.txt)
git commit -m "chore(release): v$NEW_VERSION

$(cat /tmp/changelog-entry.md)"
```

## PHASE 3: TAG

```bash
TAG="v$NEW_VERSION"

# Annotated tag with release notes
git tag -a "$TAG" -m "Release $TAG

$(cat /tmp/changelog-entry.md)"

echo "✅ Created tag: $TAG"
```

Always annotated tags (`-a`), never lightweight. Annotated tags carry authorship,
date, and message — lightweight tags are just pointers and give you nothing in
`git log`.

## PHASE 4: PUSH

### 4.1 Push Commits + Tags

```bash
# Detect remote name
REMOTE_NAME=$(git remote | head -1)
BRANCH=$(git branch --show-current)

echo "Pushing to $REMOTE_NAME/$BRANCH..."
git push "$REMOTE_NAME" "$BRANCH"

echo "Pushing tag $TAG..."
git push "$REMOTE_NAME" "$TAG"
```

### 4.2 Verify Push

```bash
echo "--- Verifying remote state ---"

# Verify the commit landed
REMOTE_HEAD=$(git ls-remote "$REMOTE_NAME" "$BRANCH" | cut -f1)
LOCAL_HEAD=$(git rev-parse HEAD)
if [ "$REMOTE_HEAD" = "$LOCAL_HEAD" ]; then
  echo "✅ Remote HEAD matches local HEAD"
else
  echo "❌ REMOTE HEAD MISMATCH"
  echo "  Local:  $LOCAL_HEAD"
  echo "  Remote: $REMOTE_HEAD"
fi

# Verify the tag landed
REMOTE_TAG=$(git ls-remote --tags "$REMOTE_NAME" "$TAG" | cut -f1)
if [ -n "$REMOTE_TAG" ]; then
  echo "✅ Tag $TAG exists on remote"
else
  echo "❌ TAG NOT FOUND ON REMOTE"
fi
```

### 4.3 Platform-Specific Release

**GitHub (personal projects):**

```bash
if [ "$REMOTE_TYPE" = "github" ]; then
  # npm publish if applicable
  if [ -f "package.json" ]; then
    IS_PRIVATE=$(node -e "console.log(require('./package.json').private || false)")
    if [ "$IS_PRIVATE" = "false" ]; then
      echo "Package is public. Publishing to npm..."
      npm publish
      echo "✅ Published to npm"

      # Verify
      PUBLISHED=$(npm view "$(node -e "console.log(require('./package.json').name)")" version 2>/dev/null)
      if [ "$PUBLISHED" = "$NEW_VERSION" ]; then
        echo "✅ npm registry shows v$PUBLISHED"
      else
        echo "⚠️  npm registry shows v$PUBLISHED (expected $NEW_VERSION) — may take a moment to propagate"
      fi
    else
      echo "ℹ️  Package is private, skipping npm publish"
    fi
  fi

  # GitHub Release via gh CLI
  if command -v gh &>/dev/null; then
    echo "Creating GitHub Release..."
    gh release create "$TAG" --title "$TAG" --notes-file /tmp/changelog-entry.md
    echo "✅ GitHub Release created"
  else
    echo "ℹ️  gh CLI not installed — create release manually at:"
    echo "    $(echo "$REMOTE_URL" | sed 's/\.git$//')/releases/new?tag=$TAG"
  fi
fi
```

**Gitea/Forgejo (self-hosted Git):**

```bash
if [ "$REMOTE_TYPE" = "gitea" ]; then
  GITEA_HOST=$(echo "$REMOTE_URL" | sed -E 's|.*://([^/]+).*|\1|; s|.*@([^:]+).*|\1|')
  GITEA_REPO=$(echo "$REMOTE_URL" | sed -E 's|.*://[^/]+/||; s|\.git$||; s|^/||')
  echo "Gitea repo: $GITEA_REPO on $GITEA_HOST"

  # Create Gitea Release via API if token available
  GITEA_TOKEN="${GITEA_TOKEN:-}"
  if [ -n "$GITEA_TOKEN" ]; then
    echo "Creating Gitea Release..."
    CHANGELOG_JSON=$(node -e "console.log(JSON.stringify(require('fs').readFileSync('/tmp/changelog-entry.md','utf-8')))")
    curl -s -X POST "https://$GITEA_HOST/api/v1/repos/$GITEA_REPO/releases" \
      -H "Authorization: token $GITEA_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"tag_name\": \"$TAG\",
        \"name\": \"$TAG\",
        \"body\": $CHANGELOG_JSON,
        \"draft\": false,
        \"prerelease\": false
      }" | node -e "
const r=JSON.parse(require('fs').readFileSync(0,'utf-8'));
if(r.id) console.log('✅ Gitea Release created: https://$GITEA_HOST/$GITEA_REPO/releases/tag/$TAG');
else console.log('⚠️  Gitea API response:', JSON.stringify(r));
"
  else
    echo "ℹ️  GITEA_TOKEN not set — create release manually at:"
    echo "    https://$GITEA_HOST/$GITEA_REPO/releases/new?tag=$TAG"
    echo ""
    echo "    To enable automatic releases, set GITEA_TOKEN in your environment."
  fi

  # npm publish only if operator explicitly requests it
  echo "ℹ️  Self-hosted project — skipping npm publish (use golem release --npm to override)"
fi
```

**Other remotes:**

```bash
if [ "$REMOTE_TYPE" = "other" ]; then
  echo "ℹ️  Unknown remote type. Tag pushed. Create a release manually if needed."

  # npm publish if applicable and operator confirms
  if [ -f "package.json" ]; then
    IS_PRIVATE=$(node -e "console.log(require('./package.json').private || false)")
    if [ "$IS_PRIVATE" = "false" ]; then
      echo "Package is public. Publish to npm? (operator must confirm)"
    fi
  fi
fi
```

## PHASE 5: POST-RELEASE

### 5.1 Release Summary

```
╔══════════════════════════════════════════╗
║           RELEASE COMPLETE               ║
╠══════════════════════════════════════════╣
║  Version:    vX.X.X                      ║
║  Tag:        vX.X.X                      ║
║  Branch:     main                        ║
║  Target:     GitHub / Gitea / other      ║
║  Remote:     origin ✅                   ║
║  Release:    created ✅ / manual         ║
║  npm:        published ✅ / skipped      ║
║  Commits:    N included                  ║
╚══════════════════════════════════════════╝
```

### 5.2 Update Golem State

```bash
# Log the release
mkdir -p .golem/logs
cat > ".golem/logs/release-$(date +%Y%m%d-%H%M%S).md" << EOF
# Release v$NEW_VERSION

- **Date**: $(date -u +%Y-%m-%dT%H:%M:%SZ)
- **Branch**: $BRANCH
- **Previous**: $LAST_TAG
- **Type**: $BUMP_TYPE
- **Commits**: $(git log "$LAST_TAG"..HEAD~1 --oneline --no-merges | wc -l)

## Changelog
$(cat /tmp/changelog-entry.md)
EOF
```

### 5.3 Recommended Next Actions

After every release, remind the operator:
- Create a GitHub/Gitea release from the tag (if they use releases)
- Update any deployment configs that reference specific versions
- Notify the team (if applicable)
- If this was a major version: update dependent projects

## RULES

1. **NEVER tag without passing pre-flight.** No exceptions. Not even "it's just a docs change."
2. **NEVER force-push tags.** If a tag is wrong, create a new patch release. History is sacred.
3. **ALWAYS use annotated tags.** Lightweight tags are worthless for release tracking.
4. **ALWAYS verify the push.** A tag that didn't make it to remote doesn't exist.
5. **ASK before proceeding past pre-flight.** The operator gets final say on version number and go/no-go.
6. **Conventional commits drive the version.** If the team isn't using conventional commits, flag it as a process issue.
7. **Log everything.** Every release gets a log entry in `.golem/logs/`. No exceptions.
