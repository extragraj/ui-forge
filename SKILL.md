---
name: ui-forge
description: >
  Generates production-ready Next.js TSX components from prompts and reference
  materials (HTML, TSX, images, JSON). Converts sections, pages, and variants
  using project design standards. Triggers on: "create component", "convert
  this HTML/TSX/page", "generate from image", or any frontend code generation
  request. Requires design/design-arch.json (auto-created on first use).
---

# UI Forge

Production Next.js component generator using signal-based architecture. Converts HTML, TSX, images, and JSON into project-compliant components.

## When to Use

- Create/convert components, sections, or page variants
- Transform HTML templates to TSX
- Generate from design mockups (images)
- Build config-driven components (JSON)
- Supported: .html .tsx .jsx .ts .js .json .md .png .jpg .webp

## Prerequisites

Check for `design/design-arch.json` in project root. If missing:
```bash
node ${CLAUDE_SKILL_DIR}/scripts/scan.js
```

Contains: component directories, used libraries, Tailwind tokens, global CSS, design standards, patterns.

Environment: Requires `ANTHROPIC_API_KEY` environment variable.

## Usage

**Single component:**
```bash
node ${CLAUDE_SKILL_DIR}/scripts/invoke.js \
  --task "Convert hero section" \
  --refs ./hero.html
```

**With multiple refs:**
```bash
node ${CLAUDE_SKILL_DIR}/scripts/invoke.js \
  --task "Build pricing table" \
  --refs ./pricing.html,./data.json,./mockup.png
```

**Page conversion (two-stage):**
```bash
# Stage 1: Plan
node ${CLAUDE_SKILL_DIR}/scripts/invoke.js --task "Convert page" --refs ./page.html
# Edit design/forge-page-plan.json
# Stage 2: Generate
node ${CLAUDE_SKILL_DIR}/scripts/invoke.js --task "Convert page" --refs ./page.html
```

**Flags:**
- `--task` (required): What to build
- `--refs`: Comma-separated reference files
- `--output`: Output file path
- `--rescan`: Re-run scan.js first
- `--replan`: Force Stage 1 re-run

## Signals

**Primary (scope):**
- `CONVERT_SECTION` — Single component (default)
- `CONVERT_PAGE` — Full page (>400 lines or task mentions "page") → two-stage pipeline

**Modifiers (stackable):**
- `+CONFIG` — JSON/data file present
- `+IMAGE` — Image file present

**Examples:**
- HTML → `CONVERT_SECTION`
- HTML + JSON → `CONVERT_SECTION + CONFIG`
- Image → `CONVERT_SECTION + IMAGE`
- Large HTML → `CONVERT_PAGE`

## Output Format

**FORGE NOTES** (always first):
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
- `advanced-usage.md` — Config files, troubleshooting, API
- `examples.md` — Real-world conversion examples
- `prompt-patterns.md` — Signal composition patterns

**Requires:** Node.js ≥18, ANTHROPIC_API_KEY
