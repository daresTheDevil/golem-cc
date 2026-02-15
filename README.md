# Super Golem (`golem-cc`)

AI development workflow engine for [Claude Code](https://docs.anthropic.com/claude-code). Think of it as a mission control layer: structured discovery → specification → planning → autonomous build → release, with security scanning and quality gates at every step.


## Requirements

- **Node.js** >= 18
- **Claude Code** CLI (`claude`) installed and authenticated
- **python3**, **jq**, **git** — on PATH
- **pnpm** recommended (npm/npx works too)

## Install

```bash
# Install user scope (one time)
pnpm dlx golem-cc

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
golem init                          # auto-detects framework & databases
golem init --nuxt --pg              # or specify explicitly
golem init --next --oracle --mssql  # mix and match
golem init --php --ibmi             # legacy stack support
```

This creates project-scope files: slash commands, agents, project CLAUDE.md, MCP config, and `.golem/` state directory.

## Workflow

### Interactive (inside Claude Code)

```
claude
/golem-discuss "Add player journey analytics dashboard"
/golem-spec
/golem-plan
/golem-build
/golem-release minor
```

### Headless (from terminal)

```bash
golem discuss "Add player journey analytics dashboard"
golem spec
golem plan
golem build
golem release minor
```

Both paths produce the same artifacts in `.golem/` with the same quality gates.

## Commands

### Workflow

| Command | Description |
|---------|-------------|
| `golem discuss "topic"` | Interactive discovery session — explore requirements |
| `golem spec` | Generate specification from discussion |
| `golem plan` | Create implementation plan with task breakdown |
| `golem build` | Autonomous execution with TDD and security scanning |
| `golem release [patch\|minor\|major]` | Lint, test, tag, push, verify |
| `golem resume` | Continue an interrupted build |

### Intelligence

| Command | Description |
|---------|-------------|
| `golem status` | Mission status report |
| `golem sweep` | Proactive codebase health scan |
| `golem recon` | Codebase intelligence (works before `init`) |
| `golem diff` | Changes since last build |
| `golem log [N]` | Mission history (last N entries) |

### Maintenance

| Command | Description |
|---------|-------------|
| `golem version` | Show installed version |
| `golem update` | Pull latest golem-cc |
| `golem doctor` | Comprehensive installation diagnostic |
| `golem init --update` | Refresh project templates (preserve state) |
| `golem reset` | Clear state, keep config |
| `golem eject` | Remove golem from project cleanly |

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
- Project-specific database instructions
- State tracking (specs, plans, build progress)

This split prevents context window bloat. Golem loads everywhere (you always want security). Workflow commands only load where you need them.

### Supported Stacks

**Frameworks:** Nuxt 3, Next.js (App Router), Legacy PHP

**Databases:** PostgreSQL, Oracle, SQL Server, IBM i (AS400)

Auto-detected from `nuxt.config.*`, `next.config.*`, `*.php`, `package.json` dependencies, and `.env` files.

### Security

- Destructive command blocking via hooks (case-insensitive: `DROP TABLE`, `rm -rf /`, etc.)
- `.env` files denied from AI read access
- Credential/key files denied from AI read access
- Security scanning agent active in every session
- `semgrep` integration for static analysis (optional, recommended)

## Updating

```bash
golem update                  # pull latest from npm
golem init --update           # refresh project templates (in each project)
golem doctor                  # verify everything
```

## Uninstalling

```bash
# Remove from a project
golem eject

# Remove user scope
rm -rf ~/.golem
# Then manually remove golem entries from ~/.claude/CLAUDE.md,
# ~/.claude/settings.json, and ~/.claude/agents/security-scanner.md
```

## License

MIT
