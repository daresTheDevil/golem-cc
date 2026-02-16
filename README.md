# Golem (`golem-cc`)

AI development workflow engine for [Claude Code](https://docs.anthropic.com/claude-code). Think of it as a mission control layer: structured discovery → specification → planning → autonomous build → release, with security scanning and quality gates at every step.

**Current version:** 0.1.1

## What's New

- **Rich Error Context** — Every error includes: what broke, why it matters, how to fix, diagnostics
- **Integrity Verification** — SHA-256 checksums protect against corrupted installs
- **Repair Command** — `golem repair` fixes broken installations automatically
- **JSON Output Modes** — `--json` flag for CI/CD integration (status, doctor, log commands)
- **NO_COLOR Support** — Standards-compliant color disabling for logs and accessibility
- **Comprehensive Documentation** — Troubleshooting, environment vars, hooks, workflow examples

---

## Requirements

- **Node.js** >= 18
- **Claude Code** CLI (`claude`) installed and authenticated
- **jq** — required for security hooks
- **git** — required
- **python3** — optional (used by some tools)
- **pnpm** recommended (npm/npx works too)

## Install

```bash
# Install user scope (one time)
pnpm dlx @daresthedevil/golem-cc

# Restart your terminal (or source ~/.zshrc), then:
golem doctor    # verify everything's working
```

This installs:
- `~/.claude/CLAUDE.md` — Golem personality and standing orders
- `~/.claude/settings.json` — Global hooks, permissions, env vars
- `~/.claude/agents/security-scanner.md` — Always-on security agent
- `~/.mcp.json` — Global MCP servers (context7)
- `~/.golem/bin/golem` — The CLI
- `~/.golem/skills/` — Framework and database reference docs
- `~/.golem/templates/` — Project-scope templates

## Project Setup

```bash
cd your-project
golem init              # auto-detects framework & databases from project files
golem init --nuxt --pg  # explicit stack selection (skips auto-detection)
```

### Init Flags

| Flag | Stack |
|------|-------|
| `--nuxt` | Nuxt 3 |
| `--next` | Next.js (App Router) |
| `--php` | Legacy PHP |
| `--pg` | PostgreSQL |
| `--oracle` | Oracle |
| `--mssql` | SQL Server |
| `--ibmi` | IBM i (AS400) |

Without flags, auto-detection checks: `nuxt.config.*`, `next.config.*`, `composer.json`, `package.json` dependencies, and `.env.example` for database hints.

This creates project-scope files: slash commands, agents, project CLAUDE.md (with linked skill references), MCP config, and `.golem/` state directory.

## Workflow

### Interactive (inside Claude Code)

```
claude
/golem-discuss "Add user analytics dashboard"
/golem-spec
/golem-plan
/golem-build
/golem-release minor
```

### Headless (from terminal)

```bash
golem discuss "Add user analytics dashboard"
golem spec
golem plan
golem build
golem release minor
```

Both paths produce the same artifacts in `.golem/` with the same quality gates.

## Commands

### Workflow (run in order)

| Command | Description |
|---------|-------------|
| `golem discuss "topic"` | 1. Interactive discovery session — explore requirements |
| `golem spec` | 2. Generate specification from discussion |
| `golem plan` | 3. Create implementation plan with task breakdown |
| `golem build` | 4. Autonomous execution with TDD and security scanning |
| `golem release [patch\|minor\|major]` | 5. Lint, test, tag, push, verify |
| `golem resume` | Continue an interrupted build |

### Intelligence

| Command | Description |
|---------|-------------|
| `golem status [--json]` | Mission status report (JSON mode for CI/CD) |
| `golem sweep` | Proactive codebase health scan (security, quality, coverage) |
| `golem recon` | Codebase intelligence (works before `init`) |
| `golem diff` | Show git diff summary |
| `golem log [N] [--json]` | Show last N build/session log entries (JSON mode available) |

### Maintenance

| Command | Description |
|---------|-------------|
| `golem version` | Show installed version |
| `golem update` | Pull latest golem-cc |
| `golem doctor [--json]` | Comprehensive installation diagnostic (JSON mode for CI/CD) |
| `golem repair [--dry-run] [--force]` | Repair broken GOLEM_HOME installation |
| `golem reset` | Clear state, keep config |
| `golem eject` | Remove golem from project cleanly |
| `golem uninstall` | Remove golem from this machine entirely |
| `golem help <cmd>` | Detailed help for a specific command |

## Architecture

### User Scope vs Project Scope

**User scope** (`~/.claude/`, `~/.golem/`) — installed once, active everywhere:
- Golem personality (CLAUDE.md with standing orders)
- Security scanning agent (runs in every session)
- Global hooks (destructive command blocking, file change logging)
- Environment tuning (thinking tokens, output tokens, bash timeouts)

**Project scope** (`.claude/`, `.golem/`, `CLAUDE.md`) — per project:
- Slash commands customized to your stack
- Agents that know your framework (Nuxt test-writer vs Next test-writer)
- Project-specific database instructions and skill references
- State tracking (specs, plans, build progress)

This split prevents context window bloat. Golem loads everywhere (you always want security). Workflow commands only load where you need them.

### Supported Stacks

**Frameworks:** Nuxt 3, Next.js (App Router), Legacy PHP

**Databases:** PostgreSQL, Oracle, SQL Server, IBM i (AS400)

Auto-detected from `nuxt.config.*`, `next.config.*`, `composer.json`, `package.json` dependencies, and `.env.example` files.

### Security

- Destructive command blocking via hooks (`DROP TABLE`, `rm -rf /`, `git push --force`, etc.)
- Hooks require `jq` and block execution if `jq` is missing (fail-secure)
- `.env` files denied from AI read access (`.env.example` allowed)
- Credential/key files denied from AI read access
- Security scanning agent active in every session
- `semgrep` integration for static analysis (optional, recommended)

## Production / High-Security Environments

By default, MCP server versions in `~/.mcp.json` use `@^` semver ranges (e.g. `@^1.0.0`), which auto-resolve to the latest compatible version. For high-security or regulated environments, pin to exact versions:

```json
"@upstash/context7-mcp@1.2.3"
```

Run `npm view @upstash/context7-mcp version` to find the current version, then replace the `@^` range with the exact version string.

## Updating

```bash
golem update    # pull latest from npm
golem doctor    # verify everything
```

## Uninstalling

```bash
# Remove from a project
golem eject --confirm

# Remove everything (user scope + CLI)
golem uninstall --confirm
```

`golem uninstall` restores any `.pre-golem` backup files, removes `~/.golem/`, cleans the PATH entry from your shell RC file, and removes golem-managed files from `~/.claude/`.

## Documentation

Comprehensive guides in `docs/`:

- **[TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)** — Common failures and fixes (Symptom → Diagnosis → Fix → Prevention)
- **[ENVIRONMENT.md](docs/ENVIRONMENT.md)** — Environment variables (GOLEM_HOME, NO_COLOR, PATH, etc.)
- **[EXAMPLES.md](docs/EXAMPLES.md)** — Complete workflow examples (interactive, headless, CI/CD)
- **[HOOKS.md](docs/HOOKS.md)** — Git hook architecture and customization

## Roadmap

- `golem init --update` — refresh project templates while preserving state
- CLAUDE.md template variants (`--template saas`, `--template startup`)
- Community skills registry

## License

MIT
