# 0.2.5 — Reference-Based Design Authority & Structured Output

Fixes issues H-1 and H-2: lite mode was copying Design Authority content verbatim and
using uninformative `[REF]` standard labels; non-lite mode was embedding full tailwind
theme sections and globals.css inline, and lacked structured generation sections.

## Changes

### `archToContext()` — reference-based format for both modes (H-1 + H-2)

Both lite and non-lite modes now output a compact reference block instead of copying
content verbatim:

```
DESIGN AUTHORITY: design/design-arch.json
  componentLib: ./components, ./components/ui
  tokens: primary, accent, ink, background, foreground, border
  tailwind: tailwind.config.ts
  globalCss: app/globals.css
  spacing: Section containers use px-8 (desktop) / px-5 (mobile)
  typography: Primary body font is Inter (sans)
  usedComponents: ...   ← non-lite only
  usedLibraries: ...    ← non-lite only
  conventions: ...      ← non-lite only
```

Previously:
- Lite mode dumped all library names, token values, spacing, and typography verbatim
- Non-lite mode additionally embedded up to 500 chars of `tailwind.theme` and 300 chars
  of `globals.css` content inline with no path reference

Two new helpers locate the actual config files on disk: `findTailwindConfigPath()` checks
for `tailwind.config.{ts,js,mjs,cjs}` and `findGlobalCssPath()` checks common Next.js
CSS locations. If a file is found, its relative path is shown; the AI can read it on demand.

### `appendStandards()` — informative `[REF]` format for both modes (H-1)

Standards are now always listed as load-on-demand references rather than injected inline.
Both modes use the same format with a path and a one-line description extracted from the
standard content:

```
DESIGN STANDARDS (load as needed)
// [REF] 01-import-rule [.claude/skills/ui-forge/references/standards/stackshift-ui/01-import-rule.md]: Use when importing any @stackshift-ui/* component
// [REF] 02-conditional-link [...]: Use whenever rendering primaryButton or secondaryButton fields
```

Previously:
- Lite mode: `// [REF] STANDARD: key (Source: built-in)` — no description, no path
- Non-lite mode: full content of each standard (up to 3000 chars each) injected inline

`loadDesignStandards()` now tracks the absolute path of every loaded standard file. A new
`extractStandardDescription()` helper pulls the first substantive line from the content for
the description. Paths are made relative to `PROJECT_ROOT` and normalized to forward slashes.

### IMPLEMENTATION + ANTI-SLOP GUARDRAILS sections (H-2)

Non-lite `CONVERT_SECTION` and `CONVERT_PAGE` (Stage 2) output now includes two new
structured sections between the refs and GENERATION INSTRUCTIONS:

```
IMPLEMENTATION
1. Identify the primary layout pattern from REFERENCE
2. Map reference CSS classes/values to design-arch.json tokens
3. Check DESIGN STANDARDS relevant to components used
4. Write FORGE NOTES then generate TSX

ANTI-SLOP GUARDRAILS
- No default hero gradients unless reference explicitly shows them
- No rainbow headings — single-color or design-arch tokens only
- Padding/spacing must match reference CSS values — do not default to py-20
- Background: confirm dark vs light from reference — do not assume dark
- No filler CTAs or Lorem ipsum — reproduce content from reference exactly
```

These sections are skipped in lite mode to maintain token efficiency.

## Files Changed

- `scripts/invoke.js` — `archToContext()`, `appendStandards()`, `loadDesignStandards()`,
  `buildSectionContext()`, `buildVariantContext()`, `buildPageStage1Context()`,
  `buildPageStage2Context()`; added `findTailwindConfigPath()`, `findGlobalCssPath()`,
  `extractStandardDescription()`; added `relative` to path imports
