# 0.2.7A — StackShift Paired-Mode Named Export Fix

## Problem

`validate-contract.js` and `verify.js` both flagged `export { ComponentName }` as a
violation ("Disallowed named exports") on every StackShift-paired variant generation.
This was a systemic false positive — not a per-session anomaly.

The root cause was a direct conflict between two requirements:

| Source | Rule |
|--------|------|
| UI Forge generation instructions | Do NOT write any export other than the default component export |
| StackShift Variant Router protocol | Named export after default: `export { MySection_X }` |

The validator had no awareness of paired mode and treated the required named export as
a violation. Every existing custom variant (`variant_i.tsx`, `variant_j.tsx`, `variant_k.tsx`)
was already in production with this named export, so the postcondition gate on every
StackShift-paired variant generation was permanently blocked.

## Fix

**Auto-detect paired mode** in all three validator paths. When `.stackshift/installed.json`
exists in the project root, one named export whose identifier matches the default export
function name is permitted. No flag or annotation required.

### Files changed

- **`scripts/validate-contract.js`** — detects `.stackshift/installed.json`, extracts
  the default export name with `getDefaultExportName()`, and passes it as `pairedDefaultName`
  to `findDisallowedNamedExports()`. The matching `export { Name }` is silently skipped.
  Report header now shows `paired: stackshift (named export "Name" permitted)` when active.

- **`packages/variant-contract/validate.js`** — `validate()` now accepts an optional
  third argument `options = {}` with a `pairedMode` boolean. When `true`, resolves the
  default export name from the source and exempts it from the named-export check.

- **`scripts/verify.js`** — passes `{ pairedMode: !!paired }` to `validateFn` so the
  shared library path respects paired mode. The inline fallback path applies the same
  logic when the shared module is unavailable.

- **`references/prompt-patterns.md`** — `SIGNAL_VARIANT` block updated: the export
  invariant now documents the paired-mode exception (`PAIRED: stackshift` context header),
  the FORGE NOTES template shows the conditional exports line, and the POST-GENERATION
  note explains that the validator handles this automatically.

- **`CLAUDE.md`** — architecture descriptions for `validate-contract.js` and `verify.js`
  updated to document the paired-mode behavior.

## Behaviour change

| Scenario | Before | After |
|----------|--------|-------|
| StackShift paired project, variant with `export { Features_K }` | `CONTRACT CHECK: FAIL — Disallowed named exports: export { Features_K }` | `CONTRACT CHECK: PASS` |
| Non-paired project, variant with extra named export | `CONTRACT CHECK: FAIL` | `CONTRACT CHECK: FAIL` (unchanged) |
| Paired project, variant with an _extra_ named export beyond the component name | `CONTRACT CHECK: FAIL` | `CONTRACT CHECK: FAIL` (only the matching export is exempted) |
