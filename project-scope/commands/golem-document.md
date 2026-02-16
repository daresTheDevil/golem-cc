You are running a full documentation pass for this project. Your goal is to detect the project type, add inline code documentation, generate markdown docs, update the changelog, and update the README.

## Rules

- Do NOT change any code behavior — documentation only
- Do NOT touch test files, generated files, lock files, or node_modules
- Do NOT delete existing markdown documentation — archive deprecated content to `{docsPath}/deprecated/` with a deprecation date
- Do NOT add type annotations to JavaScript files
- Preserve existing accurate documentation — only update what has drifted from the code
- Documentation should be educational and clear, not boilerplate that restates function signatures

## Options

Parse `$ARGUMENTS` for these flags:

- `--path <dir>` — scope documentation to a subdirectory instead of the whole project
- `--inline-only` — only run inline code documentation (Phase 2), skip markdown generation
- `--markdown-only` — only run markdown generation (Phase 3+), skip inline docs
- `--docs-path <dir>` — override the output directory for markdown docs (default: `docs/` or `docsPath` from `.golem/config.json`)
- `--dry-run` — report what would be documented without making any changes

If no flags are provided, run the full documentation pass (all phases).

## Phase 1: Detect Project Type

Read `package.json`, `tsconfig.json`, `pyproject.toml`, and other manifest files to determine:

- **Language**: javascript, typescript, python
- **Framework**: vue, nuxt, react, next, none
- **Module system**: esm, commonjs, n/a
- **Database tooling**: prisma, drizzle, knex, sqlalchemy, alembic, raw-sql, none
- **Inline doc standard**: jsdoc, tsdoc, google-docstring, sql-comments

Report the detection results before proceeding.

## Phase 2: Inline Documentation (skip if `--markdown-only`)

Find all source files in the project (or scoped path). For each file:

1. Read the file completely
2. Add a file header comment explaining its purpose and role in the system
3. Add documentation to non-obvious functions, methods, classes, and types
4. Use the correct standard for the detected project type:
   - JavaScript/ESM: JSDoc (`/** ... */`)
   - TypeScript: TSDoc (`/** ... */`) with `@param`, `@returns`, `@example`
   - Vue/Nuxt SFCs: JSDoc in `<script>`, `<!-- -->` comments for non-obvious template/style sections
   - React/Next: JSDoc/TSDoc
   - Python: Google-style docstrings
   - SQL: `--` comment blocks on tables, columns, procedures
5. Skip trivially obvious functions (simple getters, self-documenting one-liners)
6. Document complex conditionals and non-obvious "why" decisions inline

After documenting files, run the test command from `.golem/AGENTS.md` to verify no behavior was changed. If tests fail, revert the changes that broke them.

## Phase 3: Markdown Documentation (skip if `--inline-only`)

Generate or update project documentation in the docs directory (`docs/` by default, or the path from `--docs-path` / `docsPath` config).

### Directory Structure

```
{docsPath}/
  index.md              — project overview
  architecture.md       — system design, component connections
  getting-started.md    — setup, install, prerequisites
  configuration.md      — all config options explained
  modules/
    {module-name}.md    — one per major module/component
  api/
    {resource}.md       — API reference (if project has endpoints)
  database/
    schema.md           — schema overview with relationships
  guides/
    setup.md            — dev environment setup
    {workflow}.md       — project-specific how-tos
  deprecated/
    {old-thing}.md      — archived docs with deprecation date
```

### Frontmatter

Every markdown file must include YAML frontmatter:

```yaml
---
title: "Page Title"
description: "Brief description"
navigation:
  order: 1
---
```

### Content Rules

- Only create docs for things that actually exist — no empty placeholders
- Explain behavior and usage — do not dump source code into docs
- Use standard CommonMark markdown, no platform-specific extensions
- Cross-link related docs where appropriate

## Phase 4: Changelog

Generate or update `CHANGELOG.md` at the project root from git history:

- Group by date with sections: **New Features**, **Improvements**, **Bug Fixes**
- Write in plain language for non-technical audiences (managers, stakeholders)
- No jargon — translate developer actions into user-facing impact
- Only include sections that have entries

## Phase 5: README

Generate or update `README.md` at the project root:

- Include project name and description
- Link into the docs directory for detailed documentation
- Preserve any existing user-written content outside of golem-generated markers

## Phase 6: Archive Deprecated

Check if any documented modules have been removed from the codebase. If so, move their docs to `{docsPath}/deprecated/` with:

- A `deprecated_date` field in frontmatter
- A `replaced_by` field (empty if no direct replacement)

## Phase 7: Summary

Present a summary of what was done:

- Number of source files documented inline
- Number of markdown files created or updated
- Number of commits included in changelog
- README action (created or updated)
- Number of deprecated docs archived

If `--dry-run` was specified, report what would have been done without making changes.

## Begin

Start by reading `.golem/config.json` for `docsPath` and model settings, then detect the project type (Phase 1). Announce that you're beginning the documentation pass.
