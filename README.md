# UI Forge

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![Skills Compatible](https://img.shields.io/badge/skills-compatible-blue)](https://github.com/vercel/skills-cli)

Production-ready Next.js component generator from reference materials. Converts HTML, TSX, images, and JSON into project-compliant components that match your existing design system.

## What is UI Forge?

UI Forge is an AI-powered component generator that transforms reference materials into production Next.js components. Unlike simple code generators, UI Forge:

**Understands your project:**
- Scans your codebase to detect component libraries (shadcn/ui, Radix, etc.)
- Extracts Tailwind tokens and theme configuration
- Finds and follows your component standard documentation
- Maps reference code to your actual project patterns

**Handles multiple input types:**
- HTML templates → TSX components
- Reference TSX → Project-library-compliant TSX
- Design mockups (images) → Implemented components
- JSON data shapes → Config-driven components
- Full pages → Modular section breakdown

**Produces quality output:**
- Production-ready code (no TODOs or stubs)
- Proper TypeScript types (reuses existing project types)
- Library component swapping (ref button → your Button component)
- Token mapping (ref colors → your Tailwind theme)
- FORGE NOTES documentation of all transformations

**Perfect for:**
- Converting design handoffs (Figma exports, HTML templates) to your stack
- Migrating components from other component libraries
- Generating variants of existing patterns
- Building config-driven components from data shapes
- Scaffolding new sections that match project conventions

## Installation

### Via Skills CLI (Recommended)

```bash
# Install globally
npx skills add username/ui-forge

# Or add to a specific project
cd your-nextjs-project
npx skills add username/ui-forge
```

### Manual Installation

```bash
# Clone the repository
git clone https://github.com/username/ui-forge.git
cd ui-forge

# No build step required - uses Node.js stdlib only
```

### Prerequisites Checklist

- [x] Node.js >= 18.0.0
- [x] Next.js project (App Router or Pages Router)
- [x] Anthropic API key (for AI generation)
- [x] Optional: Tailwind CSS (for token mapping)
- [x] Optional: Component library (shadcn/ui, Radix, etc.)

**Set up your API key:**

```bash
export ANTHROPIC_API_KEY=your_key_here
# Add to ~/.bashrc or ~/.zshrc for persistence
```

## Quick Start

### 1. Scan Your Project

First time only — creates `design/design-arch.json`:

```bash
node scripts/scan.js
```

This analyzes your project and creates a design authority file containing:
- Component libraries in use
- Tailwind theme tokens
- Typography and spacing patterns
- Component standard documentation (if present)

**You only need to re-run this when:**
- You add new component libraries
- You update your Tailwind theme significantly
- You change component standards

### 2. Generate a Component

Convert a single section or component:

```bash
node scripts/invoke.js \
  --task "Convert hero section with CTA buttons" \
  --refs ./hero.html \
  --output ./components/Hero.tsx
```

**What happens:**
1. Reads `design-arch.json` to understand your project
2. Analyzes the reference file (detects Tailwind, vanilla HTML, etc.)
3. Maps reference components to your project libraries
4. Generates production TSX with proper imports and types
5. Outputs with FORGE NOTES documenting all transformations

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

### 3. Convert Full Pages (Two-Stage Pipeline)

For large pages with multiple sections:

**Stage 1 — Plan the decomposition:**

```bash
node scripts/invoke.js \
  --task "Convert landing page" \
  --refs ./landing.html
```

Creates `design/forge-page-plan.json`:

```json
{
  "_ref": "./landing.html",
  "_created": "2026-04-08T10:30:00.000Z",
  "sections": [
    {
      "name": "hero",
      "type": "hero",
      "lines": [1, 68],
      "existingProjectSection": false
    },
    {
      "name": "features",
      "type": "features-grid",
      "lines": [69, 234],
      "existingProjectSection": true
    }
  ]
}
```

**Edit the plan:**
- Set `existingProjectSection: true` to skip sections you already have
- Rename `name` or `type` for better component names
- Review line ranges to ensure proper section boundaries

**Stage 2 — Generate the sections:**

```bash
# Run the same command again
node scripts/invoke.js \
  --task "Convert landing page" \
  --refs ./landing.html
```

Generates each section sequentially where `existingProjectSection: false`.

## Features

### Signal-Based Architecture

UI Forge uses compositional signal detection to determine the right generation strategy:

**Primary signals (scope):**
- `CONVERT_PAGE` — Full page decomposition (> 400 lines or task mentions "page")
- `CONVERT_SECTION` — Single component/section (default)

**Modifiers (stackable):**
- `+CONFIG` — JSON/data file present → generates config-driven component
- `+IMAGE` — Image file present → uses vision API for design reference

**Example combinations:**
- HTML file → `CONVERT_SECTION`
- HTML + JSON → `CONVERT_SECTION` + `CONFIG`
- Image mockup → `CONVERT_SECTION` + `IMAGE`
- Large HTML → `CONVERT_PAGE` (two-stage pipeline)
- Large HTML + JSON + images → `CONVERT_PAGE` + `CONFIG` + `IMAGE`

### Intelligent Token Mapping

**Color tokens:**
```
ref: bg-blue-500
→ bg-primary (from your tailwind.config.js)
```

**Spacing:**
```
ref: padding: 20px
→ p-5 (matches your project's spacing scale)
```

**Typography:**
```
ref: font-size: 24px
→ text-2xl (from your typography system)
```

### Library Component Swapping

Automatically replaces reference components with your project's libraries:

**Example: HTML → shadcn/ui**
```
<button class="...">  →  <Button variant="default">
<div class="card">    →  <Card>
<input type="text">   →  <Input />
```

**Example: Material UI → shadcn/ui**
```tsx
import { Button } from '@mui/material'
<Button variant="contained">

// Becomes:
import { Button } from '@/components/ui/button'
<Button variant="default">
```

### Project Standards Integration

If you have a component standard document, UI Forge follows it:

```
Found: docs/component-standards.md
→ Loads and follows all component usage rules
→ Uses specified props patterns
→ Matches naming conventions
→ Follows composition patterns
```

**Example standards it respects:**
- "Always use Button instead of <button>"
- "Cards must have explicit border radius"
- "Images require priority prop for above-fold content"
- Custom prop naming conventions

## Documentation

### Full Documentation

- **[SKILL.md](./SKILL.md)** — Complete skill reference (usage, signals, output format)
- **[Advanced Usage](./references/advanced-usage.md)** — Config files, troubleshooting, API
- **[Examples](./references/examples.md)** — Real-world conversion examples

### API Reference

**Programmatic usage (Node.js):**

```javascript
import { forge } from './scripts/invoke.js'

const result = await forge({
  task: "Convert pricing section",
  refs: ["./pricing.html", "./pricing-data.json"],
  output: "./components/Pricing.tsx"
})
```

See [Advanced Usage](./references/advanced-usage.md) for full API documentation.

### Example Scenarios

**Convert HTML template:**
```bash
node scripts/invoke.js \
  --task "Convert hero section" \
  --refs ./hero.html
```

**Build from image mockup:**
```bash
node scripts/invoke.js \
  --task "Match this design" \
  --refs ./hero-mockup.png
```

**Config-driven component:**
```bash
node scripts/invoke.js \
  --task "Build feature grid" \
  --refs ./features-data.json
```

**Multiple references:**
```bash
node scripts/invoke.js \
  --task "Build pricing table with data" \
  --refs ./pricing.html,./tiers.json,./mockup.png
```

See [Examples](./references/examples.md) for complete walkthroughs with outputs.

## Architecture

### Design Authority System

UI Forge uses a cached design authority file (`design/design-arch.json`) that contains:

```json
{
  "_v": 3,
  "componentLib": ["./components", "./components/ui"],
  "usedComponents": ["Button", "Card", "Input", "Dialog"],
  "usedLibraries": [
    { "name": "framer-motion", "version": "^12.0.0", "uses": 14 }
  ],
  "tailwind": {
    "themeSection": "...",
    "colorTokens": "primary, secondary, accent"
  },
  "globalCss": "...",
  "designStandards": {
    "stackshiftComponentStandard": "./design/standards/stackshift-ui.md"
  },
  "patterns": {
    "spacing": "4-based scale with py-20 sections",
    "typography": "font-sans default, headings font-bold",
    "conventions": ["PascalCase components", "use 'use client' for interactive"]
  }
}
```

**v3 improvements:**
- `componentLib` is now an array of discovered component directories
- `designStandards` object for extensible user-defined standards
- Component usage tracking in separate `design/component-usage.json`

**Why cache?**
- Scanning a full project takes 10-30 seconds
- Design patterns change infrequently
- Re-scan when libraries/theme change (weekly or as-needed)

### Signal Detection

1. Classify each ref file by content (not just extension)
2. Detect primary scope (`CONVERT_PAGE` vs `CONVERT_SECTION`)
3. Detect modifiers (`+CONFIG`, `+IMAGE`)
4. Compose generation prompt from signal combination
5. Load appropriate prompt patterns from `references/prompt-patterns.md`

### Prompt Patterns

Composable prompt segments stored in `references/prompt-patterns.md`:

```markdown
## SIGNAL: CONVERT_SECTION
Base instructions for single component generation...

## SIGNAL: CONFIG
Addendum: Use JSON shape for component props...

## SIGNAL: IMAGE
Addendum: Match visual design from image...
```

Signals combine: `CONVERT_SECTION` + `CONFIG` + `IMAGE` merges all three patterns.

### Pre-Processing Pipeline

1. Load design-arch.json
2. Load component standard (if set)
3. Classify ref files (reference, config, image, companion)
4. Detect primary signal + modifiers
5. Compose prompt from patterns
6. Execute generation (Haiku for planning, Sonnet for code)
7. Post-process output (FORGE NOTES + raw code)

## Token Optimization

UI Forge uses a three-tier loading architecture:

| State | Tokens | What's Loaded |
|-------|--------|---------------|
| Installed, idle | 50-100 | YAML frontmatter only |
| Active (section) | 3000-5000 | SKILL.md + design-arch + refs |
| Active (page Stage 1) | 2000-3000 | SKILL.md + design-arch (Haiku) |
| Active (page Stage 2) | 3000-5000/section | Per-section sequential |
| User reads examples | +500-1500 | Specific reference doc |

**Best practices:**
- Keep design-arch.json under 2000 tokens (excerpts, not full files)
- Use two-stage pipeline for pages > 400 lines
- Reference docs loaded only when explicitly needed
- Sequential section generation (not parallel) to control token usage

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**Areas for contribution:**
- Additional signal types (e.g., `+ANIMATION`, `+FORM`)
- More prompt patterns in `references/prompt-patterns.md`
- Support for additional component libraries
- Improved token mapping heuristics
- Test coverage

## License

MIT License - see [LICENSE](./LICENSE) for details.

---

**Built for:**
- Claude Code
- Cursor
- Cline
- GitHub Copilot
- Any AI coding assistant supporting the Vercel Skills format

**Token-optimal. Production-ready. Design-authority-driven.**
