# 0.3.0 — `--theme-override` and `--no-design-authority` flags

**Date:** 2026-05-08

Two new flags to give users more control over the scan-forge pipeline.

---

## Feature 1: `--theme-override` (scan.js)

Surgically replaces three sections in project files **before** the scan reads them, then the scan picks up the modified files naturally. No changes to `design-arch.json` format, no changes to forge output.

### What it replaces

| Target | Location | Method |
|--------|----------|--------|
| Google Fonts `@import url(...)` | `globals.css` | Regex: only Google-Fonts-style URLs; other `@import` lines preserved |
| `@layer base { ... }` block | `globals.css` | Brace-counted parser (not regex) — handles nested `:root` + `.dark` blocks |
| `theme.extend { ... }` section | `tailwind.config.*` | Brace-counted parser — works for ESM (`satisfies Config`), CJS (`module.exports`), any nesting |

### `themeOverride` added to `themes/stackshift.json`

The StackShift theme now includes a `themeOverride` section with: Inter font Google Fonts import, full `@layer base` block (HSL CSS variables, light + dark, including sidebar tokens), and a complete `theme.extend` block (colors, borderRadius, spacing, fontFamily, fontSize, fontWeight).

### Usage

```bash
# Bootstrap globals.css + tailwind.config.ts from stackshift defaults, then scan
scan.js --theme stackshift --theme-override

# Skip .bak backup creation
scan.js --theme stackshift --theme-override --no-backup
```

### Rules

- Requires `--theme` to be specified (any theme with a `themeOverride` section)
- Currently, only `themes/stackshift.json` has `themeOverride` data
- `.bak` backup files written by default — use `--no-backup` to skip
- Running twice is **idempotent** (second run produces identical output)
- Refuses with a clear error when `theme.extend` or `theme: {` is not statically locatable
- Aborts on unbalanced braces (corrupted file guard)

### Safety design

- **Brace-counted parser** (not regex): required because naïve regex stops at the first `}` inside nested blocks. The walker skips braces inside line comments, block comments, and string literals.
- **Mandatory `.bak` backups**: this is a destructive on-disk transform — backups are default-on.
- **Targeted font-import replacement**: only `https://fonts.googleapis.com` and `https://fonts.gstatic.com` URLs are replaced; all other `@import` lines are preserved and logged.

---

## Feature 2: `--no-design-authority` (invoke.js)

Strips the design authority block (arch context + design standards) from forge output. The AI follows the reference's styling instead of the project's design system.

### What it removes

- `DESIGN AUTHORITY: design/design-arch.json` header and arch context block
- `appendStandards()` output (all design standards references)

### What it adds instead

```
DESIGN AUTHORITY: NONE — following reference styling
The reference file(s) define the visual design. Map colors, spacing, typography,
and layout directly from the reference. Do NOT consult design-arch.json or any
design standards. Preserve the reference's styling as closely as possible.
If multiple refs are provided, use the first (primary) reference for styling decisions.
```

### Usage

```bash
forge.js --task "Convert hero" --refs ./ref.html --no-design-authority
```

### Rules

- Requires at least one `--refs` file (enforced at runtime)
- **Refused in paired (StackShift) mode** — mirrors the existing `+CREATIVE` refusal; design authority is always required in paired mode
- Compatible with `--creative` (allowed; creative already relaxes ref requirements)
- Compatible with `CONVERT_VARIANT` (contract still enforced; only design authority stripped)
- Compatible with `CONVERT_PAGE` (both Stage 1 and Stage 2 skip design authority)
- Works with `--preview` (preview HTML shows "NONE" instead of arch context)
- Note: design standards are also stripped — they are considered part of project design authority

---

## Files Changed

| File | Change |
|------|--------|
| `scripts/scan.js` | Added `THEME_OVERRIDE`, `NO_BACKUP` constants; `matchBrace()`, `replaceLayerBase()`, `replaceTailwindExtend()`, `applyThemeOverride()` helper functions; `--theme-override` call in `main()` |
| `scripts/invoke.js` | Added `noDesignAuthority` flag normalization + paired-mode refusal + refs validation; updated all 4 context builders + `generatePreviewHtml()` |
| `scripts/cli.js` | Updated `forge-scan.md` hint to include new scan flags |
| `themes/stackshift.json` | Added `themeOverride` section (Inter font import, `@layer base` HSL tokens, `theme.extend` block) |
| `CLAUDE.md` | Documented `--theme-override` and `--no-design-authority` for developers |
| `README.md` | Updated theme starters section; added new flags to scan + forge flag tables |
| `SKILL.md` | Updated scan/forge flag tables |
| `themes/README.md` | Updated theme table; added `--theme-override` section |
| `tests/test-new-flags.mjs` | 58 tests (16 test groups) covering both features end-to-end |
| `tests/smoke-existing.mjs` | 15 smoke tests confirming no regressions in existing flags |
