# UI Forge

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![Skills Compatible](https://img.shields.io/badge/skills-compatible-blue)](https://github.com/vercel/skills-cli)

> **Version** 0.1.4

Next.js component generator for Claude Code and AI coding assistants. Converts HTML, TSX, images, and JSON reference materials into production-ready components that match your project's existing design system — using your actual component libraries, Tailwind tokens, and coding conventions.

## What is UI Forge?

UI Forge is a Claude Code skill that understands your project before generating anything. It scans your codebase to extract component libraries, Tailwind tokens, and design standards, then uses that context to produce components that fit your stack — not generic templates.

- **Multi-input** — HTML templates, reference TSX, design images, JSON data shapes, or any combination
- **Design-aware** — reads your `tailwind.config`, global CSS, and component standards to map tokens and swap library components
- **Signal-based** — detects input type automatically and composes the right generation strategy
- **Documented output** — every import swap, token mapping, and divergence is recorded in `FORGE NOTES`

## Installation

```bash
npx skills add extragraj/ui-forge -y -g
```

| Flag | Description |
|------|-------------|
| `-y` | Auto-confirm all prompts |
| `-g` | Install globally — available across all projects |


## Quick Start

### 1. Scan your project

Run once to create `design/design-arch.json` — the design authority file that drives all generation.

```bash
node scripts/scan.js
```

This captures your component directories, used libraries, Tailwind tokens, global CSS, and any design standard documents. Re-run when you add new libraries, update your Tailwind theme, or change component standards.

### 2. Generate a component

```bash
node scripts/invoke.js \
  --task "Convert hero section with CTA buttons" \
  --refs ./hero.html \
  --output ./components/Hero.tsx
```

UI Forge reads `design-arch.json`, classifies your reference, detects signals, and prints structured generation context to stdout. Your AI assistant reads that context and writes the component — no separate API call needed.

**Example output:**

```tsx
// FORGE NOTES
// Detected: HTML reference with Tailwind utilities
// Project uses: shadcn/ui components
// Swaps: <button> → Button (from @/components/ui/button)
// Token mappings: bg-blue-600 → bg-primary
// No conflicts detected

import { Button } from '@/components/ui/button'

export default function Hero() {
  return (
    <section className="py-20 px-4">
      <h1 className="text-4xl font-bold">Welcome</h1>
      <Button className="mt-6">Get Started</Button>
    </section>
  )
}
```

### 3. Full page conversion (two-stage)

For pages with multiple sections (>400 lines or when the task mentions "page"), UI Forge uses a two-stage pipeline.

**Stage 1 — Decompose the page:**

```bash
node scripts/invoke.js \
  --task "Convert landing page" \
  --refs ./landing.html
```

Writes `design/forge-page-plan.json` and exits. Review the plan — set `existingProjectSection: true` on any sections you already have, adjust names or line ranges as needed.

```json
{
  "sections": [
    { "name": "hero", "type": "hero", "lines": [1, 68], "existingProjectSection": false },
    { "name": "features", "type": "features-grid", "lines": [69, 234], "existingProjectSection": true }
  ]
}
```

**Stage 2 — Generate sections:**

```bash
node scripts/invoke.js \
  --task "Convert landing page" \
  --refs ./landing.html
```

The plan file exists — UI Forge detects it and generates each `existingProjectSection: false` section sequentially. To discard the plan and restart Stage 1, pass `--replan`.

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
| `+A11Y` | `--a11y`, `a11yRequired` in design-arch or StackShift marker | WCAG 2.1 AA enforcement |

Signals stack — `CONVERT_SECTION + CONFIG + IMAGE + A11Y` is a valid combination and composes all instructions.

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

### Multiple Reference Inputs

Pass any combination of file types together:

```bash
node scripts/invoke.js \
  --task "Build pricing table" \
  --refs ./pricing.html,./tiers.json,./mockup.png
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
  "designStandards": { "stackshiftComponentStandard": "./design/standards/stackshift-ui.md" },
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

`detectSignals()` classifies refs and determines primary signal + modifiers. `references/prompt-patterns.md` holds composable instruction blocks — `CONVERT_SECTION` provides the base addendum; `SIGNAL_CONFIG` and `SIGNAL_IMAGE` append addendum-only blocks. These are embedded in the `GENERATION INSTRUCTIONS` section of the stdout output that the AI reads.

To add a new signal: add a `## SIGNAL_NAME` block with a fenced `**System Addendum:**` section in `prompt-patterns.md`, then add detection logic in `detectSignals()`.

## Token Optimization

UI Forge is built to minimize the context consumed by your AI session at every stage.

| Optimization | Detail |
|---|---|
| Script generates zero AI tokens | `invoke.js` does all pre-processing locally; only the output context is consumed by the AI |
| `prompt-patterns.md` cached | Read from disk once per run, not per section call |
| Component scan O(files) | Single pass over all files vs. O(components × files) previously |
| Page loop constants | Arch context and pattern computed once before the section loop |
| Ref pre-processing | Style blocks, classNames, and imports extracted to compact headers; raw files never sent in full |
| Images by path | Images are referenced by path and read via the AI's vision capability, not base64-encoded |

**Context budget (AI session):**

| Context | Est. tokens |
|---------|------------|
| Section generation | 3,000–5,000 |
| Page Stage 1 (decomposition) | Varies with page length |
| Page Stage 2 per section | 3,000–5,000 |

Keep `design-arch.json` under 2,000 tokens — use excerpts, not full file contents. Use the two-stage pipeline for pages over 400 lines.

## Companion Mode (StackShift Handoff)

When StackShift scaffolds a variant file and hands off to UI Forge, the skill
runs in contract-compliance mode:

```bash
node scripts/invoke.js \
  --task "Build pricing variant" \
  --signal CONVERT_VARIANT \
  --refs ./components/Pricing/types.ts \
  --output ./components/Pricing/Variant.tsx
```

The props interface is the contract — UI Forge imports it rather than
redefining it, destructures every prop, applies `?? undefined` to optionals,
and returns `null` when required props are absent.

**Contract version tag** (`0.1.3+`) — declare the contract version as JSDoc:

```ts
/** @contract-version 1.0.0 */
export interface PricingVariantProps { /* ... */ }
```

**Post-generation validation** — run the contract validator after generating:

```bash
node scripts/validate-contract.js \
  ./components/Pricing/Variant.tsx \
  ./components/Pricing/types.ts
```

Exit `1` on violations (missing default export, disallowed named exports,
required props not consumed, missing `null` fallback). Suitable for CI.

**Paired-mode detection** — if `.stackshift/installed.json` exists, UI Forge
logs the StackShift version, surfaces it in the generation context, and auto-
activates `+A11Y` when the marker's `a11yRequired` field is `true`.

## Accessibility (`+A11Y`)

Activate WCAG 2.1 AA enforcement with `--a11y`, or make it project-wide by
adding `"a11yRequired": true` to `design/design-arch.json`. Rules enforced:

- Semantic HTML (`<section>`, `<nav>`, `<main>` — never unlabelled `<div>`)
- Valid heading outline (one `<h1>`, no level skips)
- Accessible names for every interactive element
- Alt text on every `<img>` (explicit `alt=""` for decorative)
- Labels on every form input
- Visible focus states (`:focus-visible` not overridden without alternative)
- Contrast ratios meet AA
- 44×44px tap targets
- `prefers-reduced-motion` honored

Concerns that can't be resolved from the reference/contract are surfaced in
the FORGE NOTES `A11Y` sub-block as judgment calls.

## Documentation

- **[SKILL.md](./SKILL.md)** — Complete skill reference: signals, CLI flags, output format, resolution priority
- **[Advanced Usage](./references/advanced-usage.md)** — Custom signals, troubleshooting, CI/CD integration
- **[Examples](./references/examples.md)** — Real-world conversion walkthroughs with full outputs
- **[Prompt Patterns](./references/prompt-patterns.md)** — Signal composition reference for extending UI Forge
- **[Versions](./references/versions.md)** — Node, Next.js, StackShift, component library compatibility matrix

**CLI flags:**

| Flag | Description |
|------|-------------|
| `--task` | What to build (required) |
| `--refs` | Comma-separated reference file paths |
| `--output` | Write result to file path |
| `--signal` | Force primary signal: `CONVERT_SECTION`, `CONVERT_PAGE`, `CONVERT_VARIANT` |
| `--mode` | `full` (default) or `body-only`. Default is `body-only` under `CONVERT_VARIANT`. |
| `--a11y` | Enable `+A11Y` modifier (WCAG 2.1 AA enforcement) |
| `--no-default-standards` | Skip built-in fallback standards (arch + project only) |
| `--rescan` | Re-run `scan.js` before generating |
| `--replan` | Force Stage 1 page plan regeneration |
| `--config` | Load all params from a JSON file |

**Scan-only flags** (`scripts/scan.js`):

| Flag | Description |
|------|-------------|
| `--project-root <path>` | Scan a different directory (defaults to cwd) |
| `--patch` | Re-scan everything, preserve existing `designStandards` entries |
| `--quick` | Skip the `claude` CLI synthesis branch (static analysis only) |
| `--ignore <file>` | Load an additional ignore file (repeatable) |
| `--no-default-ignore` | Skip the built-in base ignore list |

## Changelog

Full release notes are in [`change-logs/`](./change-logs/).

| Version | Date | Notes |
|---------|------|-------|
| [0.1.4](./change-logs/0-1-4-ignore-and-defaults.md) | 2026-04-20 | `.forgeignore` + gitignore-subset matcher, directory-boundary pruning, `--ignore` / `--no-default-ignore` / `--quick` / `--no-default-standards` flags, three-layer `loadDesignStandards` with built-in template fallbacks |
| [0.1.3](./change-logs/0-1-3-contract-hardening-and-a11y.md) | 2026-04-14 | Contract hardening — `@contract-version` tag, CONTRACT header + FORGE NOTES sub-block, `validate-contract.js`, `+A11Y` modifier, anti-slop guardrail, paired-mode detection |
| [0.1.2](./change-logs/0-1-2-companion-mode.md) | 2026-04-14 | Companion mode — `CONVERT_VARIANT` signal, `--signal` and `--mode` flags, body-only output, page-pipeline guard |
| [0.1.1](./change-logs/0-1-1-pure-skill-refactor.md) | 2026-04-13 | Pure skill refactor — invoke.js is now a context-preparation script; removed programmatic API |
| [0.1.0](./change-logs/0-1-0-initial-release.md) | 2026-04-12 | First round optimization — 23 bugs, discrepancies, and optimizations resolved post-audit |

---

**Built for:** Claude Code · Cursor · Cline · GitHub Copilot · Any AI coding assistant supporting the Vercel Skills format

**Token-optimal. Production-ready. Design-authority-driven.**
