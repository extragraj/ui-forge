---
name: ui-forge
version: 0.1.8
description: >
  Generates production-ready Next.js TSX components from HTML, TSX, images, or JSON.
  Triggers on: "create component", "convert this HTML/TSX/page", "generate from image",
  "implement this variant", or any frontend code generation request. Requires
  design/design-arch.json (run scan.js to create).
---

# UI Forge

Production Next.js component generator using signal-based architecture. Converts HTML, TSX, images, and JSON into project-compliant components.

## How It Works

`invoke.js` is a **context-preparation script**, not an AI client. It loads `design-arch.json`, pre-processes reference files, detects signals, and prints structured generation context to stdout. You (the AI assistant) read that context and generate the component directly — no API calls, no API key required.

## When to Use

- Create/convert components, sections, or page variants
- Transform HTML templates to TSX
- Generate from design mockups (images)
- Build config-driven components (JSON)
- Implement a component body from an externally-owned props interface (companion mode)
- Supported: .html .tsx .jsx .ts .js .json .md .png .jpg .webp

## Prerequisites

Check for `design/design-arch.json` in the target project root. If missing:
```bash
node .claude/skills/ui-forge/scripts/scan.js
```

The path to this skill's `scripts/` directory depends on install location:
  - Claude Code project install: `.claude/skills/ui-forge/scripts/`
  - Claude Code global install:  `~/.claude/skills/ui-forge/scripts/`
  - Agents project install:      `.agents/skills/ui-forge/scripts/`
  - Agents global install:       `~/.agents/skills/ui-forge/scripts/`

Host runners may expose `${CLAUDE_SKILL_DIR}`; when present, prefer it. Examples below use `.claude/skills/ui-forge/` — adapt the path to your install scope.

Contains: component directories, used libraries, Tailwind tokens, global CSS, design standards, patterns.

**No API key required.** Scan uses the `claude` CLI if available, otherwise static analysis. Generation context is prepared by the script; you generate the component.

## Usage

**Single component:**
```bash
node .claude/skills/ui-forge/scripts/invoke.js \
  --task "Convert hero section" \
  --refs ./hero.html \
  --output ./components/Hero.tsx
```

Read the stdout output and generate the component at the path specified in `WRITE OUTPUT TO`.

**With multiple refs:**
```bash
node .claude/skills/ui-forge/scripts/invoke.js \
  --task "Build pricing table" \
  --refs ./pricing.html,./data.json,./mockup.png
```

**Variant (companion mode):**
```bash
node .claude/skills/ui-forge/scripts/invoke.js \
  --task "Build pricing variant" \
  --signal CONVERT_VARIANT \
  --refs ./types.ts \
  --output ./components/Pricing/Variant.tsx
```

**Page conversion (two-stage):**
```bash
# Stage 1 — outputs decomposition context; you write design/forge-page-plan.json
node .claude/skills/ui-forge/scripts/invoke.js --task "Convert page" --refs ./page.html

# Review the plan. Set existingProjectSection:true on sections to skip.

# Stage 2 — plan file exists; outputs generation context for each section
node .claude/skills/ui-forge/scripts/invoke.js --task "Convert page" --refs ./page.html

# Force Stage 1 to re-run (discard existing plan):
node .claude/skills/ui-forge/scripts/invoke.js --task "Convert page" --refs ./page.html --replan
```

**Flags:**

| Flag | Description |
|------|-------------|
| `--task` | What to build (required) |
| `--refs` | Comma-separated reference file paths |
| `--output` | Target output file path (included in context) |
| `--signal` | Force primary signal: `CONVERT_SECTION`, `CONVERT_PAGE`, `CONVERT_VARIANT`. Overrides auto-detection. |
| `--mode` | `full` (default) or `body-only`. `body-only` requires `--output` to point at an existing file. Default is `body-only` when signal is `CONVERT_VARIANT`. |
| `--a11y` | Enable `+A11Y` modifier — WCAG 2.1 AA enforcement. Auto-enabled when `arch.a11yRequired` or `.stackshift/installed.json` sets `a11yRequired: true`. |
| `--creative` | Enable `+CREATIVE` modifier — greenfield generation without a layout ref. Standalone only; refused under `CONVERT_VARIANT`, `CONVERT_PAGE`, and paired mode. |
| `--diff <path>` | Enable `+DIFF` modifier — iterative regeneration of an existing component. The task describes the delta; `--output` defaults to the same path. Refused under `CONVERT_VARIANT`, `CONVERT_PAGE`, and `+CREATIVE`. |
| `--no-default-standards` | Skip built-in fallback standards (arch + project only). Also honoured by `"_useBuiltins": false` in `arch.designStandards`. |
| `--rescan` | Re-run scan.js first |
| `--replan` | Force Stage 1 re-run |
| `--config` | Load all params from a JSON file |

