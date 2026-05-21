---
name: ui-forge
version: 1.5.0
description: 'Production Next.js component generator. Converts HTML, TSX, images, and JSON into project-compliant components using your design system. Triggers on component creation, HTML/TSX conversion, page generation, image-to-component tasks, or any frontend code generation request. Requires a one-time scan to build design/design-arch.json.'
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

**Scan synthesis (AI-agnostic):** `/forge-scan` runs a two-phase process. Phase 1 is pure
static analysis — always runs, writes `design-arch.json`. Phase 2 is performed by the
session AI (whichever model is active — Claude, GPT-4o, Gemini, Codex, etc.): it reads
the project files listed in `design/.synthesis-request.json` and synthesizes spacing,
typography, color tokens, and conventions using its own file-read capability. No subprocess,
no API key, no `claude` binary required. Pass `--quick` to skip Phase 2 and leave
patterns as `'unknown'`.

## Usage

### Slash Commands (Agentic CLI)

Works in Claude Code, Cursor, Codex, and other agentic platforms that support slash commands.

Install via the Skills CLI, then run once to wire slash commands and Bash permissions:

```bash
node .claude/skills/ui-forge/scripts/cli.js install
```

```
/forge-scan
```

Scans the project and creates `design/design-arch.json`. Accepts optional flags:
`--theme shadcn|mantine|plain-tailwind|stackshift|stackshift`, `--theme-override`, `--no-backup`, `--schema-v4`, `--quick`.

`--theme stackshift` is the correct flag for StackShift projects. It forces `isStackShift: true` in `design-arch.json` (ensuring the built-in `stackshift-ui` standards are injected at forge time regardless of codebase maturity), records `designStandards["stackshift-ui"]` pointing at the built-in standards directory, and creates `design/standards/` for project-level overrides.

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

**Claude Design handoff (Claude.ai exclusive):**

```
/forge --handoff https://claude.ai/design/h/<id> --output ./components/Hero.tsx
```

Fetches the Claude Design handoff (available only in Claude.ai), materializes refs into `design/.handoff-cache/`, and generates the component remapped to project tokens. `--task` is optional — derived from the handoff README heading when omitted.

**Export design system for Claude Design (Claude.ai exclusive):**

```
/forge-export-design
```

Writes `design/claude-design-bundle/` — a folder with `README.md`, `tokens.json`, `components.md`, `conventions.md`, `globals.css`, and `standards/`. Upload to Claude Design (Claude.ai feature) or paste `README.md` into the design-system onboarding step so prototypes use your real tokens from the start.

**Round-trip workflow:**

```
/forge-scan                                                    # 1. scan project
/forge-export-design                                           # 2. export to bundle
# 3. upload design/claude-design-bundle/ to Claude Design
# 4. design in Claude Design using your real tokens
# 5. export handoff URL from Claude Design
/forge --handoff <url> --output ./components/X.tsx             # 6. generate component
```

**Forge flags:**

| Flag       | Description                                        |
|------------|----------------------------------------------------|
| `--task`   | What to build (required)                           |
| `--refs`   | Comma-separated reference file paths               |
| `--output` | Target output path (included in context)           |
| `--rescan` | Re-run scan.js before generating                   |
| `--replan` | Force Stage 1 page plan regeneration               |
| `--no-design-authority` | Strip design authority from output; AI follows reference styling instead. Requires `--refs`. Refused in paired (StackShift) mode. |
| `--full` | Inline design standards content directly instead of `[REF]` load-on-demand pointers. Standards over 40 lines are trimmed to the most important block (up to 35 lines) with a truncation notice. |
| `--lite` | Optimize for token efficiency — truncates arch context and uses a condensed addendum. Can be combined with `--full`. |

**Scan flags:**

| Flag       | Description                                        |
|------------|----------------------------------------------------|
| `--theme <name>` | Seed baseline from a theme preset (`shadcn`, `mantine`, `plain-tailwind`, `stackshift`) |
| `--theme-override` | Surgically replace `@import` font, `@layer base`, and `theme.extend` in project files before scan. Requires `--theme stackshift`. Creates `.bak` backup files by default. |
| `--no-backup` | Skip `.bak` file creation when using `--theme-override` |

### Other CLIs / Bash (Codex, terminal, CI)

Use `cli.js` as the entry point — it proxies all commands through to the right script with full argument pass-through:

```bash
# Scan
node .claude/skills/ui-forge/scripts/cli.js scan
node .claude/skills/ui-forge/scripts/cli.js scan --quick
node .claude/skills/ui-forge/scripts/cli.js scan --theme shadcn
node .claude/skills/ui-forge/scripts/cli.js scan --theme stackshift

# Generate (output goes to stdout; pipe or read it, then generate)
node .claude/skills/ui-forge/scripts/cli.js forge --task "Convert hero" --refs ./hero.html --output ./Hero.tsx

# Verify
node .claude/skills/ui-forge/scripts/cli.js verify ./Hero.tsx ./types.ts

# Export design bundle
node .claude/skills/ui-forge/scripts/cli.js export

# Help
node .claude/skills/ui-forge/scripts/cli.js help
```

