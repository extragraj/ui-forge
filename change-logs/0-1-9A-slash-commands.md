# 0.1.9A — Slash commands for Claude Code

Released 2026-04-27.

## Summary

Adds three Claude Code slash commands that replace the `SKILL_ROOT` bash dance for Claude Code users. Codex CLI compatibility is preserved via `scripts/detect.sh` (unchanged).

## What changed

### `commands/forge-scan.md` — new

Slash command: `/forge-scan [--theme shadcn|mantine|plain-tailwind] [--schema-v4] [--quick]`

Runs `scripts/scan.js` via `$CLAUDE_PLUGIN_ROOT`. Equivalent to the manual `node "$SKILL_ROOT/scripts/scan.js"` invocation.

### `commands/forge.md` — new

Slash command: `/forge --task "<task>" --refs <path[,path]> --output <path>`

Runs `scripts/invoke.js` via `$CLAUDE_PLUGIN_ROOT`. All existing flags (`--rescan`, `--replan`, `--diff`, `--a11y`, `--creative`, `--signal`, `--preview`, `--verify`) pass through via `$ARGUMENTS`.

### `commands/forge-verify.md` — new

Slash command: `/forge-verify <component.tsx> <contract.ts> [--playwright <url>]`

Runs `scripts/verify.js` via `$CLAUDE_PLUGIN_ROOT`.

### `SKILL.md` — restructured Usage section

- Slash command examples now lead the Usage section.
- Bash-based invocations moved to a dedicated "Advanced / Codex CLI / Non-Claude Code" subsection.
- Resolve Skill Root preamble removed from top-level flow (retained inside the advanced subsection).

## Backwards compatibility

- No changes to `scripts/scan.js`, `scripts/invoke.js`, `scripts/verify.js`, or any signal logic.
- `scripts/detect.sh` unchanged — Codex CLI flow unaffected.
- StackShift paired-mode detection, `a11yRequired`, and all signal modifiers behave identically.
- This is a developer-experience release, not a generation-behaviour change.
