# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

UI Forge is a **Claude Code skill** — a Node.js context-preparation tool (no build step, no framework, no API calls) that generates structured generation context for AI coding assistants. It is installed into target projects via the Skills CLI and runs against *that* project's codebase, not its own.

`SKILL.md` is the skill entrypoint: its YAML frontmatter triggers skill activation; the body is the operating spec for AI assistants.

**Key principle:** `invoke.js` does not call any AI API. It pre-processes reference files, loads the design authority, and prints structured context to stdout. The AI assistant (Claude Code or any other) reads that context and generates the component using its own session.

## Versioning

The canonical version lives in `skill.version` (plain text, one line, semver). To bump the version:

1. Edit `skill.version`
2. Run `node scripts/sync-version.mjs` — syncs to `package.json`, `README.md` (`> **Version** x.x.x` line), and `SKILL.md` frontmatter (`version:` field)
3. Add a new file in `change-logs/` using kebab-case filename format `x-x-x-short-description.md`
4. Add a row to the changelog table in `README.md`

## Commands

```bash
# Scan a target project (run once; creates design/design-arch.json in CWD)
node scripts/scan.js

# Prepare generation context (output goes to stdout; AI reads and generates)
node scripts/invoke.js --task "Convert hero section" --refs ./hero.html --output ./Hero.tsx

# Re-scan before generating
node scripts/invoke.js --task "..." --refs ./ref.html --rescan

# Force Stage 1 page plan regeneration
node scripts/invoke.js --task "Convert page" --refs ./page.html --replan

# Companion mode — variant generation from a props interface
node scripts/invoke.js --task "Build pricing variant" --signal CONVERT_VARIANT --refs ./types.ts --output ./Variant.tsx

# Sync version across all files after editing skill.version
node scripts/sync-version.mjs
```

`npm run scan` and `npm run generate` are shortcuts defined in `package.json`.

## Architecture

### Two entry points

- **`scripts/scan.js`** — Scans the *target* project (cwd), writes `design/design-arch.json` (v3 schema) and `design/component-usage.json`. AI synthesis uses the `claude` CLI first, then static fallback. No API key needed.
- **`scripts/invoke.js`** — Reads `design/design-arch.json`, classifies refs, detects signals, composes structured context, and prints to stdout. No API calls. AI assistant reads output and generates the component.

### Signal-based generation

`detectSignals()` in `invoke.js` classifies refs and determines:
- **Primary signal**: `CONVERT_SECTION` (default), `CONVERT_PAGE` (>400 lines or task mentions "page"), or `CONVERT_VARIANT` (single interface file, no HTML/image layout refs)
- **Modifiers**: `+CONFIG` (JSON/data ref present), `+IMAGE` (image ref present)
- **Override**: `--signal` flag forces the primary signal, bypassing auto-detection

`CONVERT_PAGE` triggers a **two-stage pipeline**:
- Stage 1 — outputs page decomposition context; the AI writes `design/forge-page-plan.json`
- Stage 2 — reads the plan, outputs per-section context; the AI generates each component file

`CONVERT_VARIANT` generates a component body implementing an externally-owned props interface. Default mode is `body-only`. Mutually exclusive with `CONVERT_PAGE`. Never writes `forge-page-plan.json`.

### Context output format

`invoke.js` prints one of four structured text blocks to stdout:

| Output | When |
|--------|------|
| `=== UI FORGE ===` | `CONVERT_SECTION` — single component context |
| `=== UI FORGE ===` | `CONVERT_VARIANT` — variant context with `SIGNAL: CONVERT_VARIANT` header |
| `=== UI FORGE — PAGE DECOMPOSITION (Stage 1) ===` | `CONVERT_PAGE`, no plan file yet |
| `=== UI FORGE — PAGE GENERATION (Stage 2) ===` | `CONVERT_PAGE`, plan file exists |

All outputs contain: task, design authority, pre-processed refs, generation instructions, and write target.

### Prompt composition

`references/prompt-patterns.md` contains named blocks parsed by `extractBlock()`. `CONVERT_SECTION` provides the base addendum. `SIGNAL_CONFIG` and `SIGNAL_IMAGE` provide addendum-only blocks appended after the base. These are embedded in the `GENERATION INSTRUCTIONS` section of the stdout output.

To add a new signal: add a `## SIGNAL_NAME` block in `prompt-patterns.md` with a fenced `**System Addendum:**` block, then add detection logic in `detectSignals()`.

### Design authority (`design/design-arch.json`)

The v3 schema:
- `componentLib` — array of discovered component directories
- `usedComponents` — named components imported from path-alias and scoped packages
- `usedLibraries` — non-framework packages with use counts
- `tailwind.themeSection` / `tailwind.colorTokens` — extracted from `tailwind.config.*`
- `globalCss` — excerpt from `globals.css`
- `designStandards` — object of `{ key: relPath }` pointing to markdown standard docs
- `patterns.spacing` / `patterns.typography` / `patterns.conventions` — AI-synthesized

`loadDesignArch()` auto-migrates v2 → v3 on read. Warns if >7 days old.

### Pre-processing pipeline

Before injection into context, refs are classified and transformed:
- `.html` → extract `<style>` blocks + inline styles as **EXTRACTED STYLES**, strip `<head>`/`<script>`, cap body at 200 lines
- `.tsx`/`.jsx` with JSX → extract classNames, CSS-in-JS, external imports, props interface, JSX return block; strip state/effects/handlers
- `.tsx`/`.jsx` without JSX, `.ts`/`.js` config-named → config role (condensed if >100 lines)
- `.json` → config role
- `.md` → companion role
- images → path reference only (AI reads via vision capability)

### Output format (generated component)

Components generated by the AI must begin with a `// FORGE NOTES` comment block documenting ref type, import swaps, token mappings, and divergences, then raw TSX with no markdown fences. Multiple files use `// --- FILE: path/to/file.tsx` separators.

## Key files

| File | Purpose |
|------|---------|
| `SKILL.md` | Skill entrypoint — YAML frontmatter + operating spec |
| `scripts/invoke.js` | Context-preparation script — outputs structured context to stdout |
| `scripts/scan.js` | Project scanner → `design-arch.json` |
| `references/prompt-patterns.md` | Composable signal instruction blocks |
| `references/advanced-usage.md` | Custom signals, troubleshooting |
| `skill.version` | Canonical version (edit this, then run `sync-version.mjs`) |
| `scripts/sync-version.mjs` | Syncs `skill.version` → `package.json`, `README.md`, `SKILL.md` |
| `change-logs/` | Per-release markdown notes in kebab-case (`x-x-x-description.md`) |
| `design/design-arch.json` | Generated design authority (not committed upstream) |
| `design/forge-page-plan.json` | Generated page plan — review and edit between Stage 1 and Stage 2 |

## Environment

- Node.js ≥ 18 required (uses ESM)
- No API key required for any operation
- No external dependencies — uses Node.js stdlib only (`fs`, `path`, `child_process`)
