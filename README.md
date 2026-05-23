# UI Forge

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![Skills Compatible](https://img.shields.io/badge/skills-compatible-blue)](https://github.com/vercel/skills-cli)

> **Version** 1.7.2

Next.js component generator for Codex CLI, Claude Code, and other AI coding assistants. Converts HTML, TSX, images, and JSON reference materials into production-ready components that match your project's existing design system — using your actual component libraries, Tailwind tokens, and coding conventions.

## What is UI Forge?

UI Forge is an agentic code skill that scans your project's design system and prepares a structured generation context for your AI assistant. When you ask to convert a component or generate from a reference, it reads component libraries, Tailwind tokens, design standards, and conventions from `design/design-arch.json`, then injects everything into the context so your AI can write the component using its own session.

It accepts any combination of input types (HTML templates, TSX, design images, JSON, or Claude Design URLs) and records all decisions in FORGE NOTES at the top of the generated file. Built for token optimization: pre-processing, caching, and reference condensing keep every generation session lean.

## Installation

From your project root:

```bash
pnpm dlx @extragraj/ui-forge init
# or
npx @extragraj/ui-forge init
```

Re-run `npx @extragraj/ui-forge init` at any time to add or remove features — the lockfile pre-fills your previous selections as defaults.

```
npx @extragraj/ui-forge init
          │
          ▼
 ┌─ DETECT ─────────────────────────────────────────────────────────────┐
 │  Existing lockfile?   → pre-fills previous selections as defaults    │
 │  .stackshift present? → enables pairing + +A11Y enforcement          │
 │  Platform dirs found? → pre-selects detected platforms               │
 └──────────────────────────────────────────────────────────────────────┘
          │
          ▼
 ┌─ PROMPTS ────────────────────────────────────────────────────────────┐
 │                                                                       │
 │  1  Required (locked)   Scan · Forge · Verify · MCP Server           │
 │                                                                       │
 │  2  Optional features                                                 │
 │       Automation      → Verify After Edit Hook                        │
 │                          Project CLI Shim (./ui-forge.mjs)            │
 │       Claude Excl.    → Export Design                                 │
 │                          Fetch Handoff                                │
 │                                                                       │
 │  3  Theme preset        shadcn · mantine · plain-tailwind ·           │
 │                         stackshift · none                             │
 │                                                                       │
 │  4  Theme override      StackShift only — rewrites globals.css        │
 │                         + tailwind.config.* before scan               │
 │                                                                       │
 │  5  StackShift pairing  auto-detected or manual confirm               │
 │                                                                       │
 │  6  Agentic platforms   .claude · .cursor · .codex · .agents          │
 │                         .copilot · .gemini/antigravity                │
 │                                                                       │
 │  7  Install scope       project → .claude/skills/ui-forge in cwd     │
 │                         global  → ~/.claude/skills/ui-forge           │
 │                                                                       │
 └──────────────────────────────────────────────────────────────────────┘
          │
          ▼
 ┌─ APPLIES ────────────────────────────────────────────────────────────┐
 │                                                                       │
 │  ✦  Copy feature files to skill dir (no dev assets / test files)     │
 │  ✦  Write slash commands + scoped Bash permissions per platform       │
 │  ✦  Register MCP server in detected client configs (abs. Node path)  │
 │  ✦  Bootstrap design/standards/ from selected theme                  │
 │  ✦  Generate ./ui-forge.mjs portable shim (safe to commit)           │
 │  ✦  Run quick scan → seed design/design-arch.json immediately        │
 │  ✦  Stamp provenance headers on all wired files                      │
 │  ✦  Legacy sweep: prune pre-1.6.0 artifacts + deselected features    │
 │  ✦  Save .ui-forge/installed.json — idempotent, exact uninstall      │
 │                                                                       │
 └──────────────────────────────────────────────────────────────────────┘
```

### Non-interactive / CI

**StackShift — recommended full install:**

```bash
npx @extragraj/ui-forge init --yes \
  --scope=project \
  --platforms=claude \
  --features=scan,forge,verify,mcp-server,export-design,fetch-handoff,post-tool-verify-hook,project-cli \
  --theme=stackshift \
  --pair=on \
  --theme-override \
  --quick-scan=on
```

**All `init` flags:**

| Flag | Values | Description |
|------|--------|-------------|
| `-y, --yes` | — | Accept all defaults non-interactively |
| `--scope` | `project` \| `global` | Install location: project-local (`.claude/skills/ui-forge`) or global (`~/.claude/skills/ui-forge`) |
| `--platforms` | csv | Platforms to wire: `claude`, `cursor`, `agents`, `codex`, `copilot`, `gemini` |
| `--features` | csv | Features: `scan`, `forge`, `verify`, `mcp-server`, `export-design`, `fetch-handoff`, `post-tool-verify-hook`, `project-cli` |
| `--theme` | `shadcn` \| `mantine` \| `plain-tailwind` \| `stackshift` \| `none` | Seed `design-arch.json` with theme-specific tokens and conventions |
| `--pair` | `auto` \| `on` \| `off` | StackShift pairing; `auto` reads `.stackshift/installed.json` |
| `--mcp` | `on` \| `off` | Enable/disable MCP wiring (prefer `mcp-server` in `--features`) |
| `--mcp-clients` | csv | Subset of detected clients to wire: `claude-code`, `cursor`, `codex`, `cline` |
| `--quick-scan` | `on` \| `off` | Run a quick scan immediately after install |
| `--theme-override` | — | StackShift only: rewrite `globals.css` + `tailwind.config.*` with StackShift tokens before scanning |
| `--no-backup` | — | Skip `.bak` backups when `--theme-override` runs |
| `--force-forgeignore` | — | Overwrite a user-owned `.forgeignore` on re-install |
| `--dry-run` | — | Print planned actions; write nothing to disk |
| `--prune-unknown` | — | Auto-delete unrecognized files during legacy sweep |
| `-h, --help` | — | Show help |

### Subsequent management

| Command | Purpose |
|---------|---------|
| `npx @extragraj/ui-forge init` | Re-run to add/remove features; detects existing lockfile and uses previous selections as defaults |
| `npx @extragraj/ui-forge repair` | Re-apply wiring from the lockfile — use after moving the skill or restoring from CI |
| `npx @extragraj/ui-forge doctor` | Diagnose the install; `--fix` runs a full repair after diagnosis |
| `npx @extragraj/ui-forge ls` | Summarize the current install |
| `npx @extragraj/ui-forge version` | Print the bundled skill version and source location |
| `npx @extragraj/ui-forge uninstall` | Remove everything UI Forge wrote (leaves your code alone) |
| `npx @extragraj/ui-forge migrate` | One-shot migration from a pre-1.6.0 install |
| `npx @extragraj/ui-forge mcp-config` | Print the MCP server snippet for manual wiring |

### Slash commands wired by `init`

| Command | Description |
|---------|-------------|
| `/forge-scan` | Scan project → `design/design-arch.json` |
| `/forge --task "..." --refs <path> --output <path>` | Prepare generation context; AI generates the component |
| `/forge-verify <component.tsx> <contract.ts>` | Verify a generated component against its contract |
| `/forge-export-design` | Export design system as a Claude Design–ingestible bundle |
| `/forge-handoff <url>` | Fetch a Claude Design handoff URL and materialize refs locally |

For other agents that don't support slash commands, they invoke the skill through Bash tool calls instead.

## Terminal Invocation

After `ui-forge init`, the project root contains `./ui-forge.mjs` — a portable shim that resolves the skill location at runtime. Use it for any manual invocation:

```bash
node ui-forge.mjs scan --quick
node ui-forge.mjs scan --theme shadcn
node ui-forge.mjs forge --task "Convert hero" --refs ./hero.html --output ./Hero.tsx
node ui-forge.mjs verify ./Hero.tsx ./types.ts
node ui-forge.mjs export
node ui-forge.mjs handoff <url>
node ui-forge.mjs mcp        # run the MCP server (stdio)
```

The shim is safe to commit — `SKILL_ROOT` is resolved at runtime against the project-local install (or global install / `UI_FORGE_SKILL_ROOT` env var as fallback).

> **Without the shim:** If `./ui-forge.mjs` is missing, you can use `scripts/detect.js` to locate the skill: `node .claude/skills/ui-forge/scripts/detect.js`, then invoke any script directly: `node "<SKILL_ROOT>/scripts/scan.js" --quick`.

## How the Skill Works

1. **Install once** — Run `npx @extragraj/ui-forge init` to wire slash commands, permissions, and the project shim.
2. **Scan your project** — Run `/forge-scan` (slash command) or `node ui-forge.mjs scan` (terminal) to create `design/design-arch.json`. This captures your component libraries, Tailwind tokens, design standards, and conventions. Re-scan when you add libraries or update your theme. The scan runs in two phases: Phase 1 is static analysis (always runs); Phase 2 has the session AI synthesize design patterns from your source files — works with any AI in session (Claude, GPT-4o, Gemini, Codex, etc.).
3. **Ask your AI assistant** — Describe what you want to build (e.g., "Convert this hero section to a component"). The skill activates, `invoke.js` prepares structured generation context from your design system, and your AI assistant generates the production-ready component.

The `invoke.js` is a **context-preparation script**. Your coding assistant reads its output and generates the component using its own session.

## Advanced: Manual Invocation & Inspection

The `./ui-forge.mjs` shim handles skill resolution for you on every supported OS — no `SKILL_ROOT` boilerplate, no per-shell variants. Just `node ui-forge.mjs <command>`.

### Capturing Generation Context

For debugging or inspecting the generation context, capture it to a file:

```bash
# sh / bash / zsh / CMD
node ui-forge.mjs forge --task "Convert hero" --refs ./hero.html > forge-output.md

# PowerShell (explicit UTF-8 — if encoding issues)
node ui-forge.mjs forge --task "Convert hero" --refs ./hero.html | Out-File -Encoding utf8 forge-output.md
```

Review the captured file to verify the generation context before asking your AI to generate. The file can also be passed as a `--refs` input to another forge run to reuse a known-good context.

> **Windows note:** The `invoke.js` forces UTF-8 encoding on piped stdout, so `>` redirection in CMD and PowerShell produces clean UTF-8 output. If you see garbled text (characters spaced out), use the `Out-File -Encoding utf8` variant above.

## Features

### Installable Features

The `init` command installs a set of features into your target platform directories. Required features are always included; optional features can be toggled on any re-install.

**Required — always included**

| Feature | Installed file(s) | Slash command |
|---------|------------------|---------------|
| **Scan** | `scripts/scan.js` — scans project → `design/design-arch.json` | `/forge-scan` |
| **Forge** | `scripts/invoke.js` — prepares generation context → stdout | `/forge` |
| **Verify** | `scripts/verify.js`, `scripts/validate-contract.js`, `packages/variant-contract/` | `/forge-verify` |
| **MCP Server** | `scripts/mcp-server.js` — JSON-RPC 2.0 stdio server; auto-registered in detected Claude Code, Cursor, Codex, and Cline configs | — |

**Optional — Automation**

| Feature | What it wires | Notes |
|---------|--------------|-------|
| **Verify After Edit Hook** | `PostToolUse` entry in `settings.json` | Runs `verify.js` after every file edit; fast-exits on non-`.tsx` files and TSX without `// FORGE NOTES`; no script file copied |
| **Project CLI Shim** | `./ui-forge.mjs` at project root | Runtime-resolving wrapper; safe to commit; required for `node ui-forge.mjs` invocations |

**Optional — Claude Exclusives**

| Feature | Installed file(s) | Slash command |
|---------|------------------|---------------|
| **Export Design** | `scripts/export-design.js` — exports `design-arch.json` → `design/claude-design-bundle/` | `/forge-export-design` |
| **Fetch Handoff** | `scripts/fetch-handoff.js` — fetches a Claude Design handoff URL → local refs | `/forge-handoff` |

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
| `+STACKSHIFT_UI` | `.stackshift/installed.json` present, or `arch.isStackShift === true` (set by `--theme stackshift`) | Auto-injects variant-body hard rules (imports, JSX, styling, data) and enables paired-mode body checks in the validator |

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

> Other agents: use `node ui-forge.mjs forge` instead of `/forge` — the shim resolves `SKILL_ROOT` automatically.

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

UI Forge seeds built-in standards into `design/standards/` at install time (copied from the installer package's `references/standards/`). Once seeded they are project-local, versionable, and editable:

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

To suppress the built-in fallback lookup (source/dev-tree runs only), pass `--no-default-standards` or set `"_useBuiltins": false` in `design-arch.json`. For installed instances, standards already live in `design/standards/` — remove files from that directory to opt out of specific slots.

### Theme Starters

For fresh or greenfield projects, seed `design-arch.json` from a built-in preset instead of waiting for the scanner to find enough to work with:

```bash
node ui-forge.mjs scan --theme shadcn       # Tailwind + shadcn/ui
node ui-forge.mjs scan --theme mantine       # Mantine UI v7
node ui-forge.mjs scan --theme plain-tailwind  # No component library
node ui-forge.mjs scan --theme stackshift    # StackShift UI
```

Or with the slash command: `/forge-scan --theme stackshift` (or any other theme)

Themes are **gap-fill only** — scan findings always win. A theme fills `componentLib`, `usedComponents`, `usedLibraries`, `colorTokens`, and `patterns.*` only when the scanner couldn't detect them. The applied theme is recorded as `arch._theme` in `design-arch.json`.

**StackShift Theme Specific Behavior:** `--theme stackshift` does the following beyond gap-fill:
- Forces `isStackShift: true` in `design-arch.json` so the built-in `stackshift-ui` design standards are always injected at forge time — even on empty codebases or with `--quick`.
- Copies `references/themes/stackshift/standards/` to `design/standards/stackshift-ui/` (project-local, versionable, editable) and records the project-local path under `designStandards["stackshift-ui"]`.
- Copies general built-in standard (`nextjs-image.md`) to `design/standards/` and auto-registers it. `sample-standard.md` is a template for users to copy, not an active standard — it remains in `references/standards/` as documentation only.
- Handles `.forgeignore` with three-way logic: creates from StackShift template if missing, overwrites if it's a UI Forge template, or appends StackShift exclusions to an existing custom file.
- Preserves the `_paired` mirror block in `design-arch.json` on re-scan so StackShift paired-mode markers are never lost.
- **Theme override**: bootstraps `globals.css` and `tailwind.config.*` with StackShift CSS variable tokens, Inter font import, and a full `theme.extend` block before scanning — the scan then picks up the overridden files naturally. The `init` installer prompts for this interactively when StackShift is selected. For manual re-runs after install:

```bash
# Bootstrap globals.css + tailwind.config.ts with StackShift defaults, then scan
node ui-forge.mjs scan --theme stackshift --theme-override

# Skip .bak backup creation
node ui-forge.mjs scan --theme stackshift --theme-override --no-backup
```

> ⚠️ `--theme-override` modifies project files on disk. `.bak` backup files are created by default. Running again on already-overridden files is idempotent. Non-Google-Fonts `@import` lines are preserved.

See [Built-in Themes](./references/themes.md) for the full preset list and merge rules.

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
- **[Advanced Usage](./references/docs/advanced-usage.md)** — PostToolUse auto-verify hook, custom signals, troubleshooting, CI/CD integration
- **[Examples](./examples/index.md)** — Real-world conversion walkthroughs with full outputs and captured `forge-stdout.txt`
- **[Prompt Patterns](./references/prompt-patterns.md)** — Signal composition reference for extending UI Forge
- **[Built-in Themes](./references/themes.md)** — Available theme starters (`shadcn`, `stackshift`), merge behavior, and how to apply via `scan.js --theme <name>`
- **[Built-in Design Standards](./references/standards/index.md)** — `stackshift-ui` built-in standard (consolidated StackShift UI conventions), resolution order, and how to author project-local overrides
- **[Migration Guide](./references/docs/migration-guide.md)** — Upgrading between major versions
- **[Claude Design Handoff Format](./references/docs/claude-design-handoff-format.md)** — `--handoff` URL shape and ref materialization
- **[Versions](./references/docs/versions.md)** — Node, Next.js, StackShift, component library compatibility matrix

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
| [1.7.2](./change-logs/1-7-2-folder-reorg-and-test-runner.md) | 2026-05-23 | Folder reorganization, examples expansion, and a single tabular test runner. **References tree restructured**: docs moved to `references/docs/`, forgeignore template to `references/forgeignore/default.txt`, stackshift assets consolidated under `references/themes/stackshift/` (forgeignore + standards), `themes/README.md` renamed to `references/themes.md`, `references/standards/README.md` renamed to `index.md`. **Examples promoted to top-level surface**: `examples/index.md` is now the router; every numbered example carries `design-arch.json` + captured `forge-stdout.txt` for reproducibility. Added `05-brand-tokens` (+BRAND), `06-a11y-form` (+A11Y), `07-image-reference` (+IMAGE) walkthroughs. **`STANDARDS_BY_THEME` shape changed** to `{ sourcePath, destSubdir }` — decouples source location from the stable `design/standards/stackshift-ui/` destination so existing project copies keep working. **Single test runner**: 6 pre-1.7.2 `.mjs` test files replaced with `tests/run.js` — tabular output (PASS/FAIL/SKIP, per-test duration), 8 suites, ephemeral sandboxes that always clean up, `pnpm test -- --only=...` filter. **Legacy-sweep** keeps every old pre-1.7.2 path explicitly so existing skill dirs continue to clean up on re-install. Nothing changes about what's installed in target skill dirs — `prompt-patterns.md` is still the only `references/` runtime asset; `design/standards/stackshift-ui/` is still the destination. 25/25 tests passing. |
| [1.7.1](./change-logs/1-7-1-install-sweep-and-slash-fixes.md) | 2026-05-23 | Install sweep gaps + cross-platform slash commands. **(1) Source-bundle files leaking into the installed skill dir** — `commands/`, `LICENSE`, `package.json`, `package-lock.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `README.md`, and `skill.version` could end up inside `<scope>/skills/ui-forge/` from earlier installers or hand-extracted tarballs and were never removed by re-install, because none of them matched a `LEGACY_PATTERNS` rule (or a `NEVER_COPY` rule as defense-in-depth). Added all eight patterns to both lists in `cli/src/assets.ts` and `cli/src/legacy-sweep.ts`; `init`, `repair`, and `doctor --fix` now sweep them. **(2) Slash commands broken outside Claude Code** — every `commands/*.md` template used Claude Code's `!`-prefix eager shell substitution, which is a Claude-only extension. On Cline, Cursor, Codex, Copilot, and Gemini Antigravity those `!` lines render as inert markdown text and the underlying scripts never run; on Claude they run eagerly at load time. **(3) `/forge-scan` crash** — the second `!` line in the old `forge-scan.md` eagerly invoked `apply-synthesis.js '<your-json-here>'` with the literal placeholder before the AI ever synthesized JSON, producing `JSON parse error — Unexpected token '<'`. Every `commands/*.md` template rewritten as platform-agnostic AI instructions: fenced ``` ```\nnode … ``` ``` code blocks the host AI runs through its own bash/terminal tool, with explicit guidance to prompt the user for missing arguments instead of running with empty `$ARGUMENTS`. `wiring/commands.ts` still substitutes `$CLAUDE_PLUGIN_ROOT` at install time so the rendered command contains a real absolute path. 10 new integration tests (123 total). |
| [1.7.0](./change-logs/1-7-0-windows-hook-and-standards-crash.md) | 2026-05-22 | Two runtime bug fixes. **(1) invoke.js standards crash**: `loadDesignStandards` Step 3 called `readdirSync` on `references/standards/` inside the skill dir unconditionally — that directory is intentionally absent from installed instances (NEVER_COPY; content is seeded to `design/standards/` at install time by `bootstrapDesignStandards`). Every installed invocation that didn't already have all standards in `design/standards/` would crash with `ENOENT`. Fixed by guarding Step 3 with `existsSync(BUILTIN_STANDARDS_DIR)`; dev-tree runs (source checkout) still use the fallback. **(2) PostToolUse hook on Windows**: on Windows, PowerShell expands `"$CLAUDE_TOOL_INPUT_file_path"` in the hook command string to an empty string (PowerShell variables use `$env:VAR` syntax, not `$VAR`), so `verify.js` received an empty first argument, hit the usage-error guard (`!outputArg`), and exited with code 2 — surfaced as a blocking PostToolUse error after every edit. Fixed in `verify.js` by falling back to `process.env['CLAUDE_TOOL_INPUT_file_path']` when `argv[2]` is empty, making the hook work cross-platform. Documentation updated: "Built-in Design Standards" section now accurately describes the install-time seeding model rather than implying `references/standards/` is a runtime lookup; stale link to `references/standards/README.md` removed; hook table entry updated to mention fast-exit behavior. |
| [1.6.10](./change-logs/1-6-10-legacy-sweep-broaden.md) | 2026-05-22 | Legacy sweep broadening. Three categories of stale files left in target skill dirs by pre-1.6.0 installs were silently kept by previous sweeps because they didn't match any `LEGACY_PATTERNS` rule: **(1)** stray `design/` directories inside the skill dir (the design authority belongs at the project root, never in `.claude/skills/ui-forge/`); **(2)** every file under `references/` except `prompt-patterns.md` — `advanced-usage.md`, `migration-guide.md`, `versions.md`, `examples.md`, `claude-design-handoff-format.md`, `default-*forgeignore.txt`, and the entire `references/standards/` subtree are source-bundle metadata that the installer reads from its own package dir, not runtime assets the target needs; **(3)** `themes/README.md` (the only runtime theme asset is `themes/<selected>.json`). All three patterns added to `LEGACY_PATTERNS` in `cli/src/legacy-sweep.ts` (so `init`, `repair`, and `doctor --fix` now prune them) and mirrored in `NEVER_COPY` in `cli/src/assets.ts` (so accidentally-included files in a future source bundle would be filtered before write). Confirms: **`repair` runs the legacy sweep** — it delegates to `runInit` with `yes: true`, which calls `sweep()` per platform in `delete` mode. |
| [1.6.9](./change-logs/1-6-9-clack-prompts-dependency-fix.md) | 2026-05-22 | `@clack/prompts` dependency fix. `ui-forge init` was throwing `ERR_MODULE_NOT_FOUND: Cannot find package '@clack/prompts'` on every clean `npx` / `npm install` since 1.6.0. Root cause: the dependency was only declared in `cli/package.json` (which is `"private": true` and never published — only `cli/dist` ships via the root `files` array), so the root `@extragraj/ui-forge` manifest had no runtime dependencies at all and npm never resolved `@clack/prompts` for end users. Local monorepo installs masked this because the workspace had it available transitively. Fix: added `"@clack/prompts": "^0.7.0"` to the root `package.json` `dependencies`. No source, schema, or behavior changes beyond `init` actually starting. |
| [1.6.7](./change-logs/1-6-7-mcp-stale-path-fix.md) | 2026-05-22 | MCP stale path fix. When `ui-forge init` was previously run from a temp directory, the MCP server path written into `~/.claude.json` and Cline's `cline_mcp_settings.json` pointed into that temp dir — producing a permanently broken `✘ failed` MCP entry once the temp dir was cleaned up. The installer now resolves `skillDir` and `os.tmpdir()` before calling `writeMcp`, and skips MCP wiring with a warning when `skillDir` falls inside the system temp directory. No lockfile schema changes; no runtime script changes. |
| [1.6.6](./change-logs/1-6-6-orphan-cleanup.md) | 2026-05-22 | Disk-state cleanup pass — fixes a structural gap in 1.6.5 where theme, feature, and paired-mode prune routines were guarded by lockfile-vs-lockfile diff (`prior.X !== selections.X`) and therefore stopped firing once the lockfile had already been updated past the diff window. Pre-1.6.6 installs that ended up with `theme: "none"` while stale `_theme: stackshift` markers, `design/standards/stackshift-ui/`, deselected-feature command files, or the old StackShift `.forgeignore` template remained on disk could not be cleaned up by re-running `init`. **(1)** new `pruneOrphanedCommands` scans every selected platform's commands dir each install and removes provenance-owned `forge-*.md` whose feature isn't in the current selection (irrespective of `priorFeatures`). **(2)** `pruneThemeStandards` now iterates every value in `STANDARDS_BY_THEME` and prunes any subdir whose theme key doesn't match the current selection (irrespective of `prior.theme`); deleted paths go to `lockfile.pruned[]` only (no longer phantom-added to `files.design-standards`). **(3)** `design-arch.json` reset now also cleans `isStackShift`, stale `designStandards.<theme-key>` entries, and `patterns` (spacing/typography/conventions are tied to the prior theme's primitives so they're dropped on theme change — next scan repopulates) in addition to `_theme` and `tailwind.darkColorTokens` — all driven by on-disk comparison, not lockfile diff. Empty theme-standards subdirs (e.g. `design/standards/stackshift-ui/`) are now removed after their contents are pruned. **(4)** `.forgeignore` legacy detection: the bundled StackShift template now carries a `# ui-forge:stackshift-baseline` sentinel; `isUiForgeOwned()` recognizes the sentinel AND the legacy `#StackShift Workflow Skill` first line so pre-1.6.6 stackshift forgeignores still get replaced on theme switch-out. 93 tests passing. |
| [1.6.5](./change-logs/1-6-5-reinstall-cleanup.md) | 2026-05-22 | Reinstall cleanup. Deselecting a feature now removes its command files (previously only script files were pruned). Deselecting a platform removes all its skill files, commands, permissions, and hooks. Theme change: `.forgeignore` is force-replaced, theme-specific design standards are pruned, and `design-arch.json _theme` is reset immediately. Paired mode un-pair now correctly replaces the `.forgeignore`. MCP: creates `cline_mcp_settings.json` when missing instead of silently skipping Cline. Scan prompt now always shown when theme is "None". `doctor --fix` calls full repair (previously only ran the legacy sweep). `ui-forge update` deprecated — prints a warning and delegates to `repair`; removed from `--help`. |
| [1.6.4](./change-logs/1-6-4-cli-post-install-fixes.md) | 2026-05-22 | Post-install correctness pass on top of 1.6.3. **`skill.version` no longer copied into the installed skill dir** — version is stamped directly into `mcp-server.js` at install time via a new transform in `theme.ts`. New `ui-forge version` command prints the bundled version and source location. Optional-features prompt: **Automation** group now precedes **Claude Exclusives**. Quick scan now forwards `--theme <name>` to `scan.js` so StackShift installs actually seed `usedComponents`, `usedLibraries`, and the `stackshift-ui` standards directory. New `--theme-override` / `--no-backup` flags (and an interactive prompt for stackshift) to opt into destructive `globals.css` + `tailwind.config.*` rewrites; never triggered silently under `--yes`. `design/standards/` bootstrap now writes `_template-standard.md` (underscore prefix matches `scan.js`'s auto-registration filter) and also seeds `nextjs-image.md` (previously unreachable after standards moved out of the skill copy). StackShift `.forgeignore` is written without a provenance header — it's curated content, user-owned immediately. New `feature-prune.ts` removes tracked files when an optional feature is deselected on reinstall (required features never pruned; shared files preserved; `ui-forge.mjs` removed when `project-cli` is dropped). Paired-mode hook leak fixed: re-running `init` after deleting `.stackshift/` now strips the stale `ui-forge:stackshift-validate` entry. `writeHooks` is idempotent — no rewrite when settings.json is byte-identical. Dead `writeForgeignoreCompat` removed. Compact `ls` display for multi-platform installs. 5 stale tests fixed for 1.6.3 realities; 1 new test added; 84 total passing. |
| [1.6.3](./change-logs/1-6-3-features-prompt-lockfile-polish.md) | 2026-05-22 | Polish pass on the 1.6.2 UX overhaul. Required features (Scan, Forge, Verify, **MCP Server**) are now shown as a locked `p.note` instead of checkboxes — no more accidental deselection. Optional features use `groupMultiselect` with non-selectable group headers: **Claude Exclusives** (Export Design, Fetch Handoff) and **Automation** (Verify After Edit Hook, Project CLI Shim). Theme option labels are now Title Case (Shadcn, Mantine, Plain Tailwind, StackShift). Pairing question moved before Agentic Platforms. Scan now auto-runs when any theme is selected; prompts only when Theme = None (and a tailwind config is present). Lockfile cleaned: `summary` block removed (was duplicating root-level fields), `writtenByFeature` renamed `files`, `hooks`/`projectCli`/`themeLimited`/`forgeignoreSource` removed (derived from `features`+`paired`), duplicate `patched` entries merged, `pruned: []` omitted when empty, `_fileCount` added. `ui-forge.mjs --help` banner is now Title Case. |
| [1.6.2](./change-logs/1-6-2-ux-overhaul-and-polish.md) | 2026-05-22 | UX overhaul (Phase B) and polish (Phase C) from the 1.6.x fix plan. New prompt order (Features → Theme → Scan → Platforms → Scope). `mcp-server`, `post-tool-verify-hook`, and `project-cli` are now **Feature toggles** — the three separate confirm sub-prompts are removed. "No Theme" option added. Quick-scan prompt at end of install (`--quick-scan=on\|off` for CI). `--scope=both` removed (use `project` or `global`). "Target Platforms" renamed "Agentic Platforms". Title Case all prompt messages. Lockfile v2: flat `written[]` replaced by `writtenByFeature{}` + `summary` block; v1 lockfiles auto-migrated. `design/standards/` seeded from theme sources at install time (stackshift-ui standards bridge). `references/standards/` no longer copied into skill dir. `ui-forge.mjs` rewritten with `--help`, `--version`, proper exit codes. |
| [1.6.1](./change-logs/1-6-1-installer-fixes.md) | 2026-05-22 | Installer critical fixes uncovered during 1.6.0 dogfooding. **(1)** `PostToolUse` hook shape rewritten to Claude Code's actual schema (`{matcher: "Edit\|Write", hooks: [{type: "command", command: "..."}]}`); the 1.6.0 shape with object-typed `matcher` and top-level `id` was silently rejected. Legacy entries are migrated in place on re-install via a sibling `_uiForgeId` marker. Hook command env var corrected from `$CLAUDE_FILE_PATH` (never exported) to `$CLAUDE_TOOL_INPUT_file_path` (canonical) — so `verify.js` actually receives the edited file path. **(2)** Permission entries are now emitted in both quoted and unquoted variants when the install path contains whitespace, so `/forge-scan` no longer fails permission checks on paths like `C:/Users/Garry Caber/...` where the slash command body quotes the path but the wired permission was bare. **(3)** MCP client configs (Claude Code, Cursor, Codex TOML, Cline) now use `process.execPath` (absolute node binary path) instead of bare `"node"` — Cline on Windows launches MCP servers without inheriting a shell PATH, so the bare form failed to resolve. **(4)** `.forgeignore` re-installs now correctly replace the template when switching themes: every generated file carries a `# Generated by ui-forge@<version>` provenance header; files with the header are safe to replace, files without it are user-owned and preserved. New `--force-forgeignore` flag clobbers user-owned files explicitly. No lockfile schema break; no runtime script changes; pure wiring patches. 24 new integration tests (83 total). |
| [1.6.0](./change-logs/1-6-0-cli-installer.md) | 2026-05-21 | First-party install CLI (`pnpm dlx ui-forge init` / `npx ui-forge init`): replaces `scripts/cli.js install` and the legacy `npx skills add` install path. pnpm monorepo with new TypeScript installer in `cli/` (runtime stays stdlib-only JS). Interactive flow via `@clack/prompts` with full non-interactive (`--yes`) and CI-friendly flag equivalents. New commands: `init`, `repair`, `update`, `doctor` (with `--fix` and read-only sweep), `uninstall`, `migrate` (one-shot migration from pre-1.6.0 layout), `ls`, `mcp-config`. Typed asset manifest copies only the runtime files each selected feature needs; never copies dev assets (`cli/src/`, `tests/`, `change-logs/`, `CLAUDE.md`, `examples/`) into target skill dirs. Selective per-feature wiring of slash commands + scoped permissions (one entry per script, POSIX paths) + MCP servers (Claude Code, Cursor, Codex, Cline across Windows/macOS/Linux). Portable runtime-resolving `./ui-forge.mjs` shim at project root (safe to commit). StackShift pairing auto-detected via `.stackshift/installed.json`; stackshift theme runs in limited mode (`themeOverride` stripped, `_limited: true`) when unpaired. Provenance header (`# Generated by ui-forge@<version>`) templated per write so `update` produces clean diffs. Lockfile (`.ui-forge/installed.json`) tracks `written[]`, `patched[]`, and `pruned[]` for exact uninstall and audit. Legacy sweep removes pre-1.6.0 artifacts (`scripts/cli.js`, `examples/`, `tests/`, `change-logs/`, `CLAUDE.md`, deselected theme JSONs) from target dirs on init/doctor. Atomic writes with `.bak` backups on every patched JSON/TOML. Idempotent — re-running `init` with the same selections produces zero diff. Deprecation banner on `scripts/cli.js install` (will be removed in 1.7.0). 59 integration tests covering install, dry-run, idempotency, repair, sweep, doctor, ls, uninstall, stackshift limited-mode, and migrate. |
| [1.5.0](./change-logs/1-5-0-ai-agnostic-synthesis.md) | 2026-05-21 | AI-agnostic scan synthesis: `/forge-scan` is now a two-phase process. Phase 1 is pure static analysis (always runs, writes `design-arch.json`). Phase 2 delegates synthesis to the **session AI** — whichever model is active (Claude, GPT-4o, Gemini, Codex, etc.) — via `design/.synthesis-request.json`. New `scripts/apply-synthesis.js` validates and patches the arch file. Removed subprocess `claude` CLI invocation from `scan.js` entirely. Works in Claude Code, Cline, Cursor, Codex CLI, and any agentic environment. `--quick` skips Phase 2. 54 new assertions; 209 total. |
| [1.4.0](./change-logs/1-4-0-paired-mode-body-rules.md) | 2026-05-21 | StackShift paired-mode body rules: new `SIGNAL_STACKSHIFT_UI` prompt-pattern addendum (auto-injected under marker file OR `arch.isStackShift`), new `09-anti-patterns.md` consolidated standard, unified paired-mode detection (`pairedLike`) across `invoke.js` / `verify.js` / `validate-contract.js`, paired-mode body-rule checks in the shared validator (`packages/variant-contract/validate.js` — raw HTML primitives, `!important` in `className`, `import React`, `import * as @stackshift-ui/...` as violations; `?? "fallback"`, inline `style`, direct `next/image`/`next/link`, `@stackshift-ui/system` as warnings; comment/string-literal stripping to prevent false positives), `verify.js` switched to static import (Windows ESM URL bug fix), `validate-contract.js` simplified to delegate to shared validator, `scan.js` `copyBuiltinStandardDir` now file-level idempotent so new upstream standards propagate to existing `--theme stackshift` projects on rescan, `themes/stackshift.json` `colorTokens` aligned with `themeOverride`. 49 new assertions; 155 total across all test files. |
| [1.3.1](./change-logs/1-3-1-per-platform-skill-path.md) | 2026-05-21 | Multi-platform install fix: `cli.js install` now resolves the skill path **per target platform** instead of using one resolved path for every platform. If the skill is installed at that platform's own location (e.g. `.claude/skills/ui-forge` for the `.claude` platform), the platform-local relative path is used; otherwise it falls back to the actual skill location (other platform's path, or absolute `SKILL_ROOT` for global installs). Each `settings.json`'s Bash permission is now scoped to its own resolved path. Install output surfaces the resolved skill path per target. Verified across 5 scenarios (single-platform local, dual-platform local, global only, global + fresh project, global + local hybrid). |
| [1.3.0](./change-logs/1-3-0-mcp-server.md) | 2026-05-21 | MCP server: stdlib-only Model Context Protocol server (`scripts/mcp-server.js`) exposes `forge_invoke`, `forge_scan`, `forge_verify`, `forge_export_design` as MCP tools, so agentic CLIs without shell execution (restricted Cline modes, web-based clients) can still use ui-forge. New CLI commands: `ui-forge mcp` (launch server) and `ui-forge mcp-config` (print registration snippet for Cline/Claude Code/Cursor/Codex). JSON-RPC 2.0 over stdio, protocol version `2025-06-18`. 27 end-to-end checks. |
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
