# 0.1.7 — Golden examples, --preview, --verify, dark-mode schema v4, variant-contract package

Released 2026-04-21.

## Summary

Six independent additions across the tool, all backwards-compatible:

1. **Golden conversion examples** — `examples/` directory with four annotated input/output pairs covering every primary signal.
2. **`--preview` flag** — writes `forge-preview.html`, a styled snapshot of the generation context for human review before Claude runs. Refused in StackShift-paired mode.
3. **`--verify` flag** — adds a CONTRACT CHECK requirement to FORGE NOTES. Use `scripts/verify.js` for full post-generation static + Playwright checks.
4. **`--validate-input` flag** — pre-flight validates the incoming props interface file in `CONVERT_VARIANT` mode. Fails fast on malformed contracts.
5. **Schema v4 + dark-mode tokens** — `scan.js --schema-v4` extracts `dark:` Tailwind utilities into `tailwind.darkColorTokens`. `invoke.js` includes dark tokens in context when present. `loadDesignArch()` auto-migrates v3 → v4. Version-gated behind the flag; v3 projects are unaffected.
6. **`@extragraj/variant-contract` package** — `packages/variant-contract/` ships a zero-dependency validator module (`validate.js`) and contract spec (`contract.schema.json`). `scripts/verify.js` imports from it; both `validate-contract.js` and `verify.js` share consistent check logic.

## 1. Golden conversion examples

New directory: `examples/` with four signal demonstrations.

| Directory | Signal | What it shows |
|-----------|--------|---------------|
| `01-hero-section/` | `CONVERT_SECTION` | HTML → TSX with inline-style token mapping, `next/image` swap, responsive column collapse |
| `02-marketing-page/` | `CONVERT_PAGE` | Multi-section HTML + Stage 1 `forge-page-plan.json` output |
| `03-config-driven/` | `CONVERT_SECTION +CONFIG` | Pricing HTML + JSON data shape → typed props interface, `tiers` array, highlighted-tier variant |
| `04-stackshift-variant/` | `CONVERT_VARIANT` | StackShift Variant Router props interface (`@contract-version 1.0.0`) → valid variant body with full CONTRACT sub-block in FORGE NOTES |

Each example ships with an `input/` directory (the ref files) and an `output/` directory (the expected generated result). The output files document every token mapping, import swap, and divergence in `// FORGE NOTES`.

## 2. `--preview` flag

`invoke.js --preview` writes `forge-preview.html` to the project root. The file is a self-contained, dark-themed HTML snapshot showing:
- Signal + modifiers detected
- Task description
- Design authority excerpt
- All reference file content (non-image)
- Design standards blocks with source labels

This lets you verify the generation context visually before invoking Claude — useful for spotting token-mapping gaps or off-signal classification.

**Refused in paired (StackShift) mode** with a clear message directing to `next dev` or Sanity Studio.

## 3. `--verify` and `scripts/verify.js`

### `--verify` flag on `invoke.js`

Adds a `VERIFY` block to the `GENERATION INSTRUCTIONS` section of the output context. Under `CONVERT_VARIANT`, the block specifies the exact CONTRACT CHECK items Claude must self-verify and record in FORGE NOTES. Under `CONVERT_SECTION`, it asks Claude to include a VERIFY line summarising key output invariants.

### `scripts/verify.js` — standalone post-generation verifier

Run after Claude has written the component:

```bash
node scripts/verify.js <output-file> <contract-file>
node scripts/verify.js ./Hero.tsx ./HeroProps.ts --playwright http://localhost:3000
```

Static checks (always run, no dependencies):
- Single default export
- No disallowed named exports
- Contract interface imported (not redefined)
- All required props consumed
- `null` fallback present when required props exist
- No `?? null` for optional props (warns; should be `?? undefined`)

Paired-mode check: if `.stackshift/installed.json` is present and `a11yRequired` is set, warns if no landmark elements or `aria-*` attributes are detected.

Visual check (`--playwright <url>`): launches a headless Chromium browser, navigates to the URL, captures a full-page screenshot to `forge-screenshots/verify-<timestamp>.png`, and reports any page-level JS errors. Requires `@playwright/test` (`npx playwright install`).

