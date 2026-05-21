# 1.4.0 — StackShift paired-mode body rules

**Date:** 2026-05-21

---

## Background

Paired mode — the integration that activates when a project follows StackShift conventions — previously enforced structural contract rules (single default export, no disallowed named exports, all required props consumed, null fallback when required props are absent) and injected the `stackshift-ui/` design standards into the generation context. But the **variant-body hard rules** (no raw HTML primitives, no `import React`, no `import * as` from `@stackshift-ui/...`, no `!important`, no `?? "fallback"` content strings, no inline styles, no direct `next/image` / `next/link` imports) lived only as prose inside the standards files. Under `--lite` or any prompt-budget pressure, those rules could effectively drop out of the generation context.

Paired-mode detection was also asymmetric: six different gate checks across four scripts used different signals (`.stackshift/installed.json` in some places, `arch.isStackShift === true` in others). A project that ran `scan.js --theme stackshift` got the standards directory but missed `+A11Y` auto-activation, the named-export exception in the validator, and the `--no-design-authority` / `--creative` refusals — all of which only fired when the marker file was present.

## Changes

### New prompt-pattern block: `SIGNAL_STACKSHIFT_UI`

Lives in `references/prompt-patterns.md`. Auto-injected as an addendum whenever paired mode is active (either trigger). Composes on top of the base addendum (`CONVERT_SECTION` or `SIGNAL_VARIANT`) and encodes the variant-body hard rules directly in the generation prompt — surviving `--lite` and `--full` equally:

- **Imports** — `@stackshift-ui/*` only; no barrel imports; no `import React`; no `next/image` / `next/link`; no `@stackshift-ui/system` in variant files
- **JSX** — no raw `<h1>…<h6>`, `<p>`, `<button>`, `<a>`, `<img>`, `<section>`; `conditionalLink` fields render via `<Button as="link" link={field}>` without manual `linkType` branching
- **Styling** — built-in props first; never `!important`; vertical padding on `<Section>` only; `gap` is numeric; tokens only (no raw hex, no `dark:` variants); no inline `style={{}}`
- **Data** — content from props; no hardcoded literals; no `?? "fallback string"`; mandatory `<Image alt>`

Each generation under paired mode adds a `// STACKSHIFT-UI:` sub-block to FORGE NOTES documenting primitive choices, className overrides, conditionalLink renderings, and any layout-glue `<div>` / `<span>` with rationale.

### New built-in standard: `references/standards/stackshift-ui/09-anti-patterns.md`

A single consolidated sheet — imports, JSX, styling, data tables — that ships with `--theme stackshift`. Mirrors what `SIGNAL_STACKSHIFT_UI` enforces but in standards form, so it survives the `[REF]` load-on-demand path equally. Adds to the existing 8 files in the `stackshift-ui/` directory.

### Unified paired-mode detection

`scripts/invoke.js`, `scripts/verify.js`, and `scripts/validate-contract.js` now treat both triggers symmetrically:

```
pairedLike = .stackshift/installed.json exists
          OR design/design-arch.json has isStackShift === true
```

Used as the gate for:

- `+STACKSHIFT_UI` modifier injection (new — was not a modifier before)
- `+A11Y` auto-activation when `a11yRequired` is set
- `--no-design-authority` refusal
- `--creative` refusal
- Validator named-export exception (Variant Router permits one `export { ComponentName }` matching the default export)
- Validator paired-mode body-rule checks (see below)

The marker file remains the authoritative version source — when only `arch.isStackShift` is set, the verify report shows `paired: stackshift theme-only via arch.isStackShift`.

### Shared validator extension: paired-mode body checks

`packages/variant-contract/validate.js` now runs additional regex checks under `pairedMode: true`. Comments and string literals are stripped before pattern matching (two pre-processed copies: comments-only-stripped for import lines and `?? "string"` detection; both-stripped for JSX and `!important`).

**Violations (exit 1):**

