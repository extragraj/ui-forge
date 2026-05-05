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
# Post-install: wire slash commands + Bash permissions (run once from target project root after npx skills add)
# sh / bash — auto-detects install platform:
for d in .claude .agents .github .cursor .codex .copilot; do [ -f "$d/skills/ui-forge/scripts/cli.js" ] && node "$d/skills/ui-forge/scripts/cli.js" install && break; done
# PowerShell / Windows:
# @('.claude','.agents','.github','.cursor','.codex','.copilot') | % {"$_\skills\ui-forge\scripts\cli.js"} | ? {Test-Path $_} | select -f 1 | % { node $_ install }

# CLI proxy — all commands below are also available via cli.js <command> [args...]
node scripts/cli.js scan --quick
node scripts/cli.js forge --task "..." --refs ./ref.html --output ./Hero.tsx
node scripts/cli.js verify ./Hero.tsx ./types.ts
node scripts/cli.js export
node scripts/cli.js help

# Scan a target project (run once; creates design/design-arch.json in CWD)
node scripts/scan.js

# Scan with an extra ignore file / disable the built-in base / skip AI synthesis
node scripts/scan.js --ignore ./ci.ignore
node scripts/scan.js --no-default-ignore
node scripts/scan.js --quick

# Scan with schema v4 — extracts dark: Tailwind tokens into tailwind.darkColorTokens
node scripts/scan.js --schema-v4

# Prepare generation context (output goes to stdout; AI reads and generates)
node scripts/invoke.js --task "Convert hero section" --refs ./hero.html --output ./Hero.tsx

# Skip the built-in fallback standards (arch + project only)
node scripts/invoke.js --task "..." --refs ./ref.html --no-default-standards

# Re-scan before generating
node scripts/invoke.js --task "..." --refs ./ref.html --rescan

# Force Stage 1 page plan regeneration
node scripts/invoke.js --task "Convert page" --refs ./page.html --replan

# Companion mode — variant generation from a props interface
node scripts/invoke.js --task "Build pricing variant" --signal CONVERT_VARIANT --refs ./types.ts --output ./Variant.tsx

# Accessibility enforcement (+A11Y modifier)
node scripts/invoke.js --task "Build hero" --refs ./hero.html --a11y --output ./Hero.tsx

# Brand enforcement (+BRAND auto-detected from ref filename or designStandards.brand)
node scripts/invoke.js --task "Build hero" --refs ./hero.html,./BRAND.md --output ./Hero.tsx

# Creative / greenfield (+CREATIVE; standalone only — refused under variant/page/paired)
node scripts/invoke.js --task "Design a trust hero for a fintech site" --creative --refs ./BRAND.md --output ./Hero.tsx

# Iterative surgical edit (+DIFF; CONVERT_SECTION only)
node scripts/invoke.js --task "Add a sticky CTA bar above the footer" --diff ./components/Hero.tsx

# Claude Design handoff (+CLAUDE_DESIGN; fetches URL, materializes refs, remaps to project tokens)
node scripts/invoke.js --handoff https://claude.ai/design/h/<id> --output ./components/Hero.tsx

# Preview — write forge-preview.html (styled context snapshot; standalone mode only)
node scripts/invoke.js --task "..." --refs ./ref.html --preview

# Verify — add CONTRACT CHECK requirement to FORGE NOTES
node scripts/invoke.js --task "..." --refs ./types.ts --verify --output ./Variant.tsx

# Pre-flight input validation (CONVERT_VARIANT only — fails fast on malformed contract)
node scripts/invoke.js --task "..." --refs ./types.ts --validate-input

# Theme-seeded scan for fresh projects (gap-fill only; scan data wins)
node scripts/scan.js --theme shadcn
node scripts/scan.js --theme mantine
node scripts/scan.js --theme plain-tailwind
node scripts/scan.js --theme stackshift

# Post-generation contract validator (CONVERT_VARIANT output)
node scripts/validate-contract.js ./Variant.tsx ./types.ts

# Post-generation verifier — two-arg form (explicit contract path)
node scripts/verify.js ./Variant.tsx ./types.ts
node scripts/verify.js ./Variant.tsx ./types.ts --playwright http://localhost:3000

# Post-generation verifier — single-arg form (auto-detects contract from // @contract directive)
node scripts/verify.js ./Variant.tsx

