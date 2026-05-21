# 1.3.1 — Per-platform skill path in multi-platform install

**Date:** 2026-05-21

---

## Problem

The 1.1.0 multi-platform install wired slash commands and Bash permissions into every agentic platform directory present in `cwd` (`.claude`, `.agents`, `.cursor`, …). However, it resolved the skill path **once** — based on where the skill itself lived — and used that single path inside **every** platform's command files.

So if the skill was installed at `.agents/skills/ui-forge/` and the project also had a `.claude/` directory, the install wrote:

```markdown
# .claude/commands/forge-scan.md  (BEFORE)
---
description: Scan the project and create design/design-arch.json
---

!`node .agents/skills/ui-forge/scripts/scan.js $ARGUMENTS`
```

The `.claude/` slash command referenced `.agents/skills/ui-forge/...`. It worked (Node resolves the path either way), but it was wrong-looking, confusing, and brittle — if the user later removed the `.agents/` install, every `.claude/` slash command would silently break.

## Fix

`cli.js install` now resolves the skill path **per target platform**:

1. **Local match first.** If the skill is installed at that platform's own location (e.g. `.claude/skills/ui-forge` for the `.claude` platform target), use the platform-local relative path. Each platform stays self-contained.
2. **Fallback to the actual skill location.** Otherwise use wherever the skill actually lives — another platform's relative path (e.g. `.agents/skills/ui-forge`), or the absolute `SKILL_ROOT` for global installs.

The Bash permission added to each platform's `settings.json` is now scoped to its own resolved path. Install output surfaces the resolved `relSkill` per target so the wiring is explicit:

```
Commands written to /proj/.claude/commands (skill: .claude/skills/ui-forge):
  ...
Settings: /proj/.claude/settings.json
  Permission added: Bash(node .claude/skills/ui-forge/scripts/*)

Commands written to /proj/.agents/commands (skill: .agents/skills/ui-forge):
  ...
Settings: /proj/.agents/settings.json
  Permission added: Bash(node .agents/skills/ui-forge/scripts/*)
```

## Verified scenarios

| # | Setup | `.claude/commands/forge-scan.md` references | `.agents/commands/forge-scan.md` references |
|---|-------|---------------------------------------------|---------------------------------------------|
| A | Skill at `.agents/` only, `.claude/` empty | `.agents/skills/ui-forge` (fallback) | `.agents/skills/ui-forge` |
| B | Skill at both `.claude/` and `.agents/` | `.claude/skills/ui-forge` ✓ | `.agents/skills/ui-forge` ✓ |
| C | Global skill, both platform dirs exist in project, no local skill | absolute `SKILL_ROOT` | absolute `SKILL_ROOT` |
| D | Global skill, fresh project (no platform dirs) | absolute `SKILL_ROOT` (default `.claude/` created) | — |
| E | Hybrid: global launcher invoked, but local skill exists at `.claude/skills/ui-forge` | `.claude/skills/ui-forge` (local wins) ✓ | absolute `SKILL_ROOT` (no local at `.agents/`) ✓ |

Each platform's `settings.json` gets a Bash permission scoped to **its own** resolved skill path — not the resolved path of whichever platform happened to launch the install.

## No impact on the MCP server (1.3.0)

The 1.3.0 MCP server (`scripts/mcp-server.js`) and `mcp` / `mcp-config` subcommands are unchanged. `mcp-config` already used the absolute `SKILL_ROOT` for the printed snippet (correct, because MCP client configs are launched by the client itself and don't have a project-relative cwd). No StackShift workflow skill changes are needed for either 1.3.0 or 1.3.1 — both are additive to the existing shell invocation paths.

---

## Files Changed

| File | Change |
|------|--------|
| `scripts/cli.js` | New `relSkillForPlatform(cwd, platformDir, fallbackRelSkill)` helper; `install()` loop now computes `relSkill` and the Bash permission per target platform instead of using one resolved path for all of them; install output surfaces the resolved skill path per target. |
| `skill.version` | 1.3.0 → 1.3.1 |
| `package.json`, `README.md`, `SKILL.md` | Version synced; README changelog updated. |
