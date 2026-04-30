# 0.2.2 — Skills CLI Compatibility Fix

**Date:** 2026-04-30

## What changed

### `SKILL.md` — frontmatter description quoted (bug fix)

The `description` field in the YAML frontmatter contained an unquoted plain scalar with a colon-space (`Triggers on: "..."`) embedded in the value. The `yaml` v2.8.3 library used by the Skills CLI (`vercel-labs/skills`) enforces strict YAML 1.2 and rejects colon-space sequences inside plain scalars — `parseSkillMd()` returned `null` for every install attempt, producing:

```
No valid skills found. Skills require a SKILL.md with name and description.
```

**Fix:** Wrapped the `description` value in single quotes. No content change to the body of `SKILL.md`.

Before:
```yaml
description: Generates production-ready Next.js TSX components...Triggers on: "create component"...
```

After:
```yaml
description: 'Production Next.js component generator. Converts HTML, TSX, images, and JSON into project-compliant components using your design system. Triggers on component creation, HTML/TSX conversion, page generation, image-to-component tasks, or any frontend code generation request. Requires a one-time scan to build design/design-arch.json.'
```

### `scripts/detect.sh` — Codex global install path added

The Skills CLI installs the `codex` platform globally to `~/.codex/skills/` (via `$CODEX_HOME`), not `~/.agents/skills/`. `detect.sh` was missing this path, so `SKILL_ROOT` detection silently failed for all global Codex installs.

Also added `~/.agentic/skills/ui-forge` (project and global) as a defensive fallback for CLI variants that use the `.agentic` directory.

New candidate order:
1. `$HOME/.agents/skills/ui-forge` — Codex/universal global (`-a codex` uses `.agents/skills`, the universal shared directory)
2. `$HOME/.agentic/skills/ui-forge` — agentic platform fallback (new)
3. `$HOME/.claude/skills/ui-forge` — Claude Code global
4. `$HOME/.codex/skills/ui-forge` — Codex-specific global fallback
5. `/etc/codex/skills/ui-forge` — system-wide Codex
6. `./.agents/skills/ui-forge` — project-local universal
7. `./.agentic/skills/ui-forge` — project-local agentic (new)
8. `./.claude/skills/ui-forge` — project-local Claude Code

### `SKILL.md` body — Codex CLI manual path confirmed

The "Advanced / Codex CLI / Non-Claude Code" section manual `SKILL_ROOT` path for Codex CLI correctly remains `$HOME/.agents/skills/ui-forge`. The `-a codex` target in the Skills CLI uses the universal `.agents/skills/` directory.

## Breaking changes

None.

## Files changed

- `SKILL.md` — frontmatter `description` quoted; Codex CLI path in body corrected
- `scripts/detect.sh` — `~/.codex/skills/ui-forge` added as first candidate; `~/.agentic/skills/ui-forge` added (project + global)
- `README.md` — version bump, changelog row added
