# UI Forge

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![Skills Compatible](https://img.shields.io/badge/skills-compatible-blue)](https://github.com/vercel/skills-cli)

> **Version** 1.2.0

Next.js component generator for Codex CLI, Claude Code, and other AI coding assistants. Converts HTML, TSX, images, and JSON reference materials into production-ready components that match your project's existing design system — using your actual component libraries, Tailwind tokens, and coding conventions.

## What is UI Forge?

UI Forge is an agentic code skill that scans your project's design system and prepares a structured generation context for your AI assistant. When you ask to convert a component or generate from a reference, it reads component libraries, Tailwind tokens, design standards, and conventions from `design/design-arch.json`, then injects everything into the context so your AI can write the component using its own session.

It accepts any combination of input types (HTML templates, TSX, design images, JSON, or Claude Design URLs) and records all decisions in FORGE NOTES at the top of the generated file. Built for token optimization: pre-processing, caching, and reference condensing keep every generation session lean.

## Installation

```bash
# Installation Command
npx skills add extragraj/ui-forge

# Claude Code
npx skills add extragraj/ui-forge -y -g -a claude-code

# Install for both Claude and General Agents (e.g. Codex CLI)
npx skills add extragraj/ui-forge -y -g -a codex -a claude-code
```

| Flag | Description |
|------|-------------|
| `-y` | Auto-confirm all prompts |
| `-g` | Install globally — available across all projects |
| `-a <agent>` | Install for a specific agent runtime |

### Initialize Slash Commands & Permissions

Run once from your project root after installing. Registers slash commands with your agentic CLI and adds Bash tool permissions for all UI Forge scripts.

**1. sh / bash (macOS · Linux · WSL):**
```sh
for d in .claude .agents .github .cursor .codex .copilot; do
  [ -f "$d/skills/ui-forge/scripts/cli.js" ] && node "$d/skills/ui-forge/scripts/cli.js" install && break
done
```

**2. PowerShell (Windows):**
```powershell
@('.claude','.agents','.github','.cursor','.codex','.copilot') | % { "$_\skills\ui-forge\scripts\cli.js" } | ? { Test-Path $_ } | select -f 1 | % { node $_ install }
```

Auto-detects the agentic platform and writes slash commands to that platform's directory (`.claude/`, `.agents/`, `.cursor/`, etc.). Re-run any time you switch platforms or reinstall.

| Command | Description |
|---------|-------------|
| `/forge-scan` | Scan project → `design/design-arch.json` |
| `/forge --task "..." --refs <path> --output <path>` | Prepare generation context; AI generates the component |
| `/forge-verify <component.tsx> <contract.ts>` | Verify a generated component against its contract |
| `/forge-export-design` | Export design system as a Claude Design–ingestible bundle |

For other agents that don't support slash commands, they invoke the skill through Bash tool calls instead.

## Bash Invocation (AI Agents)  

When an AI agent (like Codex CLI) doesn't support slash commands, it reads SKILL.md to learn how to invoke the skill, then uses Bash tool calls to run `cli.js` with the appropriate command. The agent determines `SKILL_ROOT` by searching for the skill across common install locations (`.claude/`, `.agents/`, global paths, etc.).

When you ask the agent to scan, convert, or verify a component, it handles the full invocation internally. Here's how the skill root is resolved:

```bash
# Auto-discover (works across all platforms and install locations):
for d in .claude .agents .github .cursor .codex .copilot; do
  [ -f "$d/skills/ui-forge/scripts/detect.sh" ] && SKILL_ROOT="$(sh "$d/skills/ui-forge/scripts/detect.sh")" && break
done

# Or if you know the install path (e.g., .claude/):
SKILL_ROOT="$(sh .claude/skills/ui-forge/scripts/detect.sh)"
SKILL_ROOT="$(node .claude/skills/ui-forge/scripts/detect.js)"  # Node.js / Windows
```

Then run any command:

```bash
node "$SKILL_ROOT/scripts/cli.js" install   # wire slash commands + permissions (auto-detects platform)
node "$SKILL_ROOT/scripts/cli.js" scan --quick
node "$SKILL_ROOT/scripts/cli.js" scan --theme shadcn
node "$SKILL_ROOT/scripts/cli.js" forge --task "Convert hero" --refs ./hero.html --output ./Hero.tsx
node "$SKILL_ROOT/scripts/cli.js" verify ./Hero.tsx ./types.ts
node "$SKILL_ROOT/scripts/cli.js" export
node "$SKILL_ROOT/scripts/cli.js" help
```

## How the Skill Works

1. **Install once** — Run the Installation steps above to wire slash commands and permissions.
2. **Scan your project** — Run `/forge-scan` (Claude Code and agents with slash command support) or `node <skill-root>/scripts/cli.js scan` (terminal) to create `design/design-arch.json`. This captures your component libraries, Tailwind tokens, design standards, and conventions. Re-scan when you add libraries or update your theme.
3. **Ask your AI assistant** — Describe what you want to build (e.g., "Convert this hero section to a component"). The skill activates, `invoke.js` prepares structured generation context from your design system, and your AI assistant generates the production-ready component.

The `invoke.js` is a **context-preparation script**. Your coding assistant reads its output and generates the component using its own session.

## Advanced: Manual Invocation & Inspection

### Resolving SKILL_ROOT in Your Terminal

When running UI Forge commands manually from a terminal, you need to resolve `SKILL_ROOT` to the installed skill location. Use the appropriate command for your shell:

**CMD (Windows Command Prompt):**
```cmd
set SKILL_ROOT=%CD%\.claude\skills\ui-forge
node "%SKILL_ROOT%\scripts\cli.js" scan --quick
```

**PowerShell (Windows):**
```powershell
# Auto-discover approach:
foreach ($d in ".claude", ".agents", ".github", ".cursor", ".codex", ".copilot") {
    $path = "$d/skills/ui-forge/scripts/detect.js"
    if (Test-Path $path) {
        $SKILL_ROOT = node $path
        if ($SKILL_ROOT) { break }
    }
}

# Or direct approach (if installed under .claude/):
$SKILL_ROOT = node .claude/skills/ui-forge/scripts/detect.js

node "$SKILL_ROOT/scripts/cli.js" scan --quick
```

**Bash / Git Bash:**
```bash
SKILL_ROOT="$(sh .claude/skills/ui-forge/scripts/detect.sh)"
node "$SKILL_ROOT/scripts/cli.js" scan --quick

# Or auto-discover across all platforms:
for d in .claude .agents .github .cursor .codex .copilot; do
  [ -f "$d/skills/ui-forge/scripts/detect.sh" ] && SKILL_ROOT="$(sh "$d/skills/ui-forge/scripts/detect.sh")" && break
done
```

**Zsh (macOS / Linux):**
```zsh
SKILL_ROOT="$(sh .claude/skills/ui-forge/scripts/detect.sh)"
node "$SKILL_ROOT/scripts/cli.js" scan --quick

# Or auto-discover:
for d in .claude .agents .github .cursor .codex .copilot; do
  [ -f "$d/skills/ui-forge/scripts/detect.sh" ] && SKILL_ROOT="$(sh "$d/skills/ui-forge/scripts/detect.sh")" && break
done
```

### Capturing Generation Context

For debugging or inspecting the generation context, you can capture it to a file:

```bash
# sh / bash / PowerShell (CMD)
node "$SKILL_ROOT/scripts/cli.js" forge --task "Convert hero" --refs ./hero.html > forge-output.md

# PowerShell (explicit UTF-8 — if encoding issues)
node "$SKILL_ROOT/scripts/cli.js" forge --task "Convert hero" --refs ./hero.html | Out-File -Encoding utf8 forge-output.md
```

Review the captured file to verify the generation context before asking your AI to generate. The file can also be passed as a `--refs` input to another forge run to reuse a known-good context.

> **Windows note:** The `invoke.js` forces UTF-8 encoding on piped stdout, so `>` redirection in CMD and PowerShell produces clean UTF-8 output. If you see garbled text (characters spaced out), use the `Out-File -Encoding utf8` variant above.

## Features

### Signal-Based Generation

UI Forge classifies your inputs and composes the right strategy automatically:

| Signal | Trigger | Behavior |
|--------|---------|----------|
| `CONVERT_SECTION` | Default | Single component generation |
| `CONVERT_PAGE` | >400 lines or task mentions "page" / "landing" | Two-stage pipeline |
| `CONVERT_VARIANT` | `.ts`/`.tsx` props interface ref with no HTML / image layout | Companion-mode contract implementation |
| `+CONFIG` | JSON or data file present | Treats JSON keys as typed props schema |
| `+IMAGE` | Image file attached | Vision API analyzes layout, hierarchy, and colors |
| `+BRAND` | Ref filename matches `/brand\|voice\|tone/i`, or `arch.designStandards.brand` set | Voice/tone enforcement; brand-color → design-arch token mapping |
| `+A11Y` | `--a11y`, `a11yRequired` in design-arch or StackShift marker | WCAG 2.1 AA enforcement |
| `+CREATIVE` | `--creative` (standalone only — refused under `CONVERT_VARIANT`, `CONVERT_PAGE`, and paired mode) | Greenfield generation without a layout ref; appends `// FORGE PHILOSOPHY` directive |
| `+DIFF` | `--diff <path>` (`CONVERT_SECTION` only — refused under `CONVERT_VARIANT`, `CONVERT_PAGE`, `+CREATIVE`) | Surgical iteration: existing file injected as base; task describes the delta |
| `+CLAUDE_DESIGN` | `--handoff <url>` or any ref under `design/.handoff-cache/` | Claude Design handoff mode: handoff wins for layout, design-arch wins for tokens |

Signals stack — `CONVERT_SECTION + CONFIG + IMAGE + BRAND + A11Y` is a valid combination and composes all instructions. `+CREATIVE` is mutually exclusive with `CONVERT_VARIANT`, `CONVERT_PAGE`, and paired mode. `+DIFF` is `CONVERT_SECTION`-only and refuses to compose with `+CREATIVE`.

### Page Conversion (Two-Stage)

For pages with multiple sections (>400 lines or when the task mentions "page"), the AI uses a two-stage pipeline.

**Stage 1 — Decompose the page:**

```
/forge --task "Convert landing page" --refs ./landing.html
```

The AI writes `design/forge-page-plan.json`. Review the plan — set `existingProjectSection: true` on any sections you already have, adjust names or line ranges as needed.

```json
{
  "sections": [
    { "name": "hero", "type": "hero", "lines": [1, 68], "existingProjectSection": false },
    { "name": "features", "type": "features-grid", "lines": [69, 234], "existingProjectSection": true }
  ]
}
```

**Stage 2 — Generate sections:**

```
/forge --task "Convert landing page" --refs ./landing.html
```

The plan file exists — UI Forge detects it and generates each `existingProjectSection: false` section sequentially. To discard the plan and restart Stage 1, pass `--replan`.

> Other agents: use `node "$SKILL_ROOT/scripts/cli.js" forge` instead of `/forge`. See [Other CLIs / Bash](#other-clis--bash) for how to resolve `SKILL_ROOT`.

### Intelligent Token Mapping

Style values in the reference are extracted and mapped to your project's design tokens:

```
ref: bg-blue-500       →  bg-primary
ref: padding: 20px     →  p-5
ref: font-size: 24px   →  text-2xl
```

Every mapping and divergence is recorded in `FORGE NOTES`. When no close match exists, the generator notes its judgment call.

### Library Component Swapping

Reference components are replaced with your project's library equivalents:

```tsx
// HTML → shadcn/ui
<button class="...">  →  <Button variant="default">
<div class="card">    →  <Card>
<input type="text">   →  <Input />

// Material UI → shadcn/ui
import { Button } from '@mui/material'
// becomes:
import { Button } from '@/components/ui/button'
```

### Design Standards Integration

Point `design-arch.json` at any Markdown standards document and UI Forge will follow it at the highest resolution priority:

```json
"designStandards": {
  "componentGuide": "./design/standards/component-guide.md"
}
```

Standards inject automatically into the generation system prompt — no template variable needed.

### Built-in Design Standards

UI Forge ships built-in standards organized as files and directories in `references/standards/`:

- **`stackshift-ui/`** — StackShift UI conventions with eight focused files covering import rules, the **`conditionalLink` → `<Button as="link">` rule**, full component props reference, color tokens with CSS variable defaults, typography scale, spacing and rhythm, project setup requirements, and accessibility conventions.
- **`nextjs-image.md`** — Next.js + Sanity image rendering standard covering the `fill` prop pattern, type-safe `urlFor()` usage, container pattern, `sizes` attribute requirements, and GROQ projection shapes. Applies to any Next.js + Sanity + TypeScript project (not StackShift-specific).

Each injects as its own slot and stays well within the 3,000-char per-slot limit, so nothing is compressed or truncated.

**Directory Support:** Standards can be a directory. Every `.md` file inside is loaded as its own slot (keyed by filename). This applies to built-in standards, project-local overrides, and explicit `design-arch.json` entries.

Project-local standards go in `design/standards/` and are auto-registered by `scan.js`:

```
design/standards/
├── typography.md          ← single-file slot
├── motion/                ← directory: each .md inside is its own slot
│   ├── transitions.md
│   └── keyframes.md
└── <custom-key>.md
```

Or reference explicitly from `design-arch.json`:

```json
"designStandards": {
  "motion": "./design/standards/motion.md",
  "brand-guidelines": "./design/standards/brand/"
}
```

Opt out of all built-in standards with `--no-default-standards` or `"_useBuiltins": false` in `design-arch.json`.

See [Built-in Design Standards](./references/standards/README.md) for the full resolution order, directory support details, and how to author new slots.

### Theme Starters

For fresh or greenfield projects, seed `design-arch.json` from a built-in preset instead of waiting for the scanner to find enough to work with:

```bash
node "$SKILL_ROOT/scripts/cli.js" scan --theme shadcn       # Tailwind + shadcn/ui
node "$SKILL_ROOT/scripts/cli.js" scan --theme mantine       # Mantine UI v7
node "$SKILL_ROOT/scripts/cli.js" scan --theme plain-tailwind  # No component library
node "$SKILL_ROOT/scripts/cli.js" scan --theme stackshift    # StackShift UI
```

Or with the slash command: `/forge-scan --theme stackshift` (or any other theme)

Themes are **gap-fill only** — scan findings always win. A theme fills `componentLib`, `usedComponents`, `usedLibraries`, `colorTokens`, and `patterns.*` only when the scanner couldn't detect them. The applied theme is recorded as `arch._theme` in `design-arch.json`.

**StackShift Theme Specific Behavior:** `--theme stackshift` does the following beyond gap-fill:
- Forces `isStackShift: true` in `design-arch.json` so the built-in `stackshift-ui` design standards are always injected at forge time — even on empty codebases, with `--quick`, or when the Claude CLI is unavailable.
- Copies `references/standards/stackshift-ui/` to `design/standards/stackshift-ui/` (project-local, versionable, editable) and records the project-local path under `designStandards["stackshift-ui"]`.
- Copies general built-in standard (`nextjs-image.md`) to `design/standards/` and auto-registers it. `sample-standard.md` is a template for users to copy, not an active standard — it remains in `references/standards/` as documentation only.
- Handles `.forgeignore` with three-way logic: creates from StackShift template if missing, overwrites if it's a UI Forge template, or appends StackShift exclusions to an existing custom file.
- Preserves the `_paired` mirror block in `design-arch.json` on re-scan so StackShift paired-mode markers are never lost.
- **Supports `--theme-override`**: bootstrap a project's `globals.css` and `tailwind.config.*` with default StackShift CSS variable tokens, Inter font import, and full `theme.extend` block before scanning. The scan then picks up the overridden files naturally.

```bash
# Bootstrap globals.css + tailwind.config.ts with StackShift defaults, then scan
node "$SKILL_ROOT/scripts/cli.js" scan --theme stackshift --theme-override

# Skip .bak backup creation
node "$SKILL_ROOT/scripts/cli.js" scan --theme stackshift --theme-override --no-backup
```

> ⚠️ `--theme-override` modifies project files on disk. `.bak` backup files are created by default. Running again on already-overridden files is idempotent. Non-Google-Fonts `@import` lines are preserved.

See [Built-in Themes](./themes/README.md) for the full preset list and merge rules.

### Multiple Reference Inputs

Pass any combination of file types together:

```
/forge --task "Build pricing table" --refs ./pricing.html,./tiers.json,./mockup.png
```

**Resolution priority:** Design standards → `design-arch.json` → JSON (data shape) → HTML (layout) → Image (visual proportions)

## Architecture

### Design Authority (`design/design-arch.json`)

Created by `scan.js` and cached until you re-run it. The v3 schema:

```json
{
  "_v": 3,
  "componentLib": ["./components", "./components/ui"],
  "usedComponents": ["Button", "Card", "Input", "Dialog"],
  "usedLibraries": [{ "name": "framer-motion", "version": "^12.0.0", "uses": 14 }],
  "tailwind": { "themeSection": "...", "colorTokens": "primary, secondary, accent" },
  "globalCss": "...",
  "designStandards": { "stackshift-ui": "./design/standards/stackshift-ui" },
  "patterns": {
    "spacing": "4-based scale with py-20 sections",
    "typography": "font-sans default, headings font-bold",
    "conventions": ["PascalCase components", "use 'use client' for interactive"]
  }
}
```

### Pre-Processing Pipeline

Reference files are pre-processed before injection to stay within context limits:

| File type | Treatment |
|-----------|-----------|
| `.html` | Extract `<style>` blocks + inline styles → EXTRACTED STYLES header; strip `<head>`, `<script>`; cap body at 200 lines |
| `.tsx` / `.jsx` | Extract `className` strings, CSS-in-JS blocks, external imports, props interface, JSX return block; strip state/effects/handlers |
| `.json` / config `.ts` | Full content ≤100 lines; condensed with first 80 lines otherwise |
| `.md` | Full content ≤150 lines; first 100 lines + remaining section headings otherwise |
| Image | Path reference only — AI reads via its own vision capability |

### Signal Detection and Context Composition

`detectSignals()` classifies refs and determines primary signal + modifiers. `references/prompt-patterns.md` holds composable instruction blocks — `CONVERT_SECTION` provides the base addendum; modifier signals append addendum-only blocks. These are embedded in the `GENERATION INSTRUCTIONS` section of the stdout output that the AI reads.

To add a new signal: add a `## SIGNAL_NAME` block with a fenced `**System Addendum:**` section in `prompt-patterns.md`, then add detection logic in `detectSignals()`.

### Scripts

| Script | What it does | When a developer runs it directly |
|--------|-------------|-----------------------------------|
| `scripts/scan.js` | Scans project → `design-arch.json` | Setup; again after adding libraries or updating Tailwind theme |
| `scripts/invoke.js` | Prepares generation context → stdout | Run by the AI assistant via slash command; rarely needed directly |
| `scripts/verify.js` | Static contract checks + optional Playwright screenshot | Post-generation spot-check, or wired as a PostToolUse hook |
| `scripts/validate-contract.js` | `CONVERT_VARIANT` contract validator; exit 1 on violations | CI pipelines |
| `scripts/fetch-handoff.js` | Fetches a Claude Design handoff URL → local refs | Invoked automatically via `--handoff`; can run standalone |
| `scripts/export-design.js` | Exports `design-arch.json` → `design/claude-design-bundle/` | Before uploading to Claude Design |
| `scripts/sync-version.mjs` | Syncs `skill.version` → `package.json`, `README.md`, `SKILL.md` | After editing `skill.version` |

## Companion Mode (StackShift Handoff)

When StackShift scaffolds a variant file, it activates UI Forge in companion mode. The AI assistant receives a `CONVERT_VARIANT` context block and implements the component body against the externally-owned props contract — no manual invocation required.

The `CONVERT_VARIANT` signal is auto-detected when the ref is a `.ts`/`.tsx` props interface with no HTML or image layout ref. Using the slash command:

```
/forge --task "Build pricing variant" --refs ./components/Pricing/types.ts --output ./components/Pricing/Variant.tsx
```

The props interface is the contract — UI Forge imports it rather than redefining it, destructures every prop, applies `?? undefined` to optionals, and returns `null` when required props are absent.

**Contract version tag** (`0.1.3+`) — declare the contract version as JSDoc in the interface file:

```ts
/** @contract-version 1.0.0 */
export interface PricingVariantProps { /* ... */ }
```

**Post-generation validation** — verify the output against the contract:

```
/forge-verify ./components/Pricing/Variant.tsx ./components/Pricing/types.ts
```

Or run directly for CI:

```bash
node scripts/validate-contract.js ./components/Pricing/Variant.tsx ./components/Pricing/types.ts
```

Exit `1` on violations (missing default export, disallowed named exports, required props not consumed, missing `null` fallback).

**Paired-mode detection** — if `.stackshift/installed.json` exists, UI Forge logs the StackShift version, surfaces it in the generation context, and auto-activates `+A11Y` when the marker's `a11yRequired` field is `true`.

## Documentation

- **[SKILL.md](./SKILL.md)** — Complete skill reference: signals, CLI flags, output format, resolution priority
- **[Advanced Usage](./references/advanced-usage.md)** — PostToolUse auto-verify hook, custom signals, troubleshooting, CI/CD integration
- **[Examples](./references/examples.md)** — Real-world conversion walkthroughs with full outputs
- **[Prompt Patterns](./references/prompt-patterns.md)** — Signal composition reference for extending UI Forge
- **[Built-in Themes](./themes/README.md)** — Available theme starters (`shadcn`, `stackshift`), merge behavior, and how to apply via `scan.js --theme <name>`
- **[Built-in Design Standards](./references/standards/README.md)** — `stackshift-ui` built-in standard (consolidated StackShift UI conventions), resolution order, and how to author project-local overrides
- **[Versions](./references/versions.md)** — Node, Next.js, StackShift, component library compatibility matri

**Scan Script Flags** (`scripts/scan.js`):

| Flag | Description |
|------|-------------|
| `--project-root <path>` | Scan a different directory (defaults to cwd) |
| `--patch` | Re-scan everything, preserve existing `designStandards` entries |
| `--quick` | Skip the optional `claude` CLI synthesis branch (static analysis only) |
| `--ignore <file>` | Load an additional ignore file (repeatable) |
| `--no-default-ignore` | Skip the built-in base ignore list |
| `--theme <name>` | Seed `design-arch.json` from `themes/<name>.json` (gap-fill only). Available: `shadcn`, `mantine`, `plain-tailwind`, `stackshift`. |
| `--theme-override` | Surgically replace Google Fonts `@import`, `@layer base` block, and `theme.extend` section in project files **before** scan reads them. Requires `--theme stackshift`. Creates `.bak` backup files by default. |
| `--no-backup` | Skip `.bak` backup file creation when using `--theme-override`. |

**Forge Script Flags** (`scripts/invoke.js` — additional):

| Flag | Description |
|------|-------------|
| `--no-design-authority` | Strip the design authority block (arch context + standards) from forge output. The AI follows reference styling instead. Requires at least one `--refs` file. Refused in paired (StackShift) mode. Note: design standards are also stripped (they are part of project authority). |
| `--full` | Inline design standards content directly in forge output instead of `[REF]` load-on-demand pointers. Standards over 40 lines are trimmed to the most important block (preamble + `## Rule` section or first `## ` section, up to 35 lines) with a `// … truncated` notice. Useful when you want all constraints visible upfront, or when the AI can't load files via `[REF]` references. Compatible with `--lite`. |
| `--lite` | Optimize for token efficiency — truncates arch context (spacing/typography to first sentence, skips component/library inventory) and replaces the full prompt-patterns addendum with a single-line reference. Can be combined with `--full`. |

## Changelog

Full release notes are in [`change-logs/`](./change-logs/).

| Version | Date | Notes |
|---------|------|-------|
| [1.2.0](./change-logs/1-2-0-full-inline-standards.md) | 2026-05-20 | `--full` flag (forge): inlines design standards content directly instead of `[REF]` load-on-demand pointers. Standards over 40 lines are trimmed to the most important block (preamble + `## Rule` or first `## ` section, up to 35 lines) with a truncation notice. `--full` and `--lite` can be combined. No changes to built-in standards required. |
| [1.1.0](./change-logs/1-1-0-forgeignore-dedup-and-multi-platform-install.md) | 2026-05-20 | `.forgeignore` heading deduplication: rescan with `--theme stackshift` no longer duplicates section headings; fully idempotent (skips write when nothing new). Multi-platform install: `install` now writes slash commands and Bash permissions to every agentic platform directory present in cwd (`.claude`, `.agents`, `.cursor`, etc.), not just the detected one. Global installs use the absolute skill path in commands and permissions. 33 tests. |
| [0.3.0](./change-logs/0-3-0-theme-override-and-no-design-authority.md) | 2026-05-08 | `--theme-override` (scan, stackshift-only): surgically replaces Google Fonts `@import`, `@layer base`, and `theme.extend` in project files before scan using a brace-counted parser; mandatory `.bak` backups, idempotent, preserves non-font `@import` lines. `themeOverride` data added to `themes/stackshift.json`. `--no-design-authority` (forge): strips design authority + standards from forge output; AI follows reference styling; refused in paired mode; requires `--refs`. 73 tests. |
| [0.2.9](./change-logs/0-2-9-issues-analysis-fixes.md) | 2026-05-08 | Issues analysis fixes — StackShift .forgeignore now merges line-by-line with deduplication instead of appending; sample-standard.md no longer copied to project (template only); designStandards always merged on rescan (never deleted); patterns preserved when AI synthesis unavailable; duplicate anti-slop guardrails removed (single source of truth in prompt-patterns.md); design standards now sorted by task relevance with RULE extraction in [REF] descriptions; FORGE NOTES compliance block added. |
| [0.2.8](./change-logs/0-2-8-forgeignore-standards-and-scan-fixes.md) | 2026-05-06 | .forgeignore, standards copy & scan fixes — `cli.js install` writes correct default template; `--theme stackshift` handles .forgeignore with create/overwrite/append logic; removed obsolete variant-router linking; copies built-in standards (stackshift-ui, nextjs-image, sample-standard) to project-local `design/standards/`; preserves `_paired` block on re-scan; documented naming distinction between `stackshift-ui` and `stackshift-section-variants`. |
| [0.2.7E](./change-logs/0-2-7E-documentation-restructure-and-clarity.md) | 2026-05-06 | Documentation restructure & cross-platform clarity — reorganized README with clearer installation flow, new Advanced section for manual invocation, moved Page Conversion to Features subsection; condensed CLAUDE.md from 306 to 109 lines (converted architecture to tables, removed redundant examples); updated SKILL.md to clarify cross-platform support (Cursor, Codex, etc.) and marked Claude Design features as Claude.ai-exclusive; fixed detect.js symlink-aware skill-root resolution. |
| [0.2.7D](./change-logs/0-2-7D-missing-features-or-enhancements.md) | 2026-05-05 | Missing features — documented modification/fix mode for rebuild use cases, added mechanical anti-slop fidelity checklist against reference HTML, documented +IMAGE fallback requirement for vision-provided screenshots, created built-in Next.js + Sanity image rendering standard. |
| [0.2.7C](./change-logs/0-2-7C-utf8-stdout-encoding-fix.md) | 2026-05-05 | UTF-8 stdout encoding fix — forces UTF-8 on piped stdout on Windows, preventing PowerShell UTF-16 LE redirection from producing garbled output (E-1). |
| [0.2.7B](./change-logs/0-2-7B-forge-notes-placement-spec-fix.md) | 2026-05-05 | FORGE NOTES placement spec fix — resolves latent conflict between main "Begin with // FORGE NOTES" instruction and body-only mode's "after last import" rule (D-1). Documentation-only fix; runtime behavior was already correct. |
| [0.2.7](./change-logs/0-2-7-stackshift-theme-discoverability.md) | 2026-05-05 | StackShift integration fixes — `stackshift` added to all CLI help text (G-1); `--theme stackshift` now forces `isStackShift: true` so stackshift-ui standards are never skipped (G-2); `scan.js` creates `design/standards/` and records the built-in stackshift-ui path in `designStandards` (G-3); `install` wires `variant-router` into `design-arch.json` when stackshift-core is present (G-4) |
| [0.2.6](./change-logs/0-2-6-validate-input-standalone-fix.md) | 2026-05-05 | `--validate-input` standalone fix — no longer requires `--task`; bypasses help block, emits targeted errors, exits 0 on pass (resolves A-1) |
| [0.2.5](./change-logs/0-2-5-reference-based-design-authority.md) | 2026-05-05 | Reference-based Design Authority — both lite and non-lite modes now output path references instead of copying tailwind theme/CSS content inline; standards listed as `[REF] key [path]: description` load-on-demand refs; non-lite adds explicit IMPLEMENTATION and ANTI-SLOP GUARDRAILS sections (resolves H-1 and H-2) |
| [0.2.4](./change-logs/0-2-4-platform-aware-install.md) | 2026-05-05 | Platform-aware install — `cli.js install` auto-detects which agentic platform the skill is in (Claude Code, Codex, Copilot, Cursor, Gemini) and writes slash commands + permissions to that platform's directory; new `scripts/detect.js` (Node.js, Windows-compatible) mirrors `detect.sh`; `detect.sh` now covers all 8 supported platforms; README and CLAUDE.md updated with cross-platform one-liner bootstrap commands (resolves I-1 and I-2) |
| [0.2.3](./change-logs/0-2-3-windows-synthesis-fix.md) | 2026-05-01 | Windows synthesis fix — prompt passed via stdin to avoid CMD.exe special-char mangling; `SYNTHESIS_PROMPT` redesigned to pass file paths (Claude reads them with its Read tool) instead of embedding raw CSS/JS content, cutting prompt size ~69% and enabling component-level pattern detection; StackShift `.forgeignore` auto-created on `install`; Haiku model documented in SKILL.md |
| [0.2.2B](./change-logs/0-2-2B-theme-and-preview-fixes.md) | 2026-04-30 | Added missing `mantine` and `plain-tailwind` theme presets; `--preview` confirmation moved to stdout (was stderr, invisible in Claude Code slash command output) |
| [0.2.2A](./change-logs/0-2-2A-token-efficiency-and-lite-optimization.md) | 2026-04-30 | Token Optimization: Introduced `--lite` mode (~90% context reduction), context-aware standards filtering, and fixed CLI-vs-Config precedence logic |
| [0.2.2](./change-logs/0-2-2-skills-cli-compatibility.md) | 2026-04-30 | Skills CLI compatibility — quoted SKILL.md `description` to fix `yaml` v2 strict-YAML parse failure (colon-space in plain scalar caused "No valid skills found" on every install); `detect.sh` updated with correct Codex global path (`~/.codex/skills/`) and `.agentic` fallback |
| [0.2.1](./change-logs/0-2-1-directory-standards-and-stackshift-ui.md) | 2026-04-30 | Directory support for design standards — `loadDesignStandards()` now scans subdirectories; `references/standards/stackshift-ui/` replaces the compressed single file with 8 focused uncompressed files (import rule, conditionalLink, component props, color tokens, typography, spacing, setup, a11y) |
| [0.2.0](./change-logs/0-2-0-stackshift-ui-standards-and-theme.md) | 2026-04-30 | `stackshift-ui` built-in StackShift UI standard and `stackshift` theme preset introduced; `sample-standard.md` template added |
| [0.1.9D](./change-logs/0-1-9D-claude-design-integration.md) | 2026-04-27 | Claude Design integration: `--handoff <url>` fetches handoffs and generates with `+CLAUDE_DESIGN` token remapping; `/forge-export-design` exports `design-arch.json` as an ingestible bundle for Claude Design onboarding |
| [0.1.9C](./change-logs/0-1-9C-plan-validation-and-fallback-warning.md) | 2026-04-27 | `validatePagePlan()` in `invoke.js` validates `forge-page-plan.json` schema before Stage 2 and exits with a clear per-field error; `scan.js` now emits a loud banner on stderr whenever AI synthesis falls back to static analysis |
| [0.1.9B](./change-logs/0-1-9B-auto-verify-hook.md) | 2026-04-27 | `verify.js` single-arg mode with `// @contract <path>` auto-detection; PostToolUse hook snippet for automatic contract verification on every component write; `SIGNAL_VARIANT` FORGE NOTES template updated with machine-readable directive |
| [0.1.9A](./change-logs/0-1-9A-slash-commands.md) | 2026-04-27 | Slash commands for Claude Code: `/forge-scan`, `/forge`, `/forge-verify` via `$CLAUDE_PLUGIN_ROOT`; `SKILL.md` restructured to lead with slash commands and demote bash invocations to an Advanced / Codex CLI section |
| [0.1.9](./change-logs/0-1-9-cross-agent-skill-root-compatibility.md) | 2026-04-27 | Cross-agent compatibility fix: new `scripts/detect.sh` resolves the installed skill root across Codex CLI and Claude Code, and `SKILL.md` now uses `SKILL_ROOT`-based commands with an explicit path-resolution step |
| [0.1.8](./change-logs/0-1-8-token-optimization.md) | 2026-04-21 | Token optimization: SKILL.md body compressed (~1,800 tokens/activation saved), `prompt-patterns.md` addenda condensed (`CONVERT_SECTION` +`SIGNAL_A11Y` +`SIGNAL_BRAND`), `archToContext()` caps tightened, `extractBlock()` memoized, `references/INDEX.md` added for targeted on-demand reads |
| [0.1.7](./change-logs/0-1-7-examples-preview-verify-darkmode-contract.md) | 2026-04-21 | Golden conversion examples (`examples/`), `--preview` (HTML context snapshot; standalone only), `--verify` + `scripts/verify.js` (static contract checks + Playwright), `--validate-input` pre-flight, `scan.js --schema-v4` dark-mode token extraction, `packages/variant-contract/` shared validator module |
| [0.1.6](./change-logs/0-1-6-diff-and-themes.md) | 2026-04-21 | `+DIFF` modifier for surgical iteration on an existing file (`--diff <path>`; `CONVERT_SECTION` only), `scan.js --theme <name>` starters for fresh projects (`shadcn`, `mantine`, `plain-tailwind`; gap-fill only, scan data wins) |
| [0.1.5](./change-logs/0-1-5-brand-creative-and-philosophy.md) | 2026-04-21 | `+BRAND` modifier (auto-detected from ref filename or `designStandards.brand`), `+CREATIVE` modifier with `// FORGE PHILOSOPHY` directive (`--creative`; standalone only — refused under `CONVERT_VARIANT`, `CONVERT_PAGE`, and paired mode) |
| [0.1.4](./change-logs/0-1-4-ignore-and-defaults.md) | 2026-04-20 | `.forgeignore` + gitignore-subset matcher, directory-boundary pruning, `--ignore` / `--no-default-ignore` / `--quick` / `--no-default-standards` flags, three-layer `loadDesignStandards` with built-in template fallbacks |
| [0.1.3](./change-logs/0-1-3-contract-hardening-and-a11y.md) | 2026-04-14 | Contract hardening — `@contract-version` tag, CONTRACT header + FORGE NOTES sub-block, `validate-contract.js`, `+A11Y` modifier, anti-slop guardrail, paired-mode detection |
| [0.1.2](./change-logs/0-1-2-companion-mode.md) | 2026-04-14 | Companion mode — `CONVERT_VARIANT` signal, `--signal` and `--mode` flags, body-only output, page-pipeline guard |
| [0.1.1](./change-logs/0-1-1-pure-skill-refactor.md) | 2026-04-13 | Pure skill refactor — invoke.js is now a context-preparation script; removed programmatic API |
| [0.1.0](./change-logs/0-1-0-initial-release.md) | 2026-04-12 | First round optimization — 23 bugs, discrepancies, and optimizations resolved post-audit |

---

**Built for:** Codex CLI · Claude Code · Cursor · Cline · GitHub Copilot · Any AI coding assistant supporting the Vercel Skills format

**Token-optimal. Production-ready. Design-authority-driven.**
