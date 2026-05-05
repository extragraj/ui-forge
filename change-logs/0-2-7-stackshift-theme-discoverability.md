# 0.2.7 — StackShift theme: full integration fix

Four interconnected StackShift gaps resolved. Together these ensure that a fresh StackShift project using `scan.js --theme stackshift` gets the correct conventions, standards, and paired-mode detection from the very first scan — even on empty codebases, in `--quick` mode, or when the Claude CLI is unavailable.

## `stackshift` theme added to all CLI help and documentation

`themes/stackshift.json` existed and was fully populated, but was invisible to users everywhere they look for the list of available themes.

| File | Change |
|------|--------|
| `scripts/scan.js` | Added `stackshift` to the Available themes comment |
| `scripts/cli.js` install | Added `stackshift` to the `/forge-scan` argument hint |
| `scripts/cli.js` help | Added `stackshift` to the `--theme` flag description |
| `CLAUDE.md` Commands | Added `node scripts/scan.js --theme stackshift` example |
| `CLAUDE.md` Slash commands | Added `stackshift` to `/forge-scan` signature |
| `CLAUDE.md` Key files table | Added `stackshift` to the `themes/` row |
| `SKILL.md` | Updated `--theme` flag listing and added StackShift callout |
| `README.md` Theme Starters | Added StackShift-specific behavior block |

## `--theme stackshift` now forces `isStackShift: true`

Previously `applyTheme()` never set `isStackShift`. On a fresh codebase with no `@stackshift-ui` imports, static analysis wrote `isStackShift: false` — causing `invoke.js` to silently skip the entire `references/standards/stackshift-ui/` directory at forge time, so none of the StackShift conventions were applied.

`applyTheme()` now forces `isStackShift: true` whenever `_theme` is `stackshift`, regardless of what synthesis or static analysis returned. The effective value is also propagated to `findDesignStandards()` before the arch is assembled, so the standards path is recorded correctly in the same scan pass.

## `design/standards/` created automatically; built-in stackshift-ui path recorded

`findDesignStandards()` previously only registered files that already existed in `design/standards/`. If that directory was absent (every fresh install), nothing was registered. The built-in `stackshift-ui` standards were being applied silently at invoke time via the Step 3 fallback — but `designStandards` always appeared empty, making the system look broken and hiding which standards were active.

Two changes in `scan.js`:
- `design/standards/` is now created on every scan if it does not exist, giving project-level overrides a clear home from the start.
- When `isStackShift` is true, the built-in `references/standards/stackshift-ui/` path is recorded under the `stackshift-ui` key in `designStandards` (as a relative path from project root), making active standards visible in `design-arch.json` and providing a clear override point.

## `install` wires variant-router into `design-arch.json` for StackShift projects

`cli.js install` already created `.forgeignore` for StackShift projects, but never linked the `variant-router` protocol from stackshift-core into `designStandards`. Without that reference, UI Forge could not confirm the StackShift contract version, producing `PAIRED: stackshift unknown` in forge output.

`install()` now checks for `.stackshift/installed.json` alongside an existing `design/design-arch.json`. If both are present and `designStandards['variant-router']` is not yet set, it resolves the variant-router path from the detected platform directory (`<platformDir>/skills/stackshift-core/protocols/variant-router.md`) and writes it into `design-arch.json`. Safe no-op if the file does not exist.
