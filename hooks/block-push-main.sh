#!/usr/bin/env bash
# Golem PreToolUse hook: Block direct pushes to main/master and force pushes
# Reads Claude Code tool JSON from stdin, checks .tool_input.command
# Exit 0 = allow, Exit 2 = block

command -v jq >/dev/null 2>&1 || {
  echo 'BLOCKED: jq required for safety hooks. Install jq.' >&2
  exit 2
}

jq -r '.tool_input.command // empty' | {
  IFS= read -r -d '' cmd || true
  cmd_lower=$(printf '%s' "$cmd" | tr '[:upper:]' '[:lower:]' | tr '\n' ' ')

  case "$cmd_lower" in
    *'git push'*' main'*|\
    *'git push'*' master'*)
      echo 'BLOCKED: Direct push to main/master. Use feature branches.' >&2
      exit 2
      ;;
    *'git push'*'--force-with-lease'*)
      exit 0
      ;;
    *'git push'*'--force'*|\
    *'git push'*'-f'*)
      echo 'BLOCKED: Force push detected. Use --force-with-lease for safety.' >&2
      exit 2
      ;;
    *)
      exit 0
      ;;
  esac
}
