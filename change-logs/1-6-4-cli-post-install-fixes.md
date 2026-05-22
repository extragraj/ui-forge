# 1.6.4 — CLI Post-Install Fixes

Released **2026-05-22**.

Fixes a batch of issues observed during the first round of real-world CLI
installs on top of 1.6.3. No new top-level features; this release is
correctness, lifecycle, and polish.

## Skill version no longer copied into the install

`skill.version` was being written into every target skill dir as part of the
`always` asset set. It's source-bundle metadata, not runtime data — the
installed skill never needed it.

- Removed from `RUNTIME_ASSETS.always` in `cli/src/assets.ts`.
- The version is now stamped directly into `scripts/mcp-server.js` at install
  time via a new transform in `cli/src/theme.ts`, replacing the
  `getVersion()` implementation with a literal `return "<version>"`.
- The `ui-forge.mjs` project shim's `--version` flag now uses the
  `__VERSION__` placeholder substituted at install time, rather than reading
  `${root}/skill.version` at runtime.
- Doctor's "skill.version matches lockfile" check still works — it reads from
  the npm package source root via `getSkillVersion()`, not the install dir.

## New CLI command

```
$ ui-forge version
ui-forge 1.6.4
source: <path to npm package>
```

Also accepts `--version` / `-v`. Useful when troubleshooting which bundled
version is in use without parsing JSON.

## Feature Prompt and Install Flow

### Group order swap (Issue 9)

In the optional-features `groupMultiselect`, the **Automation** group now
appears before **Claude Exclusives**. Automation features (verify hook,
project CLI shim) are more frequently chosen, so they belong on top.

### Quick scan now respects the selected theme (Issues 1 + 7)

When `init` runs the post-install quick scan, the `--theme <name>` flag is
now forwarded to `scan.js`. Without it, the scan never ran `applyTheme()` —
which meant a StackShift install ended up with no `usedComponents` or
`usedLibraries` seeded, and `findDesignStandards()` never discovered the
`stackshift-ui` standards directory. Both gaps are closed by passing the
theme.

### Opt-in theme override (Issue 6)

New `--theme-override` and `--no-backup` flags on `init`. When `theme=stackshift`,
the interactive flow now offers:

> Apply StackShift Theme Override To globals.css And tailwind.config?
> Skip .bak Backups Of Modified Files?

This forwards `--theme-override` (and optionally `--no-backup`) to the quick
scan, which surgically rewrites the Google Fonts `@import`, `@layer base`,
and `theme.extend` sections of the project's CSS and Tailwind config.

**Non-interactive guard:** `--yes` alone never triggers the override. The
user must explicitly pass `--theme-override` to opt in. We don't silently
rewrite user-owned source files under automated flows.

## Standards Bootstrap

### `_template-standard.md` rename (Issue 2)

`bootstrapDesignStandards` now writes the sample template as
`_template-standard.md` (underscore prefix) to match the destination name
`scan.js` already uses. The underscore is meaningful — `scan.js`'s
auto-registration loop skips dotted/underscored files, so the template won't
be picked up as an active design standard.

### `nextjs-image.md` seeded by bootstrap (Issue 5)

Previously, `nextjs-image.md` was loaded by `scan.js` via
`copyBuiltinStandard()`, which read from
`CLAUDE_SKILL_DIR/references/standards/`. But `references/standards/` was
intentionally removed from the skill copy in 1.6.2 (it lives in
`design/standards/` now). The standard therefore never reached new
installs.

Fixed by seeding `nextjs-image.md` from the bootstrap step alongside the
template, with a provenance header so it auto-refreshes on theme/version
bumps.

## Lockfile & Lifecycle

### Feature prune on reinstall (Issue 8)

New module `cli/src/feature-prune.ts`. When `init` re-runs with optional
features deselected, the previously-tracked files for those features are now
deleted before the new copy step.

- Required features (`scan`, `forge`, `verify`, `mcp-server`) are never
  pruned, even if accidentally absent from the new selection.
- Files shared between retained and pruned groups are skipped.
- `ui-forge.mjs` is removed when `project-cli` is deselected.
- Removed files are recorded in `lockfile.pruned[]`.

### Paired-mode hook cleanup on un-pair (Issue 11)