# Fetch a Claude Design handoff URL and materialize refs (standalone)
node scripts/fetch-handoff.js https://claude.ai/design/h/<id> ./design/.handoff-cache/my-handoff

# Export design-arch.json as a Claude Design–ingestible bundle
node scripts/export-design.js
node scripts/export-design.js ./custom-out-dir

# Sync version across all files after editing skill.version
node scripts/sync-version.mjs
```

`npm run scan` and `npm run generate` are shortcuts defined in `package.json`. The `ui-forge` bin (via the `bin` field) exposes the same commands as `node scripts/cli.js` when the package is installed globally.

### Slash commands (Claude Code only)

```
/forge-scan [--theme shadcn|mantine|plain-tailwind|stackshift] [--schema-v4] [--quick]
/forge --task "<task>" --refs <path[,path]> --output <path>
/forge-verify <component.tsx> <contract.ts> [--playwright <url>]
/forge-export-design [out-dir]
```

All slash commands route through `$CLAUDE_PLUGIN_ROOT` and pass `$ARGUMENTS` through, so every flag works unchanged. Codex CLI uses the bash form with `$SKILL_ROOT` instead.

## Architecture

### Entry points

- **`scripts/scan.js`** — Scans the *target* project (cwd), writes `design/design-arch.json` (v3/v4 schema) and `design/component-usage.json`. AI synthesis uses the `claude` CLI first, then static fallback. No API key needed. Pass `--schema-v4` to extract dark-mode color tokens into `tailwind.darkColorTokens`. When the `claude` CLI is unavailable or fails, emits a loud `═`-bordered banner on stderr explaining the fallback and its effect on `patterns.*` fields. Suppressed by `--quick`.
- **`scripts/invoke.js`** — Reads `design/design-arch.json`, classifies refs, detects signals, composes structured context, and prints to stdout. No API calls. AI assistant reads output and generates the component. Auto-migrates v3→v4 schema on read. `--handoff <url>` spawns `fetch-handoff.js`, populates refs from the cache, and derives `--task` from the handoff README heading. `CONVERT_PAGE` Stage 2 validates `forge-page-plan.json` with `validatePagePlan()` before processing — exits 1 with per-field errors on malformed plans.
- **`scripts/validate-contract.js`** — Post-generation contract validator for `CONVERT_VARIANT` outputs. Heuristic/regex-based (no TypeScript compiler dependency). Reports violations: extra exports, missing destructures, missing `null` fallback, `?? null` for optionals. Exit `1` on failure — usable in CI.
- **`scripts/verify.js`** — Extended post-generation verifier. Runs all `validate-contract.js` checks plus optional Playwright visual screenshot (`--playwright <url>`). Imports shared logic from `packages/variant-contract/validate.js`. Detects paired mode and reports `a11yRequired` status. **Single-arg mode**: when called with only the output file path (e.g. from a PostToolUse hook), silently skips non-TSX files and files without `// FORGE NOTES`, then resolves the contract from a `// @contract <path>` directive in the first 30 lines.
- **`scripts/fetch-handoff.js`** — Fetches a Claude Design handoff URL (Node 18 `fetch`, no deps) and materializes refs into `design/.handoff-cache/<hash>/`. Handles JSON manifest (branch A), raw HTML (branch B), and zip (branch C — unsupported, exits with instructions). Invoked by `invoke.js --handoff`; can also run standalone.
- **`scripts/export-design.js`** — Reads `design/design-arch.json` and writes `design/claude-design-bundle/` — a folder uploadable to Claude Design containing `README.md`, `tokens.json`, `components.md`, `conventions.md`, `globals.css`, and `standards/*.md`.

### Signal-based generation

