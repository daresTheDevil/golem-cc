#!/usr/bin/env bash
# Golem PreToolUse hook: Block destructive Bash commands
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
    *'rm -rf'*'/'*|*'rm -r '*'/'*|*'rm --recursive'*'/'*|\
    *'rm -rf ~'*|*'rm -r ~'*|\
    *'drop database'*|*'drop schema'*|*'drop table'*|\
    *'truncate '*|\
    *'> /dev/'*|*'mkfs'*|*'dd if'*|\
    *'git reset'*'--hard'*|\
    *'git clean'*'-f'*|\
    *'git checkout'*'-- .'*)
      echo 'BLOCKED: Destructive command detected' >&2
      exit 2
      ;;
    *)
      exit 0
      ;;
  esac
}