**Scan-only flags** (`scripts/scan.js`):

| Flag | Description |
|------|-------------|
| `--project-root <path>` | Scan a different directory (defaults to cwd) |
| `--patch` | Re-scan everything, preserve existing `designStandards` entries |
| `--quick` | Skip the `claude` CLI synthesis branch (static analysis only) |
| `--ignore <file>` | Load an additional ignore file (repeatable) |
| `--no-default-ignore` | Skip the built-in base ignore list |
| `--theme <name>` | Seed `design-arch.json` from `themes/<name>.json`. Available: `shadcn`, `mantine`, `plain-tailwind`. Gap-fill only — scan-detected values always win. |

## Signals

**Primary (scope):**

| Signal | Trigger | Behavior |
|--------|---------|----------|
| `CONVERT_SECTION` | Default | Single component generation |
| `CONVERT_PAGE` | >400 lines or task mentions "page" | Two-stage pipeline |
| `CONVERT_VARIANT` | `--signal CONVERT_VARIANT` or auto-detected when refs contain exactly one `.ts`/`.tsx` exporting an interface (≤150 lines) with no HTML/image layout refs | Generate body implementing an externally-owned props interface. Companion-skill handoff mode. |

**Modifiers (stackable):**
- `+CONFIG` — JSON/data file present
- `+IMAGE` — Image file present (read via vision capability)
- `+BRAND` — Brand document attached (ref file matching `/brand|voice|tone/i`) or `arch.designStandards.brand` set. Enforces voice/tone and color discipline.
- `+A11Y` — WCAG 2.1 AA enforcement (semantic HTML, headings, labels, contrast, focus, reduced motion). Activate via `--a11y`, `a11y` in config JSON, `a11yRequired: true` in `design-arch.json`, or `a11yRequired: true` in `.stackshift/installed.json` (paired mode).
- `+CREATIVE` — Greenfield mode. No layout ref required; bundles the `// FORGE PHILOSOPHY` directive. **Standalone only** — refused under `CONVERT_VARIANT`, `CONVERT_PAGE`, and paired mode.
- `+DIFF` — Surgical iteration on an existing file. Activated by `--diff <path>`; injects the existing component as a base and instructs the AI to preserve everything the task does not ask to change. **`CONVERT_SECTION` only** — refused under `CONVERT_VARIANT`, `CONVERT_PAGE`, and `+CREATIVE`.

**Signal composition:**
- `CONVERT_VARIANT` is mutually exclusive with `CONVERT_PAGE` (never compose)
- `CONVERT_VARIANT` can compose with `+CONFIG`, `+IMAGE`, `+BRAND`, `+A11Y` (never `+CREATIVE` / `+DIFF`)
- `CONVERT_PAGE` can compose with `+BRAND`, `+A11Y` (never `+CREATIVE` / `+DIFF`)
- `+DIFF` is `CONVERT_SECTION`-only and refuses to compose with `+CREATIVE`
- If auto-detection would trigger both `CONVERT_VARIANT` and `CONVERT_PAGE`, the script exits with an error asking the caller to pass `--signal` explicitly

**Examples:**
- HTML → `CONVERT_SECTION`
- HTML + JSON → `CONVERT_SECTION +CONFIG`
- Image → `CONVERT_SECTION +IMAGE`
- HTML + `brand.md` → `CONVERT_SECTION +BRAND`
- `--creative` with no refs → `CONVERT_SECTION +CREATIVE`
- Large HTML → `CONVERT_PAGE`
- Props `.ts` file only → `CONVERT_VARIANT`
- Props `.ts` file + JSON + `brand.md` → `CONVERT_VARIANT +CONFIG +BRAND`

## Output Format

The script prints structured context to stdout. You generate the component based on it.

Generated components must always begin with `// FORGE NOTES`:
```tsx
// FORGE NOTES
// Detected: [ref type and styling]
// Swaps: [library component mappings]
// Token mappings: [color/spacing conversions]
// Conflicts: [any issues]
```

**Code** (raw, no fences):
- Single file: Code directly after FORGE NOTES
- Multiple files: `// --- FILE: path/to/file.tsx` separator

