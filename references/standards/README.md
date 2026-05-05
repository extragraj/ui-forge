# Design Standards — Built-in Files

This directory holds skill-owned fallback standards injected into generation context when a target project hasn't defined its own. Standards support both single `.md` files and directories of `.md` files.

## Current built-in standards

| Path | Slots injected | Status |
|------|---------------|--------|
| `stackshift-ui/` | `01-import-rule`, `02-conditional-link`, `03-component-props`, `04-color-tokens`, `05-typography`, `06-spacing`, `07-setup`, `08-accessibility` | Active — full StackShift UI conventions |
| `nextjs-image.md` | `nextjs-image` | Active — Next.js + Sanity image rendering standard (fill prop, urlFor type safety, container pattern, sizes attribute) |
| `sample-standard.md` | — | Non-substantive template; copy to create a new slot |

## Directory support (0.2.1+)

When `loadDesignStandards()` encounters a directory (in any of the three resolution steps), it reads every `.md` file inside alphabetically and loads each as its own slot. The slot key is the filename minus `.md`.

This lets large design systems be split into focused files — each stays under the 3,000-char per-slot injection limit without compression.

## Resolution order (last wins per key)

Used by `scripts/invoke.js` `loadDesignStandards()`:

1. **`arch.designStandards`** — explicit entries in `design/design-arch.json`. Values can be a file path or a directory path.
2. **Project override** — `PROJECT_ROOT/design/standards/` is fully scanned. Both `.md` files and subdirectories are registered. Re-run `scripts/scan.js` after adding files.
3. **Built-in fallback** — this directory. Gap-fill only; never overwrites a project-supplied or arch-referenced standard.

Opt-out of step 3 with the `--no-default-standards` flag on `invoke.js`, or by setting `"_useBuiltins": false` inside `arch.designStandards`.

## Adding project-local standards

**Option A — single file per slot:**

```
PROJECT_ROOT/
└── design/
    └── standards/
        ├── typography.md       ← slot key: "typography"
        ├── motion.md           ← slot key: "motion"
        └── brand-voice.md      ← slot key: "brand-voice"
```

**Option B — directory of files:**

```
PROJECT_ROOT/
└── design/
    └── standards/
        └── brand/              ← each .md inside is its own slot
            ├── voice.md        ← slot key: "voice"
            ├── colors.md       ← slot key: "colors"
            └── imagery.md      ← slot key: "imagery"
```

**Option C — explicit reference from `design-arch.json`:**

```json
{
  "designStandards": {
    "motion": "./design/standards/motion.md",
    "brand": "./design/standards/brand/"
  }
}
```

Any path and any key are valid. File and directory entries are additive — they stack on top of built-in standards.

## Adding a new built-in standard

**Single file:** Copy `sample-standard.md`, rename to your slot key (e.g. `motion.md`), and fill in content. Any content beyond HTML comments and markdown headings is treated as substantive.

**Directory:** Create a subdirectory (e.g. `my-system/`) and add `.md` files inside. Each file becomes a slot.

Keep each file under **~3,000 characters** — `appendStandards()` in `invoke.js` truncates at 3,000 and logs a stderr warning.

## Source markers in context

Each standard block injected into generation context carries a source marker:

```
// --- STANDARD: 02-conditional-link ---
# source: built-in
<...content...>
```

`source` is `arch`, `project`, or `built-in`. The AI uses this to reason about authority when standards conflict.
