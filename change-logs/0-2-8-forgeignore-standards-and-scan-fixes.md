# 0.2.8 — .forgeignore, Standards Copy & Scan Fixes

> **Date:** 2026-05-06

## Issues Resolved

### Issue 1 — `cli.js install` Writes the Correct `.forgeignore`

- **`references/default-forgeignore.txt`** now has a clear `IDENTIFIER: ui-forge-template` marker so it can be programmatically detected as a template.
- **`cli.js install`** now copies `references/default-forgeignore.txt` (the general template) instead of `default-stackshift-forgeignore.txt`. If `.forgeignore` already exists, it is never overwritten.

### Issue 2 — `--theme stackshift` Handles `.forgeignore` Correctly

- **`scan.js`** gains `handleStackshiftForgeignore()` which implements three-way logic:
  - **Does not exist** → create from `default-stackshift-forgeignore.txt`
  - **Exists and is a template** (contains `IDENTIFIER: ui-forge-template`) → overwrite with StackShift content
  - **Exists and is NOT a template** → append StackShift content, guarded by a comment header to prevent duplicate appends

### Issue 3 — Variant-Router Linking Removed from `cli.js install`

- Removed the G-4 block (lines 121–140) that wired `variant-router.md` into `designStandards`. This was redundant after the 0.2.3 paired-mode update — `stackshift-section-variants` is already the canonical pointer written by StackShift's own CLI materialization.

### Issue 4 — `--theme stackshift` Copies Standards to Project

- **`scan.js` `findDesignStandards()`** now copies `references/standards/stackshift-ui/` to `design/standards/stackshift-ui/` when `isStackShift` is true.
- The `designStandards["stackshift-ui"]` entry now points to the project-local path (`./design/standards/stackshift-ui`) instead of a skill-internal path, making standards versionable, editable, and CI-safe.
- If the project-local copy already exists, it is preserved (no overwrite).

### Issue 5 — Scan Copies Built-In Design Standards to Project

- **`scan.js` `findDesignStandards()`** now copies general built-in standards (`nextjs-image.md`, `sample-standard.md`) to `design/standards/` on every scan.
- Only copies if the target file does not exist (preserves project edits).
- After copying, auto-registers in `designStandards` using project-local paths.

### Gap 1 — `_paired` Block Preserved on Re-Scan

- **`scan.js` `main()`** now always reads the existing `design-arch.json` before writing, and explicitly preserves the `_paired` mirror block that StackShift bootstrap writes. This prevents paired-mode tooling from losing the StackShift marker on re-scan.

### Gap 2 — Naming Distinction Documented

- The naming distinction between `stackshift-ui` (UI component library standards, written by scan) and `stackshift-section-variants` (component variant rules, written by StackShift CLI materialization) is now documented in the paired-mode contract's standards table.

## Testing

- Verified `scan.js --quick` copies `nextjs-image.md` and `sample-standard.md` to `design/standards/`
- Verified `scan.js --quick --theme stackshift`:
  - Creates `.forgeignore` from StackShift template
  - Copies `stackshift-ui/` to `design/standards/stackshift-ui/`
  - Records project-local path in `designStandards`
  - Sets `isStackShift: true`
- Verified append behavior: custom `.forgeignore` gets StackShift exclusions appended with guard header
- Verified `cli.js install` writes general template (not stackshift version)
- Verified `_paired` block preservation logic
- Verified version sync to 0.2.8 across all files