## Resolution Priority

**Default (`CONVERT_SECTION` / `CONVERT_PAGE`):**

1. Design standards (if defined in designStandards)
2. design-arch.json (component dirs, libraries, tokens)
3. Config file (JSON) — wins for data shape
4. Reference file — wins for layout
5. User overrides — always valid

**`CONVERT_VARIANT` (companion mode):**

1. Design standards from designStandards (includes companion-skill protocols)
2. Props interface (the contract — structural authority)
3. design-arch.json (component dirs, libraries, tokens)
4. Config file (JSON) — data shape hints
5. Image reference — visual proportions only
6. User overrides — always valid

Note: under `CONVERT_VARIANT`, the props interface outranks config/reference because the interface *is* the contract.

**Quality:** Production-ready, no TODOs, avoid `any`, reuse existing types.

## Companion Invocation

ui-forge can be invoked by workflow skills (e.g. StackShift) that have
already scaffolded the output file, wired the module router, and exported
a props interface. In this mode:

- The caller passes `--signal CONVERT_VARIANT` and `--mode body-only`
- The primary ref is the `.ts`/`.tsx` file containing the exported props interface
- Secondary refs may include initialValue JSON and a thumbnail image
- ui-forge writes only the component body; it never modifies index.tsx,
  the props interface, or any schema/query file
- Protocols declared in design-arch.json.designStandards are loaded and
  honored as the highest-priority standards

### Contract version tag (0.1.3+)

Declare `/** @contract-version 1.0.0 */` in the props interface JSDoc. Absence defaults to `1.0.0`. UI Forge parses the tag and surfaces it in the CONTRACT header; warns on stderr for unrecognised versions.

### Post-generation contract check (0.1.3+)

```bash
node .claude/skills/ui-forge/scripts/validate-contract.js ./Variant.tsx ./types.ts
```
Asserts single default export, no disallowed named exports, contract imported, all required props consumed, `null` fallback present. Exit `1` on violations (CI-usable). `verify.js` adds optional Playwright visual check.

### Paired-mode detection (0.1.3+)

When `.stackshift/installed.json` exists, UI Forge adds `PAIRED: stackshift x.y.z` to the output header and honors `a11yRequired` (auto-activates `+A11Y`).

### Ignore files (0.1.4+)

`scan.js` reads `.gitignore`, `.forgeignore`, and any `--ignore <file>`. Precedence: `built-in → .gitignore → .agentic.ignore → .claude.ignore → .forgeignore → --ignore`. Seed template: `cp .claude/skills/ui-forge/references/default-forgeignore.txt .forgeignore`. See `advanced-usage.md` for full syntax.

### Built-in design standards (0.1.4+)

Gap-fills `typography`, `spacing`, `color`, `a11y` slots from `design/standards/<key>.md` then skill-owned templates. Opt-out: `--no-default-standards` or `"_useBuiltins": false` in `designStandards`. See `advanced-usage.md` for resolution order and custom slots.

### Brand and Creative signals (0.1.5+)

`+BRAND`: activates when a ref matches `/brand|voice|tone/i` or `arch.designStandards.brand` is set. `+CREATIVE`: activates via `--creative`; bundles `// FORGE PHILOSOPHY`. Refused under `CONVERT_VARIANT`, `CONVERT_PAGE`, and paired mode.

### Diff signal (0.1.6+)

`--diff <path>` activates `+DIFF` for surgical iteration on an existing file. Injects it as `EXISTING COMPONENT`; `--output` defaults to same path; FORGE NOTES gains a `DIFF` sub-block. Refused under `CONVERT_VARIANT`, `CONVERT_PAGE`, and `+CREATIVE`.

### Theme starters (0.1.6+)

`scan.js --theme <name>` seeds `design-arch.json` from a preset. Available: `shadcn`, `mantine`, `plain-tailwind`. Gap-fill only — scan data wins.

## Advanced

See `.claude/skills/ui-forge/references/` (adjust path to your install scope):
- `INDEX.md` — topic index with line ranges for targeted reads (use `Read offset/limit`)
- `advanced-usage.md` — config files, custom signals, ignore patterns, troubleshooting
- `prompt-patterns.md` — signal composition patterns
- `versions.md` — Node, Next.js, StackShift, component library compatibility matrix

**Requires:** Node.js >=18
**Consumed by (companion mode):** stackshift-workflow-skills >=0.1.5
