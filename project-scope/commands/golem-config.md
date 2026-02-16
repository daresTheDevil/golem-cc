Show current configuration for this golem project.

## Steps

1. Read `.golem/config.json` (if it doesn't exist, note that defaults are in use)
2. Detect the project framework by checking for `nuxt.config.*` or `next.config.*`
3. Check which security tools are installed: `which gitleaks`, `which semgrep`, `which trivy`
4. Read `.golem/AGENTS.md` for the configured test/build/lint commands

## Output

Present the configuration as a clear summary:

```
Configuration (.golem/config.json):
  model:           {value} (default: opus)
  autoCommit:      {value} (default: true)
  simplifyOnBuild: {value} (default: true)

Project:
  Framework: {nuxt | next | none detected}
  Path:      {cwd}

Security Tools:
  gitleaks: {installed | not installed}
  semgrep:  {installed | not installed}
  trivy:    {installed | not installed}

AGENTS.md Commands:
  Test:  {command or "not configured"}
  Build: {command or "not configured"}
  Lint:  {command or "not configured"}
```

If `$ARGUMENTS` contains `set`, tell the user to use the terminal command instead: `npx golem config set <key> <value>`. Valid keys: `model`, `autoCommit`, `simplifyOnBuild`.

## Begin

Read the config file and gather project info now.
