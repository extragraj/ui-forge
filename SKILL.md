---
name: ui-forge
version: 0.1.2
description: >
  Generates production-ready Next.js TSX components from prompts and reference
  materials (HTML, TSX, images, JSON). Converts sections, pages, and variants
  using project design standards. Triggers on: "create component", "convert
  this HTML/TSX/page", "generate from image", or any frontend code generation
  request. Requires design/design-arch.json (auto-created on first use).
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
| `--rescan` | Re-run scan.js first |
| `--replan` | Force Stage 1 re-run |
| `--config` | Load all params from a JSON file |

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

**Signal composition:**
- `CONVERT_VARIANT` is mutually exclusive with `CONVERT_PAGE` (never compose)
- `CONVERT_VARIANT` can compose with `+CONFIG` and `+IMAGE`
- If auto-detection would trigger both `CONVERT_VARIANT` and `CONVERT_PAGE`, the script exits with an error asking the caller to pass `--signal` explicitly

**Examples:**
- HTML → `CONVERT_SECTION`
- HTML + JSON → `CONVERT_SECTION +CONFIG`
- Image → `CONVERT_SECTION +IMAGE`
- Large HTML → `CONVERT_PAGE`
- Props `.ts` file only → `CONVERT_VARIANT`
- Props `.ts` file + JSON → `CONVERT_VARIANT +CONFIG`

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

See the caller's workflow documentation for the exact CLI invocation.
ui-forge is stateless — every invocation is self-contained.

## Advanced

See `.claude/skills/ui-forge/references/` (adjust path to your install scope):
- `advanced-usage.md` — Config files, custom signals, troubleshooting
- `examples.md` — Real-world conversion examples
- `prompt-patterns.md` — Signal composition patterns

**Requires:** Node.js >=18
**Consumed by (companion mode):** stackshift-workflow-skills >=0.1.5
