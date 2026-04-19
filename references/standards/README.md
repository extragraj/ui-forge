# Design Standards — Built-in Templates

This directory holds skill-owned fallback standards injected into the generation
context when the target project hasn't defined its own. The four canonical
slots are:

| Key | File | Scope |
|-----|------|-------|
| `typography` | `typography.md` | Heading scale, line-height, letter-spacing, fluid type |
| `spacing`    | `spacing.md`    | Container widths, section padding, gap defaults |
| `color`      | `color.md`      | Semantic token discipline, contrast floors, dark-mode parity |
| `a11y`       | `a11y.md`       | Focus states, landmarks, labels, motion preferences |

**The templates in this directory ship EMPTY by default.** They are intentional
placeholders — a skill maintainer may fill them in later, but UI Forge will
skip any template whose body contains only HTML comments or headings. Empty
templates do not appear in generation context and do not interfere with the
AI's defaults.

## Resolution order (last wins per key)

Used by `scripts/invoke.js` `loadDesignStandards()`:

1. **`arch.designStandards`** — explicit entries in `design/design-arch.json`.
   Includes `stackshiftComponentStandard` for paired-mode projects.
2. **Project override** — `PROJECT_ROOT/design/standards/<key>.md`.
   Auto-registered by `scripts/scan.js` at scan time.
3. **Built-in fallback** — this directory. Gap-fill only; never overwrites a
   project-supplied or arch-referenced standard.

Opt-out of step 3 with the `--no-default-standards` flag on `invoke.js`, or by
setting `"_useBuiltins": false` inside `arch.designStandards`.

## Adding project-local standards

Two ways, both auto-detected:

**Option A — one file per slot** (recommended; matches the built-in structure):

```
PROJECT_ROOT/
└── design/
    └── standards/
        ├── typography.md
        ├── spacing.md
        ├── color.md
        └── a11y.md
```

Scan auto-registers each `*.md` file in `design/standards/` using the filename
(minus `.md`) as the key. Re-run `scripts/scan.js` after adding files.

**Option B — custom key referenced from `design-arch.json`**:

```json
{
  "designStandards": {
    "componentGuide": "./docs/component-guide.md",
    "animation": "./design/motion.md"
  }
}
```

Any path and any key are valid. Custom keys are additive — they don't replace
the four canonical slots.

## Filling in a built-in template

If you're vendoring this skill and want every install to ship with opinionated
defaults, edit the template files in place. Anything beyond HTML comments and
markdown headings will make the template count as "substantive" and start
flowing into generation context for projects that don't override the slot.

Keep each file under ~3,000 characters — the injector truncates past that and
logs a stderr warning.

## Source markers in context

Each standard block injected into the generation context includes a one-line
source marker:

```
// --- STANDARD: typography ---
# source: built-in
<...content...>
```

`source` is `arch`, `project`, or `built-in` — the AI can use this to reason
about authority when standards conflict.
