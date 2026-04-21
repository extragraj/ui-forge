# 0.1.6 — `+DIFF` iterative mode and theme starters

Released: 2026-04-21.

Closes the two next remaining items in `next-phase-optimization.md`
that could land without cross-repo coordination or breaking changes:
Section 4.8 (`--diff` iterative mode) and Section 4.3 (theme starters).
All additions are additive — no schema bump, no new dependencies,
byte-identical scan and invoke output when the new flags are not used.

## What's new

### `+DIFF` modifier — `CONVERT_SECTION` only

Surgical iteration on an existing component. The task describes the
delta to apply; the existing file is the base.

**Activation:** `--diff <path>` on `invoke.js`, or `diff: "<path>"` in a
`--config` JSON.

**Behaviour:**

- The existing file is loaded and injected as an `EXISTING COMPONENT [path]`
  block in the section context (after the reference / config / brand blocks).
- `--output` defaults to the diff path, so the file is replaced in place.
- `SIGNAL_DIFF` addendum instructs the AI to preserve imports, exports,
  prop shapes, and handlers unless the task asks otherwise, and to
  rewrite FORGE NOTES with a `DIFF` sub-block (what changed, what was
  preserved, and any token re-mappings).
- Anti-slop guardrail still applies.

**Refusal (exit 1):**

- Primary signal is `CONVERT_VARIANT` — contract-level iteration uses
  `--mode body-only` instead.
- Primary signal is `CONVERT_PAGE` — page decomposition is two-stage;
  iterate sections one at a time.
- `+CREATIVE` is also active — surgical iteration and greenfield are
  mutually exclusive.

**Composes with:** `+CONFIG`, `+IMAGE`, `+BRAND`, `+A11Y`.

### Theme starters — `scan.js --theme <name>`

Bundled baseline presets that seed `design-arch.json` for fresh or
greenfield projects.

**Activation:** `--theme <name>` on `scan.js`. Available themes:

| Name | Library assumption |
|---|---|
| `shadcn` | Tailwind + shadcn/ui primitives (Radix, class-variance-authority) |
| `mantine` | Mantine 7+ with CSS-variables theming |
| `plain-tailwind` | Vanilla Tailwind, no component library |

**Merge semantics — gap-fill only; scan data wins:**

- `componentLib` replaced only if scan fell back to the single default
  `['./components']`.
- `usedComponents` theme hints appended (deduped) when scan found fewer
  than 5 entries.
- `usedLibraries` theme hints appended for names not already present.
- `tailwind.colorTokens` filled only if scan/synthesis produced an empty
  string.
- `patterns.spacing` / `patterns.typography` filled only if synthesis
  returned `"unknown"` (static-fallback path).
- `patterns.conventions` filled only if synthesis returned an empty list.

Unknown theme names fail fast with the available list printed to stderr.
The applied theme is recorded as `arch._theme` for auditing. Dropping the
flag on a later scan removes the record.

## Flags added

| Flag | Tool | Behaviour |
|---|---|---|
| `--diff <path>` | `invoke.js` | Adds `+DIFF` modifier. Loads `SIGNAL_DIFF` addendum. `--output` defaults to the diff path. |
| `--theme <name>` | `scan.js` | Seeds `design-arch.json` from `themes/<name>.json`. Gap-fill only. |

## Files changed

- `scripts/invoke.js` — `--diff` flag parsing with file-exists validation;
  `diffSource` threaded into `buildSectionContext()` as a new `EXISTING
  COMPONENT` block; `+DIFF` refusal block mirroring the `+CREATIVE`
  refusals; help text updated.
- `scripts/scan.js` — `--theme` flag parsing; `loadTheme()` + `applyTheme()`
  with per-field gap-fill rules; `arch._theme` recorded.
- `references/prompt-patterns.md` — new `SIGNAL_DIFF` block; composition
  rules updated in header.
- `themes/shadcn.json`, `themes/mantine.json`, `themes/plain-tailwind.json`,
  `themes/README.md` — three starter presets and their merge rules.
- `SKILL.md` — flag tables, signal matrix, new "Diff signal" and "Theme
  starters" sections.
- `README.md` — features signal table, CLI flag tables, changelog row.
- `CLAUDE.md` — architecture notes, new commands, signal detection
  summary, theme-starter merge semantics, `themes/` directory entry.
- `references/advanced-usage.md` — new "Iterative regeneration" and
  "Theme starters" sections.
- `skill.version` → `0.1.6`; `package.json`, `README.md`, `SKILL.md` synced
  via `scripts/sync-version.mjs`.
- `change-logs/0-1-6-diff-and-themes.md` — this file.

## Backwards compatibility

- **Byte-identical stdout** for `invoke.js` invocations that don't pass
  `--diff`.
- **Byte-identical `design-arch.json`** for `scan.js` invocations that
  don't pass `--theme` (the `_theme` marker is only written when the
  flag is used).
- No API changes to any existing flag.
- No schema changes — `design-arch.json` stays at `_v: 3`.
- Refusal errors for `+DIFF` fire on stderr with non-zero exit. No silent
  downgrade.
