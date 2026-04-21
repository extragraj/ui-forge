# 0.1.4 — Ignore handling, scan efficiency, built-in standards

Released 2026-04-20.

## Summary

Four independent quality-of-life upgrades, all backwards-compatible and all StackShift-safe.

1. **Proper `.forgeignore` + gitignore-subset matcher** in `scripts/scan.js`.
2. **Scan efficiency** — dirent walk, directory-level pruning, hoisted regexes,
   single-read `package.json`, optional `--quick` mode.
3. **Built-in design-standards fallback** — skill-owned templates under
   `references/standards/` gap-fill slots a project hasn't authored.
4. **StackShift invariants preserved** — paired-mode detection, `a11yRequired`
   auto-enable, `stackshiftComponentStandard` auto-registration, and the
   `PAIRED:` VARIANT header are untouched.

## 1. Ignore handling

- New file: `.forgeignore` (project-root, optional). Same syntax subset as
  `.gitignore`: globstar `**`, single-segment `*`, `?`, leading `/` anchoring,
  trailing `/` for directory-only, `!` negation, `#` comments.
- New CLI flags on `scripts/scan.js`:
  - `--ignore <path>` — load an additional ignore file (repeatable).
  - `--no-default-ignore` — skip the built-in base list.
- Precedence (last wins on conflict):

  ```
  built-in base → .gitignore → .agentic.ignore → .claude.ignore → .forgeignore → --ignore <file>
  ```

- Directory-boundary pruning: the walker checks `isIgnored(rel, isDir, ...)`
  against `readdirSync(..., { withFileTypes: true })` entries and skips
  descending into ignored directories entirely. On a fresh `node_modules`
  install this collapses from per-entry `statSync` traversal into a single
  regex test at the directory root.
- Template shipped at `references/default-forgeignore.txt` — intentionally
  empty (all patterns commented out) with copy-paste instructions. Copy it to
  the project root as `.forgeignore` and uncomment what applies.

## 2. Scan efficiency

- `readdirSync(dir, { withFileTypes: true })` replaces the `readdirSync` +
  per-entry `statSync` pair — halves syscalls per directory.
- `FROM_RE` and `NAMED_RE` moved to module scope — no per-call regex recompile.
- `package.json` read once at the top of `main()` and passed into
  `resolveLibraries(pkgCount, allDeps)` instead of being re-read inside it.
- New `--quick` flag skips the `claude` CLI synthesis branch and goes straight
  to `staticFallback()`. Useful for fast iteration when patterns haven't changed.

## 3. Built-in design standards

- New directory: `references/standards/` with four slot templates —
  `typography.md`, `spacing.md`, `color.md`, `a11y.md`. All ship **empty**
  (headings + HTML comments only) so they don't silently inject opinions on
  fresh installs. A new `isSubstantive()` check in `invoke.js` skips any
  template whose body is comments / headings.
- `loadDesignStandards()` is now three-layer (last wins per key):
  1. `arch.designStandards` — explicit. Includes `stackshiftComponentStandard`.
  2. `PROJECT_ROOT/design/standards/<key>.md` — auto-registered by `scan.js`.
  3. `references/standards/<key>.md` — built-in fallback (gap-fill only).
- Each injected standard emits a `# source: arch | project | built-in` marker
  so the AI can reason about authority.
- Opt-out of step 3: `--no-default-standards` flag on `invoke.js`, or set
  `"_useBuiltins": false` inside `arch.designStandards`.
- `scan.js` `findDesignStandards()` now also auto-registers any
  `design/standards/*.md` files using the filename as the key. Existing arch
  entries (e.g. `stackshiftComponentStandard`) are never overwritten.
- See `references/standards/README.md` for the full resolution table and
  guidance on filling in slots.

## 4. Invocation caches (minor)

- `_archContextCache` — `archToContext(arch)` result cached by `_scanned`
  timestamp for the lifetime of the process.
- `_refCache` — classified ref output keyed by `fullPath + ':' + mtimeMs`.
  Helps builders that touch the same ref more than once per invocation.

## Files changed

- `scripts/scan.js` — rewritten ignore matcher, dirent walk, efficiency tweaks,
  `design/standards/*.md` auto-registration, `--quick` / `--ignore` /
  `--no-default-ignore` flags.
- `scripts/invoke.js` — three-layer `loadDesignStandards()`, source markers,
  `--no-default-standards` flag, `_archContextCache`, `_refCache`.
- `references/standards/` — NEW directory with 4 empty templates + `README.md`.
- `references/default-forgeignore.txt` — NEW empty template + usage notes.
- `references/advanced-usage.md` — documents the new flags and templates.
- `SKILL.md`, `CLAUDE.md`, `README.md` — updated flags + usage.
- `skill.version` → `0.1.4`; `package.json`, `SKILL.md`, `README.md` synced via
  `scripts/sync-version.mjs`.

## Backwards compatibility

- No API changes to `invoke.js` stdout format beyond the new `# source:` line
  prepended to each standard block.
- Projects with existing `designStandards` entries behave exactly as before;
  built-in fallback is additive only.
- Empty built-in templates skip injection — a fresh install sees no difference
  in context output from 0.1.3.
- All StackShift paired-mode invariants preserved and verified.
