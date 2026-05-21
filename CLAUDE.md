# CLAUDE.md

This file provides guidance to Claude Code and developers working on UI Forge.

## What This Is

UI Forge is a **Claude Code skill** — a Node.js context-preparation tool that generates structured generation context for AI coding assistants. It scans a target project's design system, prepares context, and prints it to stdout for the AI to read and use for generation. No API calls from the skill itself.

**Key principle:** `invoke.js` pre-processes ref files, loads design authority, and outputs context to stdout. The AI assistant reads that context and generates using its own session.

See **[README.md](./README.md)** for installation, commands, features, and user documentation.

## Versioning

Edit `skill.version` (plain text, one line, semver), then run:

```bash
node scripts/sync-version.mjs
```

This syncs to `package.json`, `README.md` (`> **Version**` line), and `SKILL.md` frontmatter. Then add a changelog entry in `change-logs/x-x-x-description.md` and update the table in `README.md`.

## Architecture for Developers

### Core scripts

| Script | Purpose |
|--------|---------|
| `scripts/scan.js` | Scans target project; writes `design/design-arch.json` (v3/v4 schema) and `design/.synthesis-request.json` for Phase 2 session-AI synthesis. |
| `scripts/apply-synthesis.js` | Receives synthesis JSON from the session AI, validates it, patches `design-arch.json` patterns, deletes `.synthesis-request.json`. |
| `scripts/invoke.js` | Reads arch, classifies refs, detects signals, composes context to stdout. Auto-migrates v3→v4 on read. |
| `scripts/validate-contract.js` | Post-gen contract validator for `CONVERT_VARIANT` outputs. Regex-based (no TS compiler). Exit 1 on violations. |
| `scripts/verify.js` | Extended verifier: static contract checks + optional Playwright screenshot. Single-arg mode auto-detects contract via `// @contract` directive. |
| `scripts/fetch-handoff.js` | Fetches Claude Design handoff URLs; materializes refs to `design/.handoff-cache/`. Standalone or invoked by `invoke.js --handoff`. |
| `scripts/export-design.js` | Reads `design-arch.json`; writes `design/claude-design-bundle/` (uploadable to Claude Design). |
| `scripts/detect.sh` / `scripts/detect.js` | Skill-root resolvers (bash and Node.js). Detects installed location via env vars (Priority 1), self-location (Priority 2), local search (Priority 3: `.claude`, `.agents`, etc.), and global paths (Priority 4: `~/.claude`, `~/.agents`, etc.). Used by AI agents, CI, and manual terminal invocation to locate the skill regardless of install location. |

### Signal composition

`invoke.js` `detectSignals()` classifies refs and returns:
- **Primary**: `CONVERT_SECTION` (default), `CONVERT_PAGE` (>400 lines or "page" task), `CONVERT_VARIANT` (props interface only)
- **Modifiers**: `+CONFIG`, `+IMAGE`, `+BRAND`, `+A11Y`, `+CREATIVE`, `+DIFF`, `+CLAUDE_DESIGN`
- **Paired mode**: `.stackshift/installed.json` detected; auto-activates `+A11Y` if `a11yRequired: true`

Two-stage pipeline for `CONVERT_PAGE`: Stage 1 outputs decomposition context → AI writes `forge-page-plan.json` → Stage 2 outputs per-section context.

Signals compose except: `+CREATIVE` mutually exclusive with `CONVERT_VARIANT`, `CONVERT_PAGE`, paired mode; `+DIFF` is `CONVERT_SECTION`-only.

### Prompt patterns

`references/prompt-patterns.md` contains signal instruction blocks parsed by `extractBlock()`:
- `CONVERT_SECTION` — base block (default)
- `SIGNAL_VARIANT` — replaces base in variant mode
- `SIGNAL_CONFIG`, `SIGNAL_IMAGE`, `SIGNAL_A11Y`, `SIGNAL_BRAND`, `SIGNAL_CREATIVE`, `SIGNAL_DIFF`, `SIGNAL_CLAUDE_DESIGN` — addendum blocks appended after base

Each signal requires specific FORGE NOTES sub-blocks documenting decisions. To extend: add a `## SIGNAL_NAME` block in `prompt-patterns.md` with `**System Addendum:**` section, then add detection logic in `invoke.js`.

### Design authority schema (v3/v4)

`design/design-arch.json` (created by `scan.js`, auto-migrated v2→v3→v4 on read):
- `componentLib`, `usedComponents`, `usedLibraries` — scanned from target
- `tailwind.{themeSection, colorTokens}` — extracted from `tailwind.config.*`
- `tailwind.darkColorTokens` — v4 only; `dark:` utilities from source (via `--schema-v4`)
- `globalCss` — excerpt from `globals.css`
- `designStandards` — `{key: relPath}` pointing to markdown docs; auto-populated from `design/standards/*.md`
- `patterns.{spacing, typography, conventions}` — AI-synthesized (static fallback when `--quick` or CLI unavailable)
- `_theme` — records which theme preset (shadcn, mantine, plain-tailwind, stackshift) filled the gaps

Set `_useBuiltins: false` to opt out of built-in standard fallbacks.

### Theme override (`--theme-override` flag on `scan.js`)

Surgically replaces three sections in project files **before** the scan reads them: Google Fonts `@import` in `globals.css`, `@layer base` block in `globals.css`, and `theme.extend` section in `tailwind.config.*`. Requires `--theme stackshift` (the `themeOverride` data lives in `themes/stackshift.json`). Creates `.bak` backups by default; `--no-backup` skips them. Replacement uses a brace-counting parser (not regex) to handle nested objects and is idempotent. Only Google-Fonts-style `@import url(...)` lines are replaced; other `@import` lines are preserved.

### `--no-design-authority` flag (on `invoke.js`)

Strips the DESIGN AUTHORITY block (arch context + design standards) from forge output. The AI follows reference styling instead. Requires at least one `--refs` file. Refused in paired (StackShift) mode. Note: design standards are also stripped — they are considered part of project design authority.

### File roles (pre-processing)

Refs are classified and transformed before injection:
- `.html` → extract `<style>` + inline styles; strip `<head>`/`<script>`; cap at 200 lines
- `.tsx`/`.jsx` with JSX → extract classNames, imports, props interface, JSX block; drop state/effects/handlers
- `.json` / config `.ts`/`.js` → condensed if >100 lines
- `.md` → condensed if >150 lines
- Images → path reference only (AI reads via vision)

### Generated output format

Components begin with `// FORGE NOTES` block documenting decisions, then raw TSX. Multiple files separated by `// --- FILE: path`.

## Key directories

- **`scripts/`** — Entry points: `cli.js`, `scan.js`, `invoke.js`, `verify.js`, etc.
- **`references/`** — Composable prompt patterns, built-in standards, themes, examples, docs
- **`commands/`** — Slash command definitions for Claude Code
- **`packages/variant-contract/`** — Zero-dependency contract validator module
- **`themes/`** — Theme presets (shadcn, mantine, plain-tailwind, stackshift)
- **`change-logs/`** — Per-release notes (kebab-case: `x-x-x-description.md`)

## Environment

- **Node.js** ≥ 18 required (ESM)
- **No API key** required (all work local to target project)
- **No external dependencies** — stdlib only (`fs`, `path`, `child_process`, `crypto`, `url`)

## Reference

See **[README.md](./README.md)** for:
- Installation and setup
- Slash commands and CLI usage
- Complete feature list and signal definitions
- Changelog with detailed version notes

See **[SKILL.md](./SKILL.md)** for:
- Skill activation and format
- Complete command reference
- Flag documentation and examples
