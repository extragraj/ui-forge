# 1.7.2 — Folder reorganization, examples expansion, and a single tabular test runner

**Scope:** `references/`, `themes/`, `examples/`, `tests/`, `cli/src/assets.ts`, `cli/src/wiring/design-bootstrap.ts`, `cli/src/legacy-sweep.ts`, `cli/src/install.ts`, `scripts/scan.js`, `scripts/invoke.js`, `scripts/cli.js`, `scripts/fetch-handoff.js`, `commands/*`, `README.md`, `SKILL.md`

This is a structural pass — no runtime behavior changes from the user's
side once the install is up to date. Existing projects keep working: the
installer ships the same `prompt-patterns.md` runtime asset and seeds the
same `design/standards/stackshift-ui/` directory structure into target
projects. The reorg lives entirely in the source-bundle layout that ships
on npm and the dev-tree layout in this repo.

## What moved (source bundle)

```
references/
  advanced-usage.md                       → references/docs/advanced-usage.md
  claude-design-handoff-format.md         → references/docs/claude-design-handoff-format.md
  migration-guide.md                      → references/docs/migration-guide.md
  versions.md                             → references/docs/versions.md
  examples.md                             → examples/index.md           (rewritten as router)
  default-forgeignore.txt                 → references/forgeignore/default.txt
  default-stackshift-forgeignore.txt      → references/themes/stackshift/forgeignore.txt
  standards/README.md                     → references/standards/index.md
  standards/stackshift-ui/                → references/themes/stackshift/standards/
themes/README.md                          → references/themes.md
```

