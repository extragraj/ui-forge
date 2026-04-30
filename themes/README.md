# Theme starters (0.1.6+)

Baseline presets for fresh or greenfield projects. Loaded via
`scan.js --theme <name>`. Fills gaps in `design-arch.json` without
overriding anything the scanner actually detects.

## Available themes

| Name | Library assumption |
|------|--------------------|
| `shadcn` | Tailwind + shadcn/ui primitives (Radix under the hood) |
| `stackshift` | StackShift UI — `@stackshift-ui` scoped packages, Sanity CMS theming, Next.js Image/Link via `StackShiftUIProvider` |

## Merge behavior

Per key, scan findings win when non-empty. The theme fills gaps:

- `componentLib` — scan-detected dirs win. If scan falls back to the
  default `['./components']`, the theme replaces it.
- `usedComponents` / `usedLibraries` — scan results are authoritative.
  Theme hints are appended (deduped) when scan finds fewer than ~5.
- `patterns.spacing` / `patterns.typography` — used only when synthesis
  returned `"unknown"` (static fallback path).
- `patterns.conventions` — theme hints appended when synthesis produced
  zero conventions.
- `tailwind.colorTokens` — used only when synthesis returned an empty
  string.

`arch._theme` records which theme was applied, for auditing.

## Opt out

Omit `--theme` (default). Re-run `scan.js` without `--theme` to drop the
marker — the theme never persists if the flag is absent.