`detectSignals()` in `invoke.js` classifies refs and determines:
- **Primary signal**: `CONVERT_SECTION` (default), `CONVERT_PAGE` (>400 lines or task mentions "page"), or `CONVERT_VARIANT` (single interface file, no HTML/image layout refs)
- **Modifiers**: `+CONFIG` (JSON/data ref present), `+IMAGE` (image ref present), `+BRAND` (ref filename matches `/brand|voice|tone/i`, or `arch.designStandards.brand` set), `+A11Y` (via `--a11y`, `arch.a11yRequired`, or `.stackshift/installed.json` `a11yRequired: true`), `+CREATIVE` (via `--creative`; **refused** under `CONVERT_VARIANT`, `CONVERT_PAGE`, and paired mode), `+DIFF` (via `--diff <path>`; **`CONVERT_SECTION` only** — refused under `CONVERT_VARIANT`, `CONVERT_PAGE`, and `+CREATIVE`), `+CLAUDE_DESIGN` (via `--handoff <url>` or any ref path under `design/.handoff-cache/`; handoff wins for layout, design-arch wins for tokens)
- **Override**: `--signal` flag forces the primary signal, bypassing auto-detection
- **Paired mode**: `.stackshift/installed.json` presence is detected; surfaced as `PAIRED: stackshift x.y.z` in `CONVERT_VARIANT` output; honors `a11yRequired`; blocks `+CREATIVE`

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

All outputs contain: task, design authority (path references), pre-processed refs, generation instructions, and write target.

`CONVERT_SECTION` and `CONVERT_PAGE` Stage 2 in non-lite mode additionally include an **IMPLEMENTATION** section (step-by-step generation order) and an **ANTI-SLOP GUARDRAILS** section (explicit fidelity checklist) between the refs and GENERATION INSTRUCTIONS. These are omitted in `--lite` mode.

The **DESIGN AUTHORITY** block uses a reference-based format in both lite and non-lite modes — token names, file paths to `tailwind.config.*` and `globals.css`, and one-line summaries for spacing/typography. Full values are in `design/design-arch.json` which the AI reads on demand. **DESIGN STANDARDS** are listed as `// [REF] key [path]: description` load-on-demand references rather than injected inline.

### Prompt composition

`references/prompt-patterns.md` contains named blocks parsed by `extractBlock()`. `CONVERT_SECTION` provides the base addendum. `SIGNAL_CONFIG`, `SIGNAL_IMAGE`, `SIGNAL_A11Y`, `SIGNAL_BRAND`, `SIGNAL_CREATIVE`, and `SIGNAL_DIFF` provide addendum-only blocks appended after the base. `SIGNAL_VARIANT` replaces `CONVERT_SECTION` as the base under companion-mode handoff. These are embedded in the `GENERATION INSTRUCTIONS` section of the stdout output.

The `CONVERT_SECTION` and `SIGNAL_VARIANT` base blocks include an **anti-slop aesthetic guardrail** (no default hero gradients, no rainbow headings, no filler CTAs, no Lorem ipsum, visual density matches reference/contract).

`SIGNAL_CREATIVE` bundles the `// FORGE PHILOSOPHY` directive inside its addendum (one block, no separate file) — restraint over ornament, earned hierarchy, content-justified sections. `SIGNAL_BRAND` requires FORGE NOTES to include a `BRAND` sub-block documenting voice adjustments, brand-color → design-arch token mappings, and typography decisions.

`SIGNAL_DIFF` (0.1.6+) is injected only when `--diff <path>` is passed. `invoke.js` loads the existing file as `diffSource`, emits an `EXISTING COMPONENT [path]` block in the section context, and defaults `--output` to the diff path. The addendum instructs the AI to preserve unchanged regions and rewrite FORGE NOTES from scratch with a `DIFF` sub-block.

`SIGNAL_VARIANT` requires FORGE NOTES to include a `// CONTRACT` sub-block documenting contract path, interface name, version, every prop consumed, fallback rule verified, and exports invariant confirmation. It also requires a `// @contract <path>` directive on line 3 of FORGE NOTES — this machine-readable tag is what `verify.js` single-arg mode uses to auto-detect the contract in PostToolUse hooks.

`SIGNAL_CLAUDE_DESIGN` is injected when `+CLAUDE_DESIGN` is active. The addendum enforces that layout comes from the handoff but all tokens are remapped to `design-arch.json`. Requires a `// CLAUDE_DESIGN` sub-block in FORGE NOTES documenting source URL, task summary, and token remappings.

To add a new signal: add a `## SIGNAL_NAME` block in `prompt-patterns.md` with a fenced `**System Addendum:**` block, then add detection logic in `detectSignals()`.

### Design authority (`design/design-arch.json`)

