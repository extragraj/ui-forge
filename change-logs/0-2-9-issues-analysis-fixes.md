# 0.2.9 — Issues Analysis Fixes

> **Date:** 2026-05-08

## Issues Resolved

### Issue 1 — StackShift `.forgeignore` Appends Instead of Merging

- **`scripts/scan.js`** `handleStackshiftForgeignore()` now uses `mergeForgeignoreLines()` which parses individual patterns and merges line-by-line instead of appending the entire block as a guarded chunk.
- Each pattern from the StackShift template is checked against existing content (ignoring comments and blanks) — only genuinely new patterns are added, eliminating duplicates.
- The guard-header approach is replaced with a clean merge that handles template evolution naturally.

### Issue 2 — Sample Standard Included in `designStandards` Object

- **`scripts/scan.js`** `findDesignStandards()` now copies `sample-standard.md` as `_template-standard.md` (underscore prefix = meta/template) so it is still available in the project for users to reference, but is excluded from auto-registration.
- The auto-registration loop in `findDesignStandards()` now skips files starting with underscore (`_`), preventing `_template-standard.md` from being added to `designStandards` in `design-arch.json`.
- The `META_STANDARDS` filter in `invoke.js` already excluded `sample-standard` from built-in injection — this fix ensures it is also excluded at the scan/copy level.

### Issue 3 — On Rescan, Existing Design Standards Deleted Instead of Merged

- **`scripts/scan.js`** `main()` now always merges existing `designStandards` regardless of `PATCH_MODE`:
  ```js
  const designStandards = existing.designStandards
    ? { ...discovered, ...existing.designStandards }
    : discovered
  ```
- This ensures previously registered standards (e.g. `stackshift-ui` from a prior `--theme stackshift` scan) survive rescans. `discovered` provides new/updated entries; `existing.designStandards` preserves everything else.

### Issue 4 — On Rescan, Patterns Overwritten When AI Synthesis Unavailable

- **`scripts/scan.js`** `main()` now preserves existing patterns when synthesis returns `'unknown'` or empty values:
  ```js
  patterns: {
    ...(existing.patterns ?? {}),
    ...(s.spacing && s.spacing !== 'unknown' ? { spacing: s.spacing } : {}),
    ...(s.typography && s.typography !== 'unknown' ? { typography: s.typography } : {}),
    ...(Array.isArray(s.conventions) && s.conventions.length > 0
      ? { conventions: s.conventions }
      : {}),
  },
  ```
- Previously, `s.spacing`, `s.typography`, and `s.conventions` from `staticFallback()` would overwrite good existing data with `'unknown'` and empty arrays.

### Issue 5 — Non-Lite Mode Contains Duplicate Anti-Slop Guardrails

- **`scripts/invoke.js`** `buildSectionContext()` — removed the hardcoded `IMPLEMENTATION` and `ANTI-SLOP GUARDRAILS` blocks from non-lite mode, where the full addendum from `prompt-patterns.md` already covers these instructions.
- The hardcoded blocks are preserved and only emitted in **lite mode**, where the addendum is a single-line reference and concrete guidance is essential.
- **`scripts/invoke.js`** `buildPageStage2Context()` — same fix applied: removed duplicate hardcoded blocks from non-lite mode.
- Token savings: ~400-500 tokens per generation call in non-lite mode.

### Issue 6 — Agentic Models Do Not Follow Design Standards

Four improvements implemented, all preserving the `[REF]` pattern:

**Option B — Task-Relevance Sorting:**
- `appendStandards()` now accepts a `task` parameter and scores each standard by keyword overlap with the task description.
- Standards are sorted so the most task-relevant ones appear first — AI models naturally pay most attention to the first items in a list.
- Zero token cost (reordering only).

**Option C — RULE Extraction in Descriptions:**
- `extractStandardDescription()` now scans for directive keywords (`Never`, `Always`, `Must`, `Do not`, etc.) and extracts the strongest actionable rule.
- Each `[REF]` line now includes `RULE: <binding rule> — READ FULL FILE` instead of just the first sentence.
- If no directive is found, falls back to the first substantive line with `— READ FULL FILE` suffix.

**Option D — FORGE NOTES Compliance Block:**
- Added `STANDARDS COMPLIANCE` requirement after the addendum in `buildSectionContext()`:
  ```
  STANDARDS COMPLIANCE: In FORGE NOTES, list every consulted standard and how it was applied.
    Example: "// 04-color-tokens: applied (bg-primary, text-primary-foreground — no raw hex)"
  ```
- Only fires when standards exist (~60 tokens one-time cost).

**Option E — Post-Generation Verify Hook:**
- Created **`scripts/verify-standards.js`** — a standalone compliance checker that runs post-generation against design standards:
  - Check 1 (04-color-tokens): Detects raw hex colors in `className` attributes
  - Check 2 (02-conditional-link): Detects naked `<a>` tags without `Button as="link"`
  - Check 3 (01-import-rule): Detects component imports not from `@stackshift-ui/*` (StackShift-only)
  - Check 4 (06-spacing): Detects components missing `<Section>` wrapper
- Returns exit code 0 (pass) or 1 (violations), all output goes to stderr.
- Added `--verify-standards` flag to `invoke.js` help text.
- Verified: detects violations correctly on sample output files.

## Documentation Updates

- **`README.md`**: Updated version to 0.2.9; added changelog entry; updated StackShift theme section to clarify `sample-standard.md` is a template, not an active standard.
- **`CLAUDE.md`**: No structural changes needed (architecture documentation was already accurate).

## Testing

- Verified `node --check scripts/scan.js` — syntax valid
- Verified `node --check scripts/invoke.js` — syntax valid
- Verified version sync to 0.2.9 across all files
- Verified changelog follows existing format conventions