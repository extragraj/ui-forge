# 0.1.9 — Cross-agent skill-root compatibility for Codex CLI and Claude Code

Released 2026-04-27.

## Summary

This release fixes the main cross-agent portability break in the skill docs: the skill previously assumed a Claude-specific install path or runtime variable in command examples, which made the documented flow fail under Codex CLI.

Two repo changes landed:

1. **`scripts/detect.sh` added** — a portable shell helper that resolves the installed UI Forge skill root across Claude Code and Codex CLI locations.
2. **`SKILL.md` replaced** — all documented commands now run through `SKILL_ROOT`, and the operating flow starts with an explicit skill-root resolution step.

The result is a single documented setup path that works across both agents instead of requiring users to manually rewrite every command example.

## What changed

### 1. `scripts/detect.sh` — new cross-agent resolver

New file: `scripts/detect.sh`

Behaviour:

- Uses the injected Claude skill directory first when available and valid.
- Falls back through common Codex and Claude global/project install locations.
- Prints the resolved absolute skill root to stdout on success.
- Exits `1` with actionable install instructions when no valid install is found.

Search order:

1. Runtime-injected Claude skill dir
2. `~/.agents/skills/ui-forge`
3. `~/.claude/skills/ui-forge`
4. `/etc/codex/skills/ui-forge`
5. `./.agents/skills/ui-forge`
6. `./.claude/skills/ui-forge`

This gives the docs a single stable command shape:

```bash
SKILL_ROOT="$(sh ./scripts/detect.sh)"
```

### 2. `SKILL.md` rewritten around `SKILL_ROOT`

The skill entrypoint now starts with a required **Resolve Skill Root** section near the top, before any scan or invoke commands.

Key documentation changes:

- Replaced path-specific command examples with `"$SKILL_ROOT/..."` forms.
- Added an explicit verification command: `ls "$SKILL_ROOT/scripts/scan.js"`.
- Added manual fallback examples for Codex and Claude global installs.
- Removed the prior install-scope explanation that depended on agent-specific path assumptions.
- Simplified the operating spec to focus on the portable path-resolution workflow.

## Why this matters

Before this change, the documented examples depended on Claude-oriented path conventions and environment assumptions. That was acceptable for Claude Code sessions but brittle for Codex CLI users, who do not share the same automatic skill-path setup.

After this release:

- Codex users have an explicit first-step setup path.
- Claude users still get a compatible resolution flow.
- All documented `scan.js` and `invoke.js` examples share one portable variable.

## Files changed

- `scripts/detect.sh` — NEW cross-agent skill-root detection helper.
- `SKILL.md` — fully replaced to use `SKILL_ROOT` throughout and front-load path resolution.
- `README.md` — changelog table row added for `0.1.9`.

## Backwards compatibility

- No changes to `scripts/scan.js`, `scripts/invoke.js`, or signal logic.
- No changes to `references/`, `design/`, examples, or validation tooling.
- Existing Claude-based usage still works; the docs are now explicit instead of implicit.
- This is a documentation and portability release, not a generation-behaviour change.