The v3 schema:
- `componentLib` — array of discovered component directories
- `usedComponents` — named components imported from path-alias and scoped packages
- `usedLibraries` — non-framework packages with use counts
- `tailwind.themeSection` / `tailwind.colorTokens` — extracted from `tailwind.config.*`
- `tailwind.darkColorTokens` — (v4 only, via `--schema-v4`) comma-separated `dark:` Tailwind utilities found in source. Namespace reserved to avoid conflict with StackShift Studio dark-mode theming.
- `globalCss` — excerpt from `globals.css`
- `designStandards` — object of `{ key: relPath }` pointing to markdown standard docs. Auto-populated with any `design/standards/*.md` files found during scan. Set `"_useBuiltins": false` to opt out of built-in fallbacks.
- `patterns.spacing` / `patterns.typography` / `patterns.conventions` — AI-synthesized
- `_theme` — set when `scan.js --theme <name>` was used; records which starter preset filled the gaps

`loadDesignArch()` auto-migrates v2 → v3 → v4 on read. Warns if >7 days old.

### Ignore handling (0.1.4+)

`scan.js` reads ignore patterns with a gitignore-subset matcher — globstar
`**`, `*`, `?`, leading `/` anchor, trailing `/` dir-only, `!` negation, `#`
comments. Patterns are compiled once into `{raw, negate, anchored, dirOnly, regex}`
and evaluated with last-wins-on-conflict semantics.

Precedence: built-in base → `.gitignore` → `.agentic.ignore` → `.claude.ignore`
→ `.forgeignore` → `--ignore <file>`. The walker tests `isIgnored(rel, isDir)`
on every dirent; matched directories are pruned before descent.

New files: `.forgeignore` (project root, optional); template at
`references/default-forgeignore.txt`.

### Design standards resolution (0.1.4+)

`invoke.js` `loadDesignStandards()` resolves each standard slot in three layers,
last wins per key:

1. `arch.designStandards[key]` — explicit.
2. `PROJECT_ROOT/design/standards/<key>.md` — auto-registered by `scan.js`.
3. `CLAUDE_SKILL_DIR/references/standards/<key>.md` — built-in fallback.

Canonical slots: `typography`, `spacing`, `color`, `a11y`. Built-in templates
are empty on ship; an `isSubstantive()` helper skips templates whose body is
only HTML comments / markdown headings, so fresh installs inject no fallback
content. Each injected block carries a `# source: arch | project | built-in`
marker. Opt-out via `--no-default-standards` or `_useBuiltins: false`.

### Theme starters (0.1.6+)

`scan.js --theme <name>` loads a preset from `themes/<name>.json` and merges
it into the scan output after synthesis. Ships with `shadcn`, `mantine`,
`plain-tailwind`, and `stackshift`. Merge semantics (gap-fill only; scan data wins):

- `componentLib` replaced only if scan fell back to the default `['./components']`
- `usedComponents` theme hints appended (deduped) when scan found fewer than 5
- `usedLibraries` theme hints appended when not already present by name
- `tailwind.colorTokens` filled only if empty
- `patterns.spacing` / `patterns.typography` filled only if `'unknown'`
- `patterns.conventions` filled only if empty

Unknown `--theme` values fail fast on stderr with the available list. The
applied theme is recorded as `arch._theme`.

**StackShift-specific behavior (0.2.7+):**
- `--theme stackshift` forces `isStackShift: true` in `design-arch.json` regardless of what static analysis or AI synthesis returns — critical for fresh codebases, `--quick` mode, or when the Claude CLI is unavailable.
- `findDesignStandards()` records `stackshift-ui` → the built-in `references/standards/stackshift-ui/` directory, making the active standards visible in `design-arch.json` and giving users a clear override point.
- `scan.js` creates `design/standards/` on every scan if it does not exist, so project-level standard overrides always have a home.
- `cli.js install` wires `variant-router` into `designStandards` when `.stackshift/installed.json` is present and `design-arch.json` already exists (from a prior scan), resolving `PAIRED: stackshift unknown` version detection.

### Pre-processing pipeline

Before injection into context, refs are classified and transformed:
- `.html` → extract `<style>` blocks + inline styles as **EXTRACTED STYLES**, strip `<head>`/`<script>`, cap body at 200 lines
- `.tsx`/`.jsx` with JSX → extract classNames, CSS-in-JS, external imports, props interface, JSX return block; strip state/effects/handlers
- `.tsx`/`.jsx` without JSX, `.ts`/`.js` config-named → config role (condensed if >100 lines)
- `.json` → config role (or brand role if basename matches `/brand|voice|tone/i`)
- `.md` → companion role (or brand role if basename matches `/brand|voice|tone/i`)
- images → path reference only (AI reads via vision capability)