`references/prompt-patterns.md` stays put — it's still the only runtime
asset copied into installed skill dirs. The themes/*.json preset files
also stay put.

The new `references/themes/<theme>/` convention is the documented place
to put any future theme-specific reference (forgeignore template, standards
directory, etc.). Today only `stackshift` lives there; `shadcn`, `mantine`,
and `plain-tailwind` have no theme-specific refs and don't need a folder.

## What gets installed (target skill dir) — unchanged

Nothing the installer copies to `<scope>/skills/ui-forge/` changes:
`scripts/*.js`, `commands/*.md`, `themes/<selected>.json`,
`references/prompt-patterns.md`, `SKILL.md`. The legacy-sweep catch-all
`references/(?!prompt-patterns\.md$).+` already filters the entire new
references subtree, so accidentally including any of the new docs in a
future bundle is impossible.

## What `design-bootstrap` does now

`STANDARDS_BY_THEME` changed shape — values are now `{ sourcePath, destSubdir }`
instead of bare strings. This decouples the source location (under
`references/themes/<theme>/standards/`) from the destination subdir name
in `design/standards/<destSubdir>/` (still `stackshift-ui`, intentionally
stable so existing project copies keep working).

```ts
// Before
STANDARDS_BY_THEME = { stackshift: 'stackshift-ui' }

// After
STANDARDS_BY_THEME = {
  stackshift: {
    sourcePath: 'references/themes/stackshift/standards',
    destSubdir: 'stackshift-ui',
  },
}
```

Consumers updated: `bootstrapDesignStandards`, `pruneThemeStandards`,
`runInit` (stale-standard pruning).

## Legacy sweep entries added

`cli/src/legacy-sweep.ts` adds explicit patterns for every pre-1.7.2
path (`references/default-forgeignore.txt`,
`references/default-stackshift-forgeignore.txt`,
`references/advanced-usage.md`, `references/migration-guide.md`,
`references/versions.md`, `references/claude-design-handoff-format.md`,
`references/examples.md`) plus blanket entries for the new dev-tree
directories (`references/docs/`, `references/forgeignore/`,
`references/themes/`, `references/themes.md`) — even though the existing
catch-all already covers them. Explicit entries produce clearer
"why was this removed" output during `doctor`. The `references/standards/`
and `themes/README.md` entries from 1.6.10 stay.

## Examples expansion

`examples/` is now the canonical example surface. Every numbered folder
contains:

- `input/` — the refs you would pass to `invoke.js --refs`
- `output/` — the generated TSX (what the AI wrote)
- `design-arch.json` — a stub authority that makes the example
  reproducible without scanning a real project
- `forge-stdout.txt` — literal `invoke.js` stdout for the example,
  captured against the stub arch (useful for diffing when prompt patterns
  change)
- `index.md` at the top — router with one row per example

Existing examples 01–04 picked up `design-arch.json` + `forge-stdout.txt`.
New examples:

- `05-brand-tokens/` — `CONVERT_SECTION +BRAND`, HTML + brand tokens JSON →
  brand-aware section.
- `06-a11y-form/` — `CONVERT_SECTION +A11Y`, form HTML → WCAG 2.1 AA
  semantic form with `htmlFor`/`aria-describedby`/`role="alert"` and
  shadcn `<Input>`/`<Label>`/`<Textarea>`/`<Button>`.
- `07-image-reference/` — `CONVERT_SECTION +IMAGE`, image ref →
  features-grid section. Ships a 1×1 placeholder PNG; replace
  `input/features-section.png` with your real screenshot to reproduce the
  vision-aware path.

## Test runner

Six pre-1.7.2 `.mjs` test files (`run-cli-tests.mjs`, `smoke-existing.mjs`,
`test-1-1-0-fixes.mjs`, `test-1-4-0-paired-mode-body-rules.mjs`,
`test-1-5-0-ai-agnostic-synthesis.mjs`, `test-new-flags.mjs`) replaced
with a single `tests/run.js` runner. Notable behavior:

- Tabular output with PASS/FAIL/SKIP and per-test duration, color when
  stdout is a TTY.
- Eight suites: `assets-paths`, `install`, `install-stackshift`,
  `legacy-sweep`, `uninstall`, `scan-smoke`, `invoke-smoke`, `examples`.
- Every suite owns an ephemeral sandbox under `os.tmpdir()` and is
  cleaned up on exit (including SIGINT and runner crashes).
- `pnpm test -- --only=install,scan` filters suites by substring;
  `--verbose` prints longer failure stacks.
- Exits 0 on success, 1 on any failure, 2 on runner crash.
- `package.json` `"test"` script now points at `tests/run.js`.

## Docs

- `README.md` — Documentation section now lists all moved docs at their
  new paths and adds links for migration-guide and claude-design-handoff
  that were missing before.
- `SKILL.md` — Advanced section `ls "$SKILL_ROOT/references/"` block
  updated to reflect the new tree.
- `references/forgeignore/default.txt` and
  `references/docs/advanced-usage.md` — updated their own `cp …` examples
  so users copy from the new path.
- `scripts/fetch-handoff.js` header comment — fixed broken path to
  `claude-design-handoff-format.md` (now under `docs/`).

## Files

### Moved

- `references/{advanced-usage,migration-guide,versions,claude-design-handoff-format}.md` → `references/docs/`
- `references/examples.md` → `examples/index.md` (content rewritten as router)
- `references/default-forgeignore.txt` → `references/forgeignore/default.txt`
- `references/default-stackshift-forgeignore.txt` → `references/themes/stackshift/forgeignore.txt`
- `references/standards/stackshift-ui/*.md` → `references/themes/stackshift/standards/`
- `references/standards/README.md` → `references/standards/index.md`
- `themes/README.md` → `references/themes.md`

### Added

- `examples/index.md` (new content; the old file was moved here but rewritten)
- `examples/01-hero-section/design-arch.json`, `forge-stdout.txt`
- `examples/02-marketing-page/design-arch.json`, `forge-stdout.txt`
- `examples/03-config-driven/design-arch.json`, `forge-stdout.txt`
- `examples/04-stackshift-variant/design-arch.json`, `forge-stdout.txt`
- `examples/05-brand-tokens/` (full example)
- `examples/06-a11y-form/` (full example)
- `examples/07-image-reference/` (full example; ships placeholder PNG)
- `tests/run.js`
- `change-logs/1-7-2-folder-reorg-and-test-runner.md` (this file)

### Removed

- `tests/run-cli-tests.mjs`
- `tests/smoke-existing.mjs`
- `tests/test-1-1-0-fixes.mjs`
- `tests/test-1-4-0-paired-mode-body-rules.mjs`
- `tests/test-1-5-0-ai-agnostic-synthesis.mjs`
- `tests/test-new-flags.mjs`

### Modified

- `cli/src/assets.ts` — `STANDARDS_BY_THEME` shape, `defaultForgeignore`, `byTheme.stackshift.forgeignore`
- `cli/src/wiring/design-bootstrap.ts` — consumes the new `STANDARDS_BY_THEME` shape
- `cli/src/install.ts` — stale-standard detection consumes `destSubdir`
- `cli/src/legacy-sweep.ts` — explicit patterns for every pre-1.7.2 path
- `scripts/scan.js` — `copyBuiltinStandardDir` now takes the full source rel path; updated forgeignore template paths and the stackshift built-in fallback
- `scripts/invoke.js` — built-in standards step loads theme-specific standards from `references/themes/<theme>/standards/`; `META_STANDARDS` now also filters `index`
- `scripts/cli.js` — forgeignore template path
- `scripts/fetch-handoff.js` — header comment
- `package.json` — `test` script
- `README.md`, `SKILL.md` — doc links
- `skill.version` — 1.7.2

## Tests

25/25 passing in the new runner (≈1.4s on Windows). Coverage:

| Suite | What it asserts |
|-------|-----------------|
| `assets-paths` | New paths registered in `cli/dist/assets.js`, old paths gone, new structure exists on disk |
| `install` | Non-interactive `init` succeeds; runtime scripts written; non-runtime files NOT in skill dir; `.forgeignore` created; lockfile populated |
| `install-stackshift` | `--theme=stackshift --pair=on` works; stackshift forgeignore template applied; `design/standards/stackshift-ui/` seeded from the new source path with the correct provenance header |
| `legacy-sweep` | Pre-1.7.2 files in target skill dir are removed on re-install |
| `uninstall` | `init` then `uninstall --yes` leaves no skill dir |
| `scan-smoke` | `scan.js --quick` against a minimal project writes a valid `design-arch.json` |
| `invoke-smoke` | `invoke.js` against a stub arch produces a `CONVERT_SECTION` context block on stdout |
| `examples` | Every numbered example has `design-arch.json` + `forge-stdout.txt` + `input/` + `output/` and the stdout mentions a `CONVERT_*` signal |
