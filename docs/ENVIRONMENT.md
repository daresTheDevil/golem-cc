# Environment Variables

Golem respects several environment variables that control its behavior.

---

## Core Variables

### `GOLEM_HOME`

**Purpose:** Override the default location of golem's installation directory.

**Default:** `~/.golem`

**Valid Values:** Any absolute directory path

**Examples:**
```bash
# Use custom location
export GOLEM_HOME=/opt/golem
pnpm dlx golem-cc

# Per-project override (not recommended)
GOLEM_HOME=./.local-golem golem init
```

**Use Cases:**
- Installing golem in a non-standard location
- Testing multiple golem versions side-by-side
- Corporate environments with custom home directories

**Security Warning:**
⚠️ **Do NOT set GOLEM_HOME to system directories** like `/`, `/usr`, `/bin`, `/etc`, etc.
Golem will refuse to install in these locations.

**Risks:**
- Setting to a shared directory could expose credentials
- Setting to a system directory could cause permission errors
- Changing GOLEM_HOME breaks PATH (golem won't be found)

**Recommendation:** Use default unless you have a specific reason.

---

### `HOME`

**Purpose:** Your user home directory (set by the OS).

**Default:** Set by operating system (e.g., `/Users/username` on macOS)

**Valid Values:** Absolute directory path (managed by OS)

**Usage:**
Golem uses `$HOME` to:
- Determine default GOLEM_HOME (`$HOME/.golem`)
- Locate Claude Code config (`$HOME/.claude`)
- Expand `${HOME}` and `$HOME` in JSON configs

**Examples:**
```bash
# Normal usage (don't override this)
echo $HOME
# /Users/dkay

# Golem uses it automatically
ls $HOME/.golem
ls $HOME/.claude
```

**Warning:**
⚠️ **Never override `$HOME` when running golem commands.**
This will break file path resolution and config loading.

---

### `PATH`

**Purpose:** Shell search path for executables.

**Golem Addition:** `$HOME/.golem/bin`

**How It's Set:**
During installation, golem-cc appends this line to your shell RC file:
```bash
export PATH="$PATH:$HOME/.golem/bin"
```

**Verify PATH Includes Golem:**
```bash
echo $PATH | grep -o '.golem/bin'
# Output: .golem/bin
```

**Manual PATH Configuration:**
If installer didn't update PATH automatically:

```bash
# For zsh (macOS default)
echo 'export PATH="$PATH:$HOME/.golem/bin"' >> ~/.zshrc
source ~/.zshrc

# For bash (Linux default)
echo 'export PATH="$PATH:$HOME/.golem/bin"' >> ~/.bashrc
source ~/.bashrc

# Verify
which golem
# /Users/dkay/.golem/bin/golem
```

**Troubleshooting:**
- If `golem` command not found: PATH not configured or terminal not restarted
- Run: `source ~/.zshrc` (or `~/.bashrc`) then retry
- Or: restart terminal

---

## Display Variables

### `NO_COLOR`

**Purpose:** Disable ANSI color codes in output (for CI/CD, logs, accessibility).

**Default:** Unset (colors enabled)

**Valid Values:**
- Any value = colors disabled
- Unset = colors enabled

**Standard:** Follows [NO_COLOR](https://no-color.org/) specification.

**Examples:**
```bash
# Disable colors
NO_COLOR=1 golem doctor

# Works with any value
NO_COLOR=true golem status
NO_COLOR=0 golem help      # Even "0" disables (any value counts)
NO_COLOR= golem init       # Empty string also disables

# Re-enable colors
unset NO_COLOR
golem doctor
```

**Use Cases:**
- CI/CD pipelines (Jenkins, GitHub Actions, etc.)
- Log files (ANSI codes clutter logs)
- Screen readers / accessibility tools
- Terminals that don't support color

**Precedence:**
`NO_COLOR` overrides all color output. There's no way to force colors when `NO_COLOR` is set.

**Automatic Detection:**
Some terminals auto-set `NO_COLOR` if they don't support color. Golem respects this.

---

## Optional Variables

### `XDG_CONFIG_HOME`

**Purpose:** XDG Base Directory specification for config files.

**Status:** ❌ Not currently supported (planned for future release)

**Planned Behavior:**
- If set, use `$XDG_CONFIG_HOME/golem` instead of `~/.golem`
- Follows Linux FreeDesktop.org standards

**Current Workaround:**
```bash
# Use GOLEM_HOME instead
export GOLEM_HOME=$XDG_CONFIG_HOME/golem
pnpm dlx golem-cc
```

---

## Internal Variables (Do Not Override)

These variables are used internally by golem. **Do not set them manually.**

### `PKG_ROOT` (internal)
Used by golem-cc installer to locate package files.

### `PKG_VERSION` (internal)
Parsed from package.json during install.

### `CLAUDE_HOME` (internal)
Computed as `$HOME/.claude`. Do not override.

---

## Environment Variable Priority

When multiple config mechanisms exist, golem uses this priority:

1. **Command-line flags** (highest priority)
   ```bash
   golem status --json
   ```

2. **Environment variables**
   ```bash
   NO_COLOR=1 golem status
   ```

3. **Config files**
   - `~/.claude/settings.json` (global)
   - `.claude/settings.local.json` (project-specific)

4. **Defaults** (lowest priority)

---

## CI/CD Examples

### GitHub Actions
```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    env:
      NO_COLOR: 1
    steps:
      - uses: actions/checkout@v3
      - run: pnpm dlx golem-cc
      - run: golem doctor
```

### GitLab CI
```yaml
test:
  variables:
    NO_COLOR: "1"
  script:
    - pnpm dlx golem-cc
    - golem init
    - golem doctor
```

### Jenkins
```groovy
pipeline {
  environment {
    NO_COLOR = '1'
    PATH = "${env.HOME}/.golem/bin:${env.PATH}"
  }
  stages {
    stage('Install Golem') {
      steps {
        sh 'pnpm dlx golem-cc'
      }
    }
  }
}
```

---

## Docker Examples

### Dockerfile
```dockerfile
FROM node:20-alpine

# Install golem
RUN npm install -g pnpm
RUN pnpm dlx golem-cc

# Set PATH
ENV PATH="/root/.golem/bin:${PATH}"

# Disable colors for logs
ENV NO_COLOR=1

# Verify
RUN golem doctor
```

### docker-compose.yml
```yaml
version: '3'
services:
  app:
    image: node:20
    environment:
      - NO_COLOR=1
      - PATH=/root/.golem/bin:${PATH}
    volumes:
      - ./:/app
    command: golem build
```

---

## Security Best Practices

### ✅ Safe
```bash
# Use defaults
pnpm dlx golem-cc

# Disable colors
NO_COLOR=1 golem doctor

# Override golem location to user-writable directory
export GOLEM_HOME=/opt/custom/golem
```

### ❌ Unsafe
```bash
# NEVER do this
sudo GOLEM_HOME=/usr/local/golem pnpm dlx golem-cc
# Risk: System directory, elevated privileges

# NEVER do this
export GOLEM_HOME=/
# Risk: Writes to root filesystem

# NEVER do this in production
export GOLEM_HOME=/tmp/golem
# Risk: Ephemeral storage, lost on reboot
```

---

## Debugging

### Check Current Environment
```bash
# Show all golem-related variables
env | grep -i golem

# Show HOME
echo $HOME

# Show PATH (check if .golem/bin is included)
echo $PATH | tr ':' '\n' | grep golem

# Show NO_COLOR status
echo ${NO_COLOR:-"not set"}
```

### Reset to Defaults
```bash
# Unset custom variables
unset GOLEM_HOME
unset NO_COLOR

# Reload shell config
source ~/.zshrc  # or ~/.bashrc

# Verify defaults
golem doctor
```

---

## Summary Table

| Variable | Default | Required | Override Safe? | Purpose |
|----------|---------|----------|----------------|---------|
| `HOME` | OS-managed | Yes | ❌ No | User home directory |
| `GOLEM_HOME` | `~/.golem` | No | ✅ Yes | Golem install location |
| `PATH` | Shell-managed | Yes | ⚠️ Append only | Executable search path |
| `NO_COLOR` | Unset | No | ✅ Yes | Disable ANSI colors |
| `XDG_CONFIG_HOME` | Unset | No | ⚠️ Planned | XDG config directory |

---

**Document Version:** 1.0.0 (golem-cc v4.5.0)
**Last Updated:** 2026-02-15
