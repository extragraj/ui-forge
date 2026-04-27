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

## When to Use

- Create or convert components, sections, or page variants
- Transform HTML templates to TSX
- Generate from design mockups (images)
- Build config-driven components (JSON)
- Supported: `.html` `.tsx` `.jsx` `.ts` `.js` `.json` `.md` `.png` `.jpg` `.webp`

## Prerequisites

Check for `design/design-arch.json` in the project root. If missing, run the scan first.

Contains: component directories, used libraries, Tailwind tokens, global CSS, design standards.

No API key required by the scripts. Generation context is prepared by `invoke.js`; you
generate the component from that context.

## Usage

### Claude Code (slash commands)

```
/forge-scan
```

Scans the project and creates `design/design-arch.json`. Accepts optional flags:
`--theme shadcn|mantine|plain-tailwind`, `--schema-v4`, `--quick`.

```
/forge --task "Convert hero section" --refs ./hero.html --output ./components/Hero.tsx
```

Prepares generation context and prints it to stdout. Read the output and generate the
component at the path shown in `WRITE OUTPUT TO`.

```
/forge --task "Build pricing table" --refs ./pricing.html,./data.json,./mockup.png
```

Multiple refs are comma-separated.

**Page conversion (two-stage):**

```
# Stage 1 — outputs decomposition plan; write design/forge-page-plan.json
/forge --task "Convert page" --refs ./page.html

# Review the plan. Mark sections to skip: existingProjectSection: true

# Stage 2 — plan exists; generates each section sequentially
/forge --task "Convert page" --refs ./page.html

# Discard plan and re-decompose:
/forge --task "Convert page" --refs ./page.html --replan
```

**Verify a generated component against its contract:**

```
/forge-verify ./components/Variant.tsx ./types.ts
```

**Claude Design handoff:**

```
/forge --handoff https://claude.ai/design/h/<id> --output ./components/Hero.tsx
```

Fetches the Claude Design handoff, materializes refs into `design/.handoff-cache/`, and generates the component remapped to project tokens. `--task` is optional — derived from the handoff README heading when omitted.

**Export design system for Claude Design:**

```
/forge-export-design
```

Writes `design/claude-design-bundle/` — a folder with `README.md`, `tokens.json`, `components.md`, `conventions.md`, `globals.css`, and `standards/`. Upload to Claude Design or paste `README.md` into the design-system onboarding step so prototypes use your real tokens from the start.

**Round-trip workflow:**

```
/forge-scan                                                    # 1. scan project
/forge-export-design                                           # 2. export to bundle
# 3. upload design/claude-design-bundle/ to Claude Design
# 4. design in Claude Design using your real tokens
# 5. export handoff URL from Claude Design
/forge --handoff <url> --output ./components/X.tsx             # 6. generate component
```

**Flags:**

| Flag       | Description                                        |
|------------|----------------------------------------------------|
| `--task`   | What to build (required)                           |
| `--refs`   | Comma-separated reference file paths               |
| `--output` | Target output path (included in context)           |
| `--rescan` | Re-run scan.js before generating                   |
| `--replan` | Force Stage 1 page plan regeneration               |

### Advanced / Codex CLI / Non-Claude Code

Resolve the skill root once per session before running any commands:

```bash
SKILL_ROOT="$(sh ./scripts/detect.sh)"
```

Verify it resolved correctly:

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

Then run scripts directly:

```bash
node "$SKILL_ROOT/scripts/scan.js"
node "$SKILL_ROOT/scripts/invoke.js" --task "Convert hero section" --refs ./hero.html --output ./components/Hero.tsx
node "$SKILL_ROOT/scripts/verify.js" ./components/Variant.tsx ./types.ts
```

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
- `+CLAUDE_DESIGN` — Via `--handoff <url>` or refs under `design/.handoff-cache/`

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