If the package is installed globally via npm/npx, the `ui-forge` bin is available:

```bash
npx extragraj/ui-forge install
npx extragraj/ui-forge scan --quick
npx extragraj/ui-forge forge --task "..." --refs ./ref.html --output ./Hero.tsx
```

**Resolving SKILL_ROOT** — Use the auto-discover approach if the skill root location is unknown. Alternatively, if you know the install path (e.g., `.claude/`), you can invoke detect directly:

```bash
# Auto-discover (works regardless of install location):
for d in .claude .agents .github .cursor .codex .copilot; do
  [ -f "$d/skills/ui-forge/scripts/detect.sh" ] && SKILL_ROOT="$(sh "$d/skills/ui-forge/scripts/detect.sh")" && break
done

# Or if installed globally or in known location, use directly:
SKILL_ROOT="$(sh .claude/skills/ui-forge/scripts/detect.sh)"  # if in .claude/
SKILL_ROOT="$(node .claude/skills/ui-forge/scripts/detect.js)"  # Node.js (works on Windows)

node "$SKILL_ROOT/scripts/cli.js" scan --quick
```

### MCP Server (Cline, web clients, any shell-free CLI)

For CLIs without shell execution — restricted Cline modes, web-based clients, sandboxed runners — UI Forge ships an MCP server that exposes the same scripts as Model Context Protocol tools. The client launches the server and calls tools instead of running shell commands.

**Tools exposed:**

| Tool | Wraps | Purpose |
|------|-------|---------|
| `forge_invoke` | `invoke.js` | Prepare generation context |
| `forge_scan` | `scan.js` | Scan project → `design/design-arch.json` |
| `forge_verify` | `verify.js` | Verify a generated component |
| `forge_export_design` | `export-design.js` | Export a Claude Design bundle |

Each tool accepts `args: string[]` (passed verbatim to the script) and `project_root: string?` (cwd override).

**One-time setup** — print the snippet for your client:

```bash
node .claude/skills/ui-forge/scripts/cli.js mcp-config
```

Paste the printed `mcpServers` entry into:

| Client | Config file |
|--------|-------------|
| Cline (VS Code) | `%APPDATA%\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json` |
| Claude Code | `~/.claude.json` (`mcpServers` key) |
| Cursor | `~/.cursor/mcp.json` |
| Codex | `~/.codex/config.toml` (`[mcp_servers.ui-forge]` section) |

Restart the client. The `forge_invoke` / `forge_scan` / `forge_verify` / `forge_export_design` tools are then available to the AI — no shell required.

**Calling pattern (any MCP client):**

```jsonc
// tools/call forge_invoke
{
  "name": "forge_invoke",
  "arguments": {
    "args": ["--task", "Convert hero section", "--refs", "./hero.html", "--output", "./components/Hero.tsx"],
    "project_root": "/abs/path/to/your/project"
  }
}
```

The tool returns the same structured context that `invoke.js` would print to stdout — read it and generate the component.

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
- `+STACKSHIFT_UI` — Auto-activated under StackShift paired mode (marker file or `arch.isStackShift`). Enforces variant-body hard rules; enables paired-mode body checks in the validator.

## StackShift Paired Mode

Activates when **either** condition is true:

- `.stackshift/installed.json` exists (full StackShift CLI install)
- `design/design-arch.json` has `isStackShift: true` (set automatically by `--theme stackshift`)

When active, the following behaviors are unified across `invoke.js`, `verify.js`, and `validate-contract.js`:

1. `+STACKSHIFT_UI` modifier injected — adds the variant-body hard-rule addendum to generation context (imports must come from `@stackshift-ui/*`, no raw HTML primitives, no `!important`, no `import React`, no `?? "fallback"`, theme tokens only).
2. `--no-design-authority` and `--creative` are refused — a project that follows StackShift conventions always needs the standards block.
3. `+A11Y` auto-activates when the marker file's `a11yRequired` is true or `arch.a11yRequired` is set.
4. Validator runs additional body-rule checks on the generated component:
   - **Violations (exit 1):** raw HTML primitives for content, `!important`, `import React`, `import * as` from `@stackshift-ui/...`
   - **Warnings:** `?? "string"` fallbacks, inline `style={{...}}`, direct `next/image` or `next/link` imports, `@stackshift-ui/system` imported in a variant file

The asymmetry between `.stackshift/installed.json` (full install) and `--theme stackshift` (theme-only) only affects the version string in the report — guardrails behave identically in both modes.

## Output Format

Components must always begin with `// FORGE NOTES`:

```
// FORGE NOTES
// Detected: [ref type and styling]
// Swaps: [library component mappings — SourceLib → ProjectLib]
// Token mappings: [color/spacing — ref value → project token]
// Conflicts: [divergences and judgment calls]
```

> **Body-only mode exception:** In `--mode body-only`, `// FORGE NOTES` is placed immediately after the last import statement (or at file top if no imports), not at the absolute top of the file. This preserves existing import statements in the stub file.

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
