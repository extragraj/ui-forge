# 1.6.5 — Reinstall Cleanup

## Highlights

Reinstalling UI Forge is now much cleaner: deselecting a feature, switching platforms, or changing your theme no longer leaves stale files, commands, permissions, or hooks behind. Several edge cases in the MCP wiring, scan prompt, and command surface were also fixed.

---

## Fixes

### Deselected features no longer leave stale command files

When a user re-installs and deselects an optional feature (e.g. `export-design` or `fetch-handoff`), the corresponding slash command file (`forge-export-design.md`, `forge-handoff.md`) is now removed from every platform's commands directory. Previously only the script files were pruned; the command files were left behind.

Only files that carry the ui-forge provenance header are removed — user-customized command files are left untouched.

### Deselected platforms are fully cleaned up (including retroactively)

When a platform is removed from the install selection (e.g. going from `[claude, agents]` to `[claude]`), the following are now removed for each deselected platform:

- All skill files under `<platform>/skills/ui-forge/` (tracked via lockfile)
- All provenance-owned command files under `<platform>/commands/`
- All ui-forge entries in `<platform>/settings.json` `permissions.allow`
- All ui-forge hooks in `<platform>/settings.json` `hooks.PostToolUse`

Empty skill and command directories are pruned after file removal. Scope changes (project ↔ global) are handled correctly by reading the prior install's scope from the lockfile.

Additionally, an **orphan detection** pass now runs on every install: all known platform skill dirs are scanned and any that exist on disk but are not in the current selection are cleaned up — even if the lockfile was already overwritten in a prior run before this fix was available. Orphaned dirs are only removed if they contain `scripts/scan.js` or `SKILL.md` (ui-forge sentinels), so non-ui-forge directories are never touched.

### Theme change: forgeignore, standards, and design-arch.json are now updated

Previously, switching from `stackshift` (or any theme) to another did not clean up the old theme's artifacts:

- **`.forgeignore`** was left with the prior theme's content because the stackshift template has no provenance header and was treated as user-owned. Now, any theme or paired-mode change forces the forgeignore to be replaced with the new theme's template.
- **`design/standards/stackshift-ui/`** was left in place when switching away from stackshift. Provenance-owned files in the theme's standards subdirectory are now deleted on theme change. User-customized files (no provenance header) are preserved.
- **`design-arch.json` `_theme` key** was left pointing to the old theme until a scan ran. It is now reset immediately on theme change (non-fatal if the file doesn't exist).

### Paired mode artifacts cleaned up on un-pair

When re-installing with paired mode removed (`prior.paired: true → false`), the `themeChanged` path now catches the change in paired state and replaces the `.forgeignore` with the new template. The `ui-forge:stackshift-validate` PostToolUse hook was already removed correctly.

### MCP config file created when missing (Cline)

When a user selects Cline as an MCP client but has not yet opened Cline once (so `cline_mcp_settings.json` does not exist), the installer now creates the file with the minimal `{ "mcpServers": {} }` structure before patching the ui-forge entry in. Previously it silently skipped the client, leaving MCP unwired.

### Scan prompt always shown when theme is "None"

When the user selects "None" as the theme in interactive mode, the scan prompt is now shown unconditionally. Previously it was gated on the presence of a `tailwind.config.ts` or `tailwind.config.js` file, causing the prompt to be silently skipped in projects that use a different config filename or have no tailwind config at all (scan is still useful for `globals.css` and custom design tokens).

### `doctor --fix` now runs a full repair

`doctor --fix` previously only performed the legacy file sweep (a subset of what `repair` does). It now prints the full diagnostic report first, then calls `repair` — which re-copies scripts, rewires commands, permissions, and hooks, and runs the legacy sweep. This matches the expected behavior of "diagnose and fix everything in one step."

### `ui-forge update` deprecated in favor of `repair`

`update` and `repair` were functionally identical once the version gate was cleared. `update` is now a deprecation shim that prints a warning and delegates to `repair`. It no longer appears in `--help` output. The version-drift log (`Updating from vX → vY`) is now printed by `repair` directly when the lockfile version does not match the installed version.

---

## Files changed

| File | Change |
|------|--------|
| `cli/src/feature-prune.ts` | Added `pruneDeselectedCommands()`, `prunePlatforms()`, and `pruneOrphanedSkillDirs()` exports |
| `cli/src/install.ts` | Calls `pruneDeselectedCommands`, `prunePlatforms`, `pruneThemeStandards`; adds `themeChanged` forgeignore flag; resets `design-arch.json _theme` on theme change |
| `cli/src/wiring/design-bootstrap.ts` | Added `pruneThemeStandards()` export |
| `cli/src/wiring/mcp.ts` | Creates MCP config file when missing instead of silently skipping |
| `cli/src/prompts.ts` | Scan prompt shown unconditionally when theme is "None" |
| `cli/src/doctor.ts` | `--fix` calls `runRepair` after printing the diagnostic report |
| `cli/src/repair.ts` | Logs version drift (`Updating from vX → vY`) |
| `cli/src/update.ts` | Gutted to a re-export alias; deprecation shim now in `index.ts` |
| `cli/src/index.ts` | `update` command prints deprecation warning then runs repair |
| `cli/src/flags.ts` | Removed `update` from help text; updated `doctor` description |