### Output format (generated component)

Components generated by the AI must begin with a `// FORGE NOTES` comment block documenting ref type, import swaps, token mappings, and divergences, then raw TSX with no markdown fences. Multiple files use `// --- FILE: path/to/file.tsx` separators.

## Key files

| File | Purpose |
|------|---------|
| `SKILL.md` | Skill entrypoint — YAML frontmatter + operating spec |
| `scripts/cli.js` | CLI entry point — `install`, `scan`, `forge`, `verify`, `export`, `help`; proxies all flags to underlying scripts; wired as `ui-forge` bin in `package.json` |
| `scripts/invoke.js` | Context-preparation script — outputs structured context to stdout |
| `scripts/scan.js` | Project scanner → `design-arch.json` (v3/v4; use `--schema-v4` for dark tokens) |
| `scripts/validate-contract.js` | Post-generation contract validator for `CONVERT_VARIANT` outputs |
| `scripts/verify.js` | Extended verifier — static contract checks + optional Playwright screenshot; single-arg mode for PostToolUse hooks |
| `scripts/fetch-handoff.js` | Fetches a Claude Design handoff URL and materializes refs into `design/.handoff-cache/` |
| `scripts/export-design.js` | Exports `design-arch.json` as a Claude Design–ingestible bundle to `design/claude-design-bundle/` |
| `scripts/detect.sh` | Cross-agent skill-root resolver — used by Codex CLI bash invocations |
| `scripts/sync-version.mjs` | Syncs `skill.version` → `package.json`, `README.md`, `SKILL.md` |
| `commands/forge-scan.md` | `/forge-scan` slash command (Claude Code) |
| `commands/forge.md` | `/forge` slash command (Claude Code) |
| `commands/forge-verify.md` | `/forge-verify` slash command (Claude Code) |
| `commands/forge-export-design.md` | `/forge-export-design` slash command (Claude Code) |
| `references/prompt-patterns.md` | Composable signal instruction blocks (CONVERT_SECTION, SIGNAL_VARIANT, SIGNAL_CLAUDE_DESIGN, + modifiers) |
| `references/advanced-usage.md` | Custom signals, PostToolUse auto-verify hook, troubleshooting |
| `references/claude-design-handoff-format.md` | API shape discovery notes for Claude Design handoff URLs |
| `references/versions.md` | Version compatibility matrix (Node, Next.js, StackShift, libraries) |
| `references/standards/` | Built-in fallback design standards (empty templates: typography, spacing, color, a11y) |
| `references/standards/README.md` | How the three-layer standards resolution works and how to override |
| `references/default-forgeignore.txt` | Empty-by-default `.forgeignore` template with copy-paste instructions |
| `themes/` | Theme starter presets for `scan.js --theme <name>` (`shadcn`, `mantine`, `plain-tailwind`, `stackshift`) |
| `packages/variant-contract/` | `@extragraj/variant-contract` — zero-dependency validator module + contract spec |
| `examples/` | Four annotated conversion examples (one per primary signal) |
| `skill.version` | Canonical version (edit this, then run `sync-version.mjs`) |
| `change-logs/` | Per-release markdown notes in kebab-case (`x-x-x-description.md`) |
| `design/design-arch.json` | Generated design authority (not committed upstream) |
| `design/forge-page-plan.json` | Generated page plan — review and edit between Stage 1 and Stage 2; validated by `validatePagePlan()` before Stage 2 |
| `design/.handoff-cache/` | Runtime cache for fetched Claude Design handoffs (keyed by URL hash; excluded from scan) |
| `design/claude-design-bundle/` | Export output from `export-design.js` — uploadable to Claude Design |
| `.stackshift/installed.json` | Paired-mode marker (external, written by StackShift) — triggers paired-mode detection |

## Environment

- Node.js ≥ 18 required (uses ESM)
- No API key required for any operation
- No external dependencies — uses Node.js stdlib only (`fs`, `path`, `child_process`, `crypto`, `url`)