Previously, `writeHooks` was only entered when `hooksEnabled || paired` was
true. If a user had a paired install and then re-ran `init` after deleting
`.stackshift/`, the prior `ui-forge:stackshift-validate` hook entry stayed
in `hooks.PostToolUse` forever.

`install.ts` now enters `writeHooks` whenever a prior install exists,
regardless of new `paired`/`hooksEnabled` values. The filter in `writeHooks`
strips ui-forge entries before rewriting, so stale paired-mode hooks are
removed cleanly.

To keep idempotent re-runs byte-stable, `writeHooks` now skips the write
entirely when the resulting settings.json is identical to the existing
content.

### StackShift `.forgeignore` written without provenance (Issue 4)

The StackShift `.forgeignore` template is curated, opinionated content —
not a generic placeholder. Writing it with a provenance header implied
"ui-forge owns this and will overwrite it", which was wrong: once written,
the user is expected to maintain it.

`writeForgeignore` now accepts a `skipProvenance` option. When
`theme=stackshift && paired`, `install.ts` passes `skipProvenance: true` and
logs:

```
Wrote .forgeignore (StackShift template — delete to revert to default behavior on next install).
```

The file is immediately user-owned. Switching to a non-StackShift theme
later requires `--force-forgeignore` to clobber it (intentional trade-off
against duplicate state tracking in the lockfile).

## `ls` Display

### Compact view for multi-platform installs (Issue 3)

When `platforms.length > 1`, `ls` now reports unique file counts after
collapsing per-platform path prefixes:

```
Files (12 total) × 2 platforms:
  [always] 5 unique file(s) × 2 platforms
  [forge]  2 unique file(s) × 2 platforms
  ...
```

Single-platform installs are unchanged.

## Test Suite & Cleanup

### 5 regressed assertions fixed (Issue 10)

`tests/run-cli-tests.mjs` was last updated before 1.6.3's lockfile cleanup
and standards bootstrap. Fixed:

- `themeLimited` no longer stored in JSON — assertions now derive from
  `theme` + `paired`.
- `mcp-server.js` is now Required → always copied. Removed from the
  "should not exist" assertion.
- `references/standards/` no longer copied into skill dir; replaced with a
  `design/standards/` bootstrap check.
- `ls` output now uses Title Case (`Scan, Forge`); assertion updated.

### Dead code removed (Issue 12)

`writeForgeignoreCompat` in `cli/src/wiring/forgeignore.ts` had no remaining
callers after the 1.6.3 refactor. Removed.

## Files Changed

| File | Change |
|---|---|
| `cli/src/assets.ts` | Remove `skill.version` from `always`; add comment explaining why |
| `cli/src/theme.ts` | Add install-time version stamping for `mcp-server.js` |
| `cli/src/flags.ts` | Add `--theme-override` / `--no-backup` flags; document new `version` command |
| `cli/src/index.ts` | Add `version` / `--version` / `-v` command |
| `cli/src/install.ts` | Pass `--theme` (and optional `--theme-override`) to quick scan; enter `writeHooks` when prior install exists; wire `feature-prune` step; pass `version` to asset transform; pass `skipProvenance` for stackshift forgeignore |
| `cli/src/prompts.ts` | Swap group order; add theme-override prompt; surface `wantsThemeOverride` / `wantsNoBackup` |
| `cli/src/feature-prune.ts` | **NEW** — prune deselected optional-feature files on reinstall |
| `cli/src/ls.ts` | Compact display for multi-platform installs |
| `cli/src/wiring/design-bootstrap.ts` | Rename sample → `_template-standard.md`; seed `nextjs-image.md` |
| `cli/src/wiring/forgeignore.ts` | Add `skipProvenance` option; remove dead `writeForgeignoreCompat` |
| `cli/src/wiring/hooks.ts` | Idempotent write (skip when settings.json unchanged); drop empty arrays |
| `cli/src/wiring/project-cli.ts` | Use templated `__VERSION__` directly in `--version` output |
| `tests/run-cli-tests.mjs` | Update 5 stale assertions for 1.6.3+ realities; add 1.6.4 bootstrap check |
| `skill.version`, `package.json`, `cli/package.json`, `README.md`, `SKILL.md` | Bumped to 1.6.4 |
