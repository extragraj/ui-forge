# 0.2.1 — Directory-based Design Standards & Full StackShift UI Standard

**Date:** 2026-04-30

## What changed

### Directory support in `loadDesignStandards()` (`scripts/invoke.js`)

Design standards now support directories in all three resolution steps. Previously, every standard was a single `.md` file and the 3,000-char per-slot truncation limit made it impractical to ship rich, uncompressed standards for large design systems.

**New behavior:**

| Path type | Behavior |
|-----------|----------|
| `path/to/standard.md` | Loaded as a single slot (unchanged) |
| `path/to/standard/` (directory) | Each `.md` file inside is loaded as its own slot, keyed by filename minus `.md`, sorted alphabetically |

This applies to all three resolution steps:
- **Step 1** — `arch.designStandards` entries can now point to a directory path
- **Step 2** — `PROJECT_ROOT/design/standards/` is now fully scanned; both `.md` files and subdirectories are registered
- **Step 3** — `references/standards/` is now fully scanned; subdirectories auto-load all `.md` files inside

**`readdirSync` added** to the `fs` import in `invoke.js`.

**`BUILTIN_STANDARD_KEYS`** updated to include `stackshift-ui` so project-local overrides at `design/standards/stackshift-ui.md` are recognized by Step 2.

### `references/standards/stackshift-ui/` — Full StackShift UI standard (directory)

Eight focused files, each well under the 3,000-char limit, replacing the compressed single-file approach:

| File | Slot key | Content |
|------|----------|---------|
| `01-import-rule.md` | `01-import-rule` | Full component library table, standard import pattern, Card exports, system package restriction |
| `02-conditional-link.md` | `02-conditional-link` | `conditionalLink` type definition, `<Button as="link">` required pattern, `link` prop shape, variant guidance, ❌ anti-patterns, aria-label rule |
| `03-component-props.md` | `03-component-props` | Full props tables: Button (variant/size/as/icon), Heading (type/fontSize/weight/muted), Text, Flex (align/direction/justify/wrap/gap), Container/Section (maxWidth/as) |
| `04-color-tokens.md` | `04-color-tokens` | Full CSS variable → Tailwind token table with light and dark defaults, theming chain diagram, usage examples, neutral surface policy, contrast notes, gradient policy |
| `05-typography.md` | `05-typography` | Heading scale table with use cases, Text scale table with roles, font-family CMS rule, responsive type pattern, truncation |
| `06-spacing.md` | `06-spacing` | Section rhythm table (py-12/16/20), Container maxWidth reference, Flex gap scale table, responsive layout patterns, Card default padding, Grid usage |
| `07-setup.md` | `07-setup` | `tailwind.config.ts` content scanning requirement, `StackShiftUIProvider` setup in `pages/_app.tsx`, active overrides (Image → Next.js Image, Link → Next.js Link), adding new overrides, package update commands |
| `08-accessibility.md` | `08-accessibility` | Section landmark rule, component accessibility guarantee table (dialog/sheet/dropdown-menu/accordion/toast/tooltip), Image alt policy, FormField labeling, focus management, motion reduction, live regions |

### `references/standards/stackshift-ui.md` removed

The compressed single-file version is replaced by the directory. The directory approach is uncompressed, fully utilizes the reference material, and each file stays comfortably under the 3,000-char limit.

### `references/standards/README.md` updated

Documents the directory support, updated file listing, and project-local override instructions for directory-based standards.

## Breaking changes

None. Existing `arch.designStandards` entries pointing to `.md` files continue to work unchanged. The directory scan in Steps 2 and 3 is additive — it only fills keys not already registered.

## Files changed

- `scripts/invoke.js` — `readdirSync` import; `BUILTIN_STANDARD_KEYS` + `stackshift-ui`; `loadDesignStandards()` rewritten with `loadPath()` helper supporting files and directories
- `references/standards/stackshift-ui/` — new directory with 8 standard files
- `references/standards/stackshift-ui.md` — removed
- `references/standards/README.md` — updated
- `README.md` — updated (version, standards section, changelog row)