Exit codes: `0` = pass, `1` = violations found, `2` = invocation error.

## 4. `--validate-input` flag

`invoke.js --validate-input` is a pre-flight guard for `CONVERT_VARIANT` mode. Before generating context, it confirms:
- A props interface file is present in `--refs`
- The interface name can be extracted (not a malformed or empty file)

Fails fast (`process.exit(1)`) if validation fails. On success, prints:

```
ui-forge: input validation passed — interface: HeroVariantProps (./HeroProps.ts)
```

This implements the UI Forge side of the StackShift pre-flight contract check — catching malformed handoff files before generation begins.

## 5. Schema v4 — dark-mode tokens

### `scan.js --schema-v4`

Activates dark-token extraction and writes `_v: 4` to `design-arch.json`. When active, the scanner reads up to 100 source files for `dark:` prefixed Tailwind utilities and stores them as a comma-separated string in `tailwind.darkColorTokens`.

The `darkColorTokens` namespace is reserved per the cross-project theming coordination note: it must not conflict with Sanity Studio's dark-mode theming if StackShift adds it in a future version.

Gap-fill only — existing projects that don't pass `--schema-v4` continue to produce v3 output.

### `invoke.js` migration

`loadDesignArch()` auto-upgrades `_v: 3` → `_v: 4` on read. The migration is additive: `darkColorTokens` defaults to `undefined` if not present in the file. No structural changes to v3 fields.

`archToContext()` emits a `darkColorTokens:` line when the field is present, making dark-mode variants visible to Claude during generation.

### Backwards compatibility

- Projects without `--schema-v4` continue to write `_v: 3`.
- `invoke.js` reads both v3 and v4 files without changes to caller code.
- The `darkColorTokens` line in context only appears when the field is set — no silent injection on fresh installs.

## 6. `@extragraj/variant-contract` package

New directory: `packages/variant-contract/`

| File | Purpose |
|------|---------|
| `validate.js` | Zero-dependency ESM module exporting `validate(outputSrc, contractSrc)` → `{ valid, violations, warnings, meta }` |
| `contract.schema.json` | Machine-readable spec listing all contract invariants: export rules, import rules, prop rules, null fallback, FORGE NOTES CONTRACT sub-block requirement |
| `package.json` | `@extragraj/variant-contract@1.0.0` — ready to publish as a shared npm package |

`scripts/verify.js` imports `validate` from this module when available (falls back to inline logic if the path is missing). `scripts/validate-contract.js` is unchanged and continues to operate as a standalone CLI.

The `contract.schema.json` `compatibility` field records minimum compatible versions:
```json
{ "uiForge": ">=0.1.3", "stackshift": ">=0.1.5" }
```

## Files changed

- `scripts/invoke.js` — `writeFileSync` import, `escapeHtml` + `generatePreviewHtml` helpers, v3→v4 migration in `loadDesignArch`, `darkColorTokens` in `archToContext`, `--preview` / `--verify` / `--validate-input` flags, preview generation after each output path, verify notes in `buildSectionContext` + `buildVariantContext`.
- `scripts/scan.js` — `--schema-v4` flag, `extractDarkTokens()` function, `darkColorTokens` in arch output, `_v: 4` when flag set.
- `scripts/verify.js` — NEW post-generation verifier with Playwright support.
- `packages/variant-contract/validate.js` — NEW shared validator module.
- `packages/variant-contract/contract.schema.json` — NEW contract invariant spec.
- `packages/variant-contract/package.json` — NEW package descriptor.
- `examples/` — NEW directory with 4 annotated conversion examples.
- `CLAUDE.md`, `README.md` — updated commands, key files, changelog table.

## Backwards compatibility

- All existing `invoke.js` stdout formats are byte-identical when new flags are not passed.
- `design-arch.json` v3 files are auto-migrated to v4 on read — no manual action needed.
- `--schema-v4` is opt-in; `--preview` / `--verify` / `--validate-input` are opt-in.
- `validate-contract.js` is unchanged.
- All StackShift paired-mode invariants preserved.
