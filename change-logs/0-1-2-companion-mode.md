# 0.1.2 — Companion Mode

**Date:** 2026-04-14

## Summary

Adds `CONVERT_VARIANT` signal and `--mode body-only` for companion-skill invocation. UI Forge can now be called by workflow skills (e.g. StackShift) that have already scaffolded the output file and exported a props interface — generating only the component body that implements the contract.

## Changes

### `CONVERT_VARIANT` signal
- New primary signal alongside `CONVERT_SECTION` and `CONVERT_PAGE`
- Auto-detected when refs contain exactly one `.ts`/`.tsx` file exporting an interface (<=150 lines) with no HTML/image layout refs
- Can also be forced with `--signal CONVERT_VARIANT`
- Mutually exclusive with `CONVERT_PAGE` — never composes
- Composes with `+CONFIG` and `+IMAGE` modifiers
- Uses dedicated `SIGNAL_VARIANT` addendum from `prompt-patterns.md`

### `--signal` flag
- New CLI flag to force primary signal: `CONVERT_SECTION`, `CONVERT_PAGE`, or `CONVERT_VARIANT`
- Overrides auto-detection entirely

### `--mode body-only`
- New CLI flag: `full` (default) or `body-only`
- `body-only` requires `--output` to point at an existing file (errors if absent)
- Preserves existing import statements and export signature skeleton
- Replaces only the function body
- Default mode under `CONVERT_VARIANT` (override with `--mode full`)

### `designStandards` injection
- All `designStandards` entries are now labeled with provenance: `// --- STANDARD: keyName ---`
- Under `CONVERT_VARIANT`, standards are injected at the highest resolution priority, above the props interface

### Page-pipeline guard
- `--signal CONVERT_VARIANT` suppresses all page-pipeline triggers (keyword "page", >400 lines)
- Ambiguous auto-detection (interface file + page triggers) exits with an error asking for explicit `--signal`
- `design/forge-page-plan.json` is never written under `CONVERT_VARIANT`

### `${CLAUDE_SKILL_DIR}` resolution
- SKILL.md now documents all four install paths (Claude Code project/global, Agents project/global)
- Example invocations use concrete `.claude/skills/ui-forge/` paths with a note to adapt
- Invoke.js header comments updated accordingly

### Companion Invocation section
- New section in SKILL.md documenting how workflow skills should invoke ui-forge
- Documents expected call shape: `--signal CONVERT_VARIANT --mode body-only`
- States what ui-forge will and will not modify

### Version and compatibility
- `skill.version` bumped to `0.1.2`
- SKILL.md footer: `Consumed by (companion mode): stackshift-workflow-skills >=0.1.5`