- Raw HTML primitives for content — `<h1>…<h6>`, `<p>`, `<button>`, `<a>`, `<img>`, `<section>`
- `!important` inside any `className=` attribute (string, template, or expression — comment / unrelated-string mentions don't trigger)
- `import React from "react"`
- `import * as <X> from "@stackshift-ui/..."`

**Warnings (do not exit 1):**

- `?? "fallback string"` on content props
- Inline `style={{ ... }}` on JSX elements
- Direct `next/image` or `next/link` import
- `@stackshift-ui/system` imported in a variant file

`scripts/validate-contract.js` is now a thin CLI wrapper that delegates to the shared validator (eliminating the prior near-duplicate). `scripts/verify.js` switched from an unreliable dynamic `import()` (which failed silently on Windows due to ESM URL scheme requirements) to a static import, and dropped the stale inline fallback duplicate. The PostToolUse auto-verify hook, MCP `forge_verify` tool, and direct CLI all now route through the same validator with consistent results.

### Scan-time additive directory copy

`scripts/scan.js` `copyBuiltinStandardDir()` is now **file-level idempotent**: instead of skipping the entire directory when the destination exists, it iterates files and skips only the files that already exist in the project copy. This means new upstream files (`09-anti-patterns.md` now, future additions later) automatically land in existing `--theme stackshift` projects on the next rescan, while project edits to existing files are preserved.

Migration for existing projects: just rescan.

```bash
node "$SKILL_ROOT/scripts/cli.js" scan --theme stackshift
# → copies 09-anti-patterns.md into design/standards/stackshift-ui/
#   (other files untouched)
```

### Standards touch-ups

- `references/standards/stackshift-ui/01-import-rule.md` — new "Provider awareness" section documenting why `next/image` and `next/link` should not be imported directly in variant files (the provider wires them site-wide)
- `references/standards/nextjs-image.md` — added a paired-mode interaction note explaining that under `isStackShift: true`, `<Image>` from `@stackshift-ui/image` is preferred over `next/image` direct import

### Theme alignment

`themes/stackshift.json` `tailwind.colorTokens` updated to match the token set that `themeOverride.tailwindExtend` actually seeds (`background`, `foreground`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `card`, `popover`, `border`, `input`, `ring`, the `sidebar-*` family, plus `rounded-global` and `font-global`). The previous string lagged behind the override block.

### Documentation

- `SKILL.md` — `+STACKSHIFT_UI` row added to the Modifiers list; new "StackShift Paired Mode" section
- `README.md` — `+STACKSHIFT_UI` row added to the Signal-Based Generation table
- `references/INDEX.md` — `SIGNAL_STACKSHIFT_UI` row in the prompt-patterns block table
- `references/advanced-usage.md` — new "StackShift paired mode (1.4.0+)" section covering activation triggers, what changes when active, body-rule checks, no-opt-out rationale, and migration from older `--theme stackshift` projects

## Tests

`tests/test-1-4-0-paired-mode-body-rules.mjs` — 49 assertions across 14 groups:

1. New files exist (`09-anti-patterns.md`, `SIGNAL_STACKSHIFT_UI` in patterns)
2. Signal injection via marker path
3. Signal injection via `arch.isStackShift` path
4. Non-paired suppression
5. Validator paired-mode violations (raw HTML, `!important`, `import React`, `import * as`, warnings)
6. False-positive guards (violations inside comments and string literals do not trigger)
7. Non-paired suppression of body checks
8. Theme-only paired mode (validator runs without marker file)
9. `--no-design-authority` refusal under theme-only
10. `--creative` refusal under theme-only
11. Scan additive copy (`09-anti-patterns.md` lands, user edits preserved)
12. Standards injection toggles on `isStackShift`
13. `verify.js` delegates to shared validator (regression test for the Windows ESM URL bug)
14. Theme `colorTokens` alignment

Existing suites — `smoke-existing.mjs` (15 assertions), `test-new-flags.mjs` (58 assertions), `test-1-1-0-fixes.mjs` (33 assertions) — all continue to pass: 155 total assertions across the four files.

## No opt-out by design

There is intentionally no flag to disable paired-mode behaviour. Variant-body generation in a StackShift project needs three things stacked — contract shape (from the interface), library / token vocabulary (from standards + arch), and hard rules (from the addendum + validator). Removing any one produces broken output. A project that no longer wants paired behaviour clears `isStackShift: true` from `design/design-arch.json` and removes `.stackshift/installed.json` if present.
