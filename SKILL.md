---
name: ui-forge
version: 0.1.9
description: Generates production-ready Next.js TSX components from prompts and reference materials (HTML, TSX, images, JSON). Converts sections, pages, and variants using project design standards. Triggers on: "create component", "convert this HTML/TSX/page", "generate from image", or any frontend code generation request. Requires design/design-arch.json (auto-created on first use).
---

# UI Forge

Production Next.js component generator using signal-based architecture. Converts HTML, TSX,
images, and JSON into project-compliant components.

## How It Works

`invoke.js` is a **context-preparation script**, not an AI client. It loads `design-arch.json`,
pre-processes reference files, detects signals, and prints structured generation context to
stdout. You (the AI assistant) read that context and generate the component — no API calls,
no API key required.

## Resolve Skill Root (first step — every session)

UI Forge runs in Claude Code CLI and Codex CLI. Each agent installs the skill to a different
directory, so the skill root must be resolved before running commands.

**In Codex CLI: you must set `SKILL_ROOT` manually before running any commands.**
**In Claude Code: the detection script resolves the installed skill path automatically.**

Run this once at the start of every session:

```bash
SKILL_ROOT="$(sh ./scripts/detect.sh)"
```

Verify it resolved correctly before continuing:

```bash
ls "$SKILL_ROOT/scripts/scan.js" && echo "SKILL_ROOT OK" || echo "FAILED — re-run detection"
```

If detection fails, set the path explicitly:

```bash
# Codex CLI global install
SKILL_ROOT="$HOME/.agents/skills/ui-forge"

# Claude Code global install
SKILL_ROOT="$HOME/.claude/skills/ui-forge"
```

All commands in this skill use `$SKILL_ROOT`. Do not proceed until it is verified.

## When to Use

- Create or convert components, sections, or page variants
- Transform HTML templates to TSX
- Generate from design mockups (images)
- Build config-driven components (JSON)
- Supported: `.html` `.tsx` `.jsx` `.ts` `.js` `.json` `.md` `.png` `.jpg` `.webp`

## Prerequisites

Check for `design/design-arch.json` in the project root. If missing:

```bash
node "$SKILL_ROOT/scripts/scan.js"
```

Contains: component directories, used libraries, Tailwind tokens, global CSS, design standards.

No API key required by the scripts. Generation context is prepared by `invoke.js`; you
generate the component from that context.

## Usage

**Single component:**

```bash
node "$SKILL_ROOT/scripts/invoke.js" \
  --task "Convert hero section" \
  --refs ./hero.html \
  --output ./components/Hero.tsx
```

Read the stdout output and generate the component at the path in `WRITE OUTPUT TO`.

**Multiple refs:**

```bash
node "$SKILL_ROOT/scripts/invoke.js" \
  --task "Build pricing table" \
  --refs ./pricing.html,./data.json,./mockup.png
```

**Page conversion (two-stage):**

```bash
# Stage 1 — outputs decomposition plan; write design/forge-page-plan.json
node "$SKILL_ROOT/scripts/invoke.js" --task "Convert page" --refs ./page.html

# Review the plan. Mark sections to skip: existingProjectSection: true

# Stage 2 — plan exists; generates each section sequentially
node "$SKILL_ROOT/scripts/invoke.js" --task "Convert page" --refs ./page.html

# Discard plan and re-decompose:
node "$SKILL_ROOT/scripts/invoke.js" --task "Convert page" --refs ./page.html --replan
```

**Flags:**

| Flag       | Description                                        |
|------------|----------------------------------------------------|
| `--task`   | What to build (required)                           |
| `--refs`   | Comma-separated reference file paths               |
| `--output` | Target output path (included in context)           |
| `--rescan` | Re-run scan.js before generating                   |
| `--replan` | Force Stage 1 page plan regeneration               |

## Signals

**Primary:**

- `CONVERT_SECTION` — Single component (default)
- `CONVERT_PAGE` — Full page (>400 lines or task mentions "page") → two-stage
- `CONVERT_VARIANT` — Props interface file, no layout ref → companion mode

**Modifiers:**

- `+CONFIG` — JSON/data file present
- `+IMAGE` — Image file present (read via vision capability)
- `+BRAND` — Brand/voice file present or designStandards.brand set
- `+A11Y` — Via `--a11y` flag or arch.a11yRequired
- `+CREATIVE` — Via `--creative` (refused under CONVERT_VARIANT and CONVERT_PAGE)
- `+DIFF` — Via `--diff <path>` (CONVERT_SECTION only)

## Output Format

Components must always begin with `// FORGE NOTES`:

```
// FORGE NOTES
// Detected: [ref type and styling]
// Swaps: [library component mappings — SourceLib → ProjectLib]
// Token mappings: [color/spacing — ref value → project token]
// Conflicts: [divergences and judgment calls]
```

Code format — raw TSX, no markdown fences:
- Single file: code directly after FORGE NOTES
- Multiple files: `// --- FILE: path/to/file.tsx` separator

## Resolution Priority

1. Design standards docs (`designStandards` in design-arch.json)
2. `design-arch.json` (component dirs, libraries, tokens)
3. Config file (JSON) — wins for data shape
4. Reference file (HTML/TSX) — wins for layout
5. User prompt overrides — always valid

**Quality:** Production-ready, no TODOs, avoid `any`, reuse existing types.

## Advanced

```bash
ls "$SKILL_ROOT/references/"
# advanced-usage.md — config files, custom signals, troubleshooting, CI/CD
# examples.md       — real-world conversion examples
# prompt-patterns.md — signal composition and extension patterns
```

**Requires:** Node.js ≥ 18
