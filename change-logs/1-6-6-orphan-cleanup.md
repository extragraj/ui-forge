# 1.6.6 — Orphan Cleanup

## Highlights

Closes a structural gap in 1.6.5 where theme, feature, and paired-mode prune
routines were guarded by lockfile-vs-lockfile diff and therefore could not
recover from stale on-disk state once the lockfile had already been updated
past the diff window. Re-running `init` (or `repair`) now cleans up:

- Command files (`forge-export-design.md`, `forge-handoff.md`) belonging to
  features no longer in the selection.
- `design/standards/<theme-subdir>/` directories whose theme is no longer
  selected (e.g. `stackshift-ui/` after switching to "None").
- `design-arch.json` `_theme` markers that disagree with the current
  selection, plus `tailwind.darkColorTokens` when the theme is not
  stackshift.
- `.forgeignore` content matching the pre-1.6.6 StackShift template, even
  though that template had no provenance header.

---

## Root cause

Every Issue 1, 2, and 3 cleanup in 1.6.5 was guarded by a lockfile diff:

```ts
if (prior && prior.theme !== selections.theme) { /* prune */ }
priorFeatures.filter((f) => !nextSet.has(f))      // for commands
prior!.paired !== selections.paired               // for forgeignore force
```

The cleanup only fired on the single install where the value flipped. Once
the lockfile was updated to reflect the new selection, the diff was zero,
and any artifacts that hadn't been cleaned on the flipping install were
orphaned for good. This was particularly visible on installs upgraded from
pre-1.6.5 — the flipping install happened before the cleanup logic existed.

Issue 6 (platform prune) had already dodged this by adding
`pruneOrphanedSkillDirs` — a disk-state scan that runs unconditionally each
install. This release applies the same pattern to features, theme
standards, theme markers, and the StackShift `.forgeignore`.

---

## Fixes

### Orphan command scan

New `pruneOrphanedCommands` in `cli/src/feature-prune.ts` walks each
selected platform's `commands/` directory on every install and removes any
provenance-owned `forge-*.md` whose owning feature is not in
`selections.features`. The check is independent of `priorFeatures`, so a
`.claude/commands/forge-export-design.md` left over from a prior install
gets removed even when both the prior and current lockfile have
`export-design` deselected. User-customized command files (no provenance
header) are preserved.

### Theme standards: disk-scan, not diff

`pruneThemeStandards` in `cli/src/wiring/design-bootstrap.ts` no longer
takes a `priorTheme` argument. Instead it iterates every value in
`STANDARDS_BY_THEME` and prunes provenance-owned `.md` files in any subdir
whose theme key isn't the current selection. This catches stale
`design/standards/stackshift-ui/` (and any future theme-scoped subdirs)
without depending on lockfile diff. User-customized files (no provenance
header) are preserved.

After pruning, the now-empty theme subdir is removed in addition to its
contents. (`pruneEmptyDirs(root)` only prunes empty *subdirs* of `root`,
not `root` itself, so the directory previously persisted as an empty
shell.)

### `design-arch.json` theme-derived fields cleaned

The reset in `cli/src/install.ts` now reads `arch` from disk and compares
its theme-derived fields against `selections.theme`. When any disagree,
they are cleaned in place:

- `_theme` → set to current selection (or `undefined` for theme `'none'`).
- `isStackShift` → set to `false` when theme is not `stackshift`.
- `tailwind.darkColorTokens` → dropped for non-stackshift themes (the
  field is populated only by stackshift scans).
- `designStandards.<key>` → entries whose key matches a value in
  `STANDARDS_BY_THEME` for a non-selected theme are removed (e.g. a stale
  `stackshift-ui: "./design/standards/stackshift-ui"` reference after the
  user switches off stackshift). Non-theme entries such as `nextjs-image`
  are preserved.
- `patterns` (spacing/typography/conventions) → dropped whenever any
  other theme-derived field above was stale. The values are tied to the
  prior theme (stackshift patterns reference `@stackshift-ui/*`
  primitives, `<Section>`/`<Container>` conventions, etc.) and would be
  misleading or actively wrong under the new theme. The next
  `/forge-scan` repopulates them with values appropriate to the current
  theme (static fallback or AI-synthesized).

### Theme-standards prune no longer creates phantom lockfile entries

Previously, files deleted by `pruneThemeStandards` were appended to
`lockfile.files.design-standards`, leaving a list of paths that didn't
exist on disk. They are now recorded only in `lockfile.pruned[]` (where
deletions belong), keeping the `files` map an accurate inventory of
currently-installed files.

### `.forgeignore` legacy + sentinel detection

The StackShift `.forgeignore` template is intentionally written without a
provenance header (curated content that users edit), which previously made
it indistinguishable from a user-owned file. Two changes restore the
ability to recognize and replace it on a theme switch-out:

1. The bundled template now carries a `# ui-forge:stackshift-baseline`
   sentinel as its first line. Users who customize the file are expected
   to delete this line to mark it as user-owned (same convention as the
   provenance header).
2. `isUiForgeOwned()` now recognizes three signatures: the provenance
   header, the new sentinel, and the legacy pre-1.6.6 first line
   `#StackShift Workflow Skill` — so installs upgraded from 1.6.5 or
   earlier still get retroactive cleanup the first time `init` (or
   `repair`) runs on 1.6.6.

---

## Files changed

| File | Change |
|------|--------|
| `cli/src/feature-prune.ts` | Added `pruneOrphanedCommands()` |
| `cli/src/wiring/design-bootstrap.ts` | `pruneThemeStandards` rewritten to scan every theme subdir; signature dropped `priorTheme` |
| `cli/src/install.ts` | Calls `pruneOrphanedCommands` unconditionally; drops `prior.theme !== selections.theme` guards on theme prune and `_theme` reset; widens `tailwind.darkColorTokens` cleanup to all non-stackshift themes |
| `cli/src/wiring/forgeignore.ts` | New `FORGEIGNORE_STACKSHIFT_SENTINEL` constant; `isUiForgeOwned()` matches sentinel and legacy first-line signatures |
| `references/default-stackshift-forgeignore.txt` | First line now `# ui-forge:stackshift-baseline` |
| `skill.version` / `package.json` / `cli/package.json` / `README.md` / `SKILL.md` | Bumped to 1.6.6 |

## Tests

93/93 passing. No new tests added in this release; the existing
`platform prune on reinstall` test already exercises the orphan-scan
pattern, and the legacy detection paths are covered by manual repair
runs against pre-1.6.6 installs.
