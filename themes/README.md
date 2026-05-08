# Theme starters (0.1.6+)

Baseline presets for fresh or greenfield projects. Loaded via
`scan.js --theme <name>`. Fills gaps in `design-arch.json` without
overriding anything the scanner actually detects.

## Available themes

| Name | Library assumption | `themeOverride` support |
|------|--------------------|-----------------------|
| `shadcn` | Tailwind + shadcn/ui primitives (Radix under the hood) | No |
| `stackshift` | StackShift UI — `@stackshift-ui` scoped packages, Sanity CMS theming, Next.js Image/Link via `StackShiftUIProvider` | **Yes** — use with `--theme-override` to bootstrap `globals.css` + `tailwind.config.*` |
| `mantine` | Mantine UI v7 + `@mantine/core` | No |
| `plain-tailwind` | No component library, Tailwind only | No |

## `--theme-override` (stackshift only)

The `stackshift` theme includes a `themeOverride` section that surgically replaces three sections in your project files before the scan reads them:

1. **Google Fonts `@import`** in `globals.css` — replaced with Inter font import
2. **`@layer base` block** in `globals.css` — replaced with HSL CSS variable definitions (light + dark)
3. **`theme.extend` section** in `tailwind.config.*` — replaced with color tokens, border radius, spacing, font family, font sizes, and font weights

```bash
scan.js --theme stackshift --theme-override          # modifies files + creates .bak
scan.js --theme stackshift --theme-override --no-backup  # modifies files, no backup
```

**Rules:**
- Requires `--theme stackshift`
- Non-Google-Fonts `@import` lines are preserved untouched
- Running twice is idempotent — second run produces identical output
- `.bak` files created by default; use `--no-backup` to skip

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
