# 0.2.4 — Platform-Aware Install & Cross-Platform Skill Root Detection

Resolves issues I-1 and I-2: `$SKILL_ROOT` was an unresolved placeholder that crashed
on Windows, and `cli.js install` always wrote to `.claude/` regardless of which agentic
platform the skill was actually installed into.

## Bug Fixes

### `cli.js install` now auto-detects the agentic platform

`install()` previously hardcoded all output to `.claude/commands/`, `.claude/settings.json`,
and the Bash permission `Bash(node .claude/skills/ui-forge/scripts/*)`. If the skill was
installed under `.agents/skills/ui-forge/` (Codex CLI) or any other platform, the install
wrote to the wrong directory and added a permission for a path that didn't exist.

**Fix:** A new `resolvePlatform(cwd)` function normalizes `SKILL_ROOT` (which is
`dirname(dirname(__dirname))` — the skill's own location on disk) and matches it against
all known agentic platform path segments. It returns the correct `platformDir` and
`relSkill` for the detected install location. If the skill is in a global location, it
falls back to `.claude/` in the current working directory.

Supported platforms and their resolved output directories:

| Platform | Skill path | Writes to |
|----------|-----------|-----------|
| Claude Code | `.claude/skills/ui-forge` | `.claude/` |
| Codex / universal | `.agents/skills/ui-forge` | `.agents/` |
| GitHub Copilot | `.github/skills/ui-forge` | `.github/` |
| Cursor IDE | `.cursor/skills/ui-forge` | `.cursor/` |
| OpenAI Codex | `.codex/skills/ui-forge` | `.codex/` |
| Copilot (alt) | `.copilot/skills/ui-forge` | `.copilot/` |
| Gemini | `.gemini/antigravity/skills/ui-forge` | `.gemini/antigravity/` |

The Bash permission string and all slash command bodies are also updated to reference the
actual `relSkill` path, so `node .agents/skills/ui-forge/scripts/scan.js` is generated
for a Codex install rather than the wrong `.claude/` path.

### Cross-platform install bootstrap — no more `$SKILL_ROOT` placeholder

The documented install command was `node "$SKILL_ROOT/scripts/cli.js" install`, but
`$SKILL_ROOT` is never automatically set by `npx skills add`. On Windows PowerShell,
undefined variables evaluate to empty string, making the path `C:\scripts\cli.js` and
crashing immediately.

**Fix:** README and CLAUDE.md now document short cross-platform one-liners that discover
`cli.js` by checking all known platform directories in order:

```sh
# sh / bash — run from project root:
for d in .claude .agents .github .cursor .codex .copilot; do
  [ -f "$d/skills/ui-forge/scripts/cli.js" ] && node "$d/skills/ui-forge/scripts/cli.js" install && break
done
```

```powershell
# PowerShell / Windows — run from project root:
@('.claude','.agents','.github','.cursor','.codex','.copilot') | % { "$_\skills\ui-forge\scripts\cli.js" } | ? { Test-Path $_ } | select -f 1 | % { node $_ install }
```

## New Files

### `scripts/detect.js` — Node.js cross-platform skill root detector

A new `scripts/detect.js` script mirrors the detection logic of `detect.sh` in pure
Node.js, making it usable on Windows and in any environment where POSIX shell is
unavailable.

Detection priority:
1. Env vars: `CLAUDE_SKILL_DIR`, `CLAUDE_PLUGIN_ROOT`, `SKILL_ROOT`
2. Project-local paths (all 8 supported platforms, relative to `cwd`)
3. Global paths (`os.homedir()` — works correctly on Windows with `%USERPROFILE%`)

CLI usage: `node scripts/detect.js` — prints the skill root to stdout; exits 1 with an
actionable error if not found. Also exports `detectSkillRoot()` for module use.

## Improvements

### `detect.sh` — all agentic platforms covered

`detect.sh` previously only checked `.agents/`, `.agentic/`, `.claude/` (project-local)
and `~/.agents/`, `~/.agentic/`, `~/.claude/` (global). Missing platforms that are now
included:

- Project-local: `.github/skills/ui-forge`, `.cursor/skills/ui-forge`,
  `.codex/skills/ui-forge`, `.copilot/skills/ui-forge`,
  `.gemini/antigravity/skills/ui-forge`
- Global: `~/.copilot/skills/ui-forge`, `~/.cursor/skills/ui-forge`,
  `~/.gemini/antigravity/skills/ui-forge`

Env var detection now also checks `CLAUDE_PLUGIN_ROOT` in addition to `CLAUDE_SKILL_DIR`
and `SKILL_ROOT`.
