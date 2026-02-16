Resume work from a previous session by reading the handoff document and project context.

## Steps

1. **Check for handoff document**
   - Read `.golem/HANDOFF.md`
   - If it doesn't exist, tell the user: "No handoff document found. Run `/golem:pause` to create one first, or start fresh with `/golem:status`."
   - Extract the timestamp/date from the handoff to show how fresh it is

2. **Load project context**
   - Read `.golem/AGENTS.md` for test/build/lint commands
   - Read `.golem/config.json` for current settings
   - Read `.golem/IMPLEMENTATION_PLAN.md` if it exists

3. **Read memory files**
   - Check for `.claude/projects/{project}/memory/MEMORY.md` and other memory files
   - Incorporate any gotchas or learnings from memory

4. **Present summary**
   - Show when the handoff was created (date/timestamp from handoff)
   - Current Focus: What was being worked on
   - Next Steps: What to do next (from the handoff)
   - Key Gotchas: Important things to remember
   - Plan Progress: If there's an implementation plan, show X/Y tasks complete

5. **Handle optional focus argument**
   - If `$ARGUMENTS` is provided, note it as the narrowed focus
   - Example: `/golem:continue "finish the pause/continue commands"`
   - Incorporate the argument into the summary and next steps

6. **Confirm before proceeding**
   - Ask the user: "Does this match your understanding? Should I proceed with these next steps, or would you like to redirect?"
   - Wait for user confirmation
   - DO NOT modify any files or start work until the user confirms

## Output Format

```
# Resuming Session

Handoff created: {date/time from handoff}

## Current Focus
{what was being worked on}

## Next Steps
{prioritized list of what to do next}

## Key Gotchas
{important caveats from handoff/memory}

## Plan Progress
{X}/{Y} tasks complete ({percent}%)

{if $ARGUMENTS provided:}
**Narrowed Focus:** {$ARGUMENTS}

---

Does this match your understanding? Should I proceed with these next steps, or would you like to redirect?
```

## Rules

- **Read-only until confirmed** — do not modify any files during the continue process
- Show the handoff timestamp so the user can judge if it's stale
- Keep the summary concise — hit the key points, don't reproduce the entire handoff
- If the handoff mentions specific files to read, read them to build deeper context before presenting the summary
- After user confirms, proceed with the work without additional ceremony

## Begin

Read the handoff document now. If it's missing, stop and tell the user to run `/golem:pause` first.
