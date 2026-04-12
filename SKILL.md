---
name: ui-forge
version: 0.1.1
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
- Supported: .html .tsx .jsx .ts .js .json .md .png .jpg .webp

## Prerequisites

Check for `design/design-arch.json` in the target project root. If missing:
```bash
node ${CLAUDE_SKILL_DIR}/scripts/scan.js
```

Contains: component directories, used libraries, Tailwind tokens, global CSS, design standards, patterns.

**No API key required.** Scan uses the `claude` CLI if available, otherwise static analysis. Generation context is prepared by the script; you generate the component.

## Usage

**Single component:**
```bash
node ${CLAUDE_SKILL_DIR}/scripts/invoke.js \
  --task "Convert hero section" \
  --refs ./hero.html \
  --output ./components/Hero.tsx
```

Read the stdout output and generate the component at the path specified in `WRITE OUTPUT TO`.

**With multiple refs:**
```bash
node ${CLAUDE_SKILL_DIR}/scripts/invoke.js \
  --task "Build pricing table" \
  --refs ./pricing.html,./data.json,./mockup.png
```

**Page conversion (two-stage):**
```bash
# Stage 1 — outputs decomposition context; you write design/forge-page-plan.json
node ${CLAUDE_SKILL_DIR}/scripts/invoke.js --task "Convert page" --refs ./page.html

# Review the plan. Set existingProjectSection:true on sections to skip.

# Stage 2 — plan file exists; outputs generation context for each section
node ${CLAUDE_SKILL_DIR}/scripts/invoke.js --task "Convert page" --refs ./page.html

# Force Stage 1 to re-run (discard existing plan):
node ${CLAUDE_SKILL_DIR}/scripts/invoke.js --task "Convert page" --refs ./page.html --replan
```

**Flags:**
- `--task` (required): What to build
- `--refs`: Comma-separated reference files
- `--output`: Target output file path (included in context)
- `--rescan`: Re-run scan.js first
- `--replan`: Force Stage 1 re-run

## Signals

**Primary (scope):**
- `CONVERT_SECTION` — Single component (default)
- `CONVERT_PAGE` — Full page (>400 lines or task mentions "page") → two-stage pipeline

**Modifiers (stackable):**
- `+CONFIG` — JSON/data file present
- `+IMAGE` — Image file present (read via vision capability)

**Examples:**
- HTML → `CONVERT_SECTION`
- HTML + JSON → `CONVERT_SECTION +CONFIG`
- Image → `CONVERT_SECTION +IMAGE`
- Large HTML → `CONVERT_PAGE`

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

1. Design standards (if defined in designStandards)
2. design-arch.json (component dirs, libraries, tokens)
3. Config file (JSON) — wins for data shape
4. Reference file — wins for layout
5. User overrides — always valid

**Quality:** Production-ready, no TODOs, avoid `any`, reuse existing types.

## Advanced

See `${CLAUDE_SKILL_DIR}/references/`:
- `advanced-usage.md` — Config files, custom signals, troubleshooting
- `examples.md` — Real-world conversion examples
- `prompt-patterns.md` — Signal composition patterns

**Requires:** Node.js ≥18
