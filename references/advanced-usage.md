# Advanced Usage Guide

This document covers advanced features, programmatic usage, troubleshooting, and integration patterns for UI Forge.

## Config File Usage

### JSON Data Shapes

Use JSON files to define the data structure for config-driven components:

**Example: Pricing tiers**

`pricing-data.json`:
```json
{
  "tiers": [
    {
      "name": "Starter",
      "price": 9,
      "features": ["10 projects", "Basic support", "1GB storage"]
    },
    {
      "name": "Pro",
      "price": 29,
      "features": ["Unlimited projects", "Priority support", "10GB storage", "Advanced analytics"]
    }
  ]
}
```

**Generation:**
```bash
node scripts/invoke.js \
  --task "Build pricing table from config" \
  --refs ./pricing-data.json \
  --output ./components/Pricing.tsx
```

**Result:** Component with proper TypeScript types inferred from JSON shape, map() over data, and project-library components.

### TypeScript Config Files

For complex data shapes, use TypeScript:

`features-config.ts`:
```typescript
export const features = [
  {
    icon: 'Zap',
    title: 'Fast Performance',
    description: 'Optimized for speed',
    metrics: { score: 95, benchmark: 'Lighthouse' }
  },
  {
    icon: 'Shield',
    title: 'Secure by Default',
    description: 'Enterprise-grade security',
    metrics: { score: 100, benchmark: 'OWASP' }
  }
] as const

export type Feature = typeof features[number]
```

**Detection:** File with no JSX return + export statement → classified as config.

**Generation:**
```bash
node scripts/invoke.js \
  --task "Build features grid" \
  --refs ./features-config.ts
```

**Result:** Imports the config, reuses the `Feature` type, maps over data.

## Multiple Reference Files Composition

### Combining HTML + JSON + Image

**Scenario:** Convert HTML structure, apply JSON data, match image design.

```bash
node scripts/invoke.js \
  --task "Build hero section" \
  --refs ./hero.html,./hero-data.json,./hero-mockup.png
```

**What happens:**
1. HTML provides layout structure
2. JSON provides data shape and content
3. Image provides visual design reference (colors, spacing, imagery)
4. All three signals compose: `CONVERT_SECTION` + `CONFIG` + `IMAGE`

**Priority:**
- Layout structure → HTML
- Data shape → JSON (wins over hardcoded HTML values)
- Visual design → Image (wins for colors, spacing adjustments)

### Combining TSX Reference + Project Standards

**Scenario:** Convert component from another library to your project's library.

```bash
node scripts/invoke.js \
  --task "Convert Material UI card to shadcn" \
  --refs ./MaterialCard.tsx
```

**What happens:**
1. Reads TSX reference (Material UI imports and components)
2. Loads `design-arch.json` (detects shadcn/ui as project library)
3. Loads component standard doc (if present)
4. Maps Material UI → shadcn/ui equivalents
5. Documents all swaps in FORGE NOTES

**Example mapping:**
```tsx
// Reference:
import { Card, CardContent } from '@mui/material'
<Card variant="outlined">
  <CardContent>...</CardContent>
</Card>

// Generated:
import { Card, CardContent } from '@/components/ui/card'
<Card className="border">
  <CardContent>...</CardContent>
</Card>
```

## Custom Styling Token Mapping

### Tailwind Token Overrides

UI Forge maps reference styles to your Tailwind theme, but you can override:

**Explicit color overrides in task:**
```bash
node scripts/invoke.js \
  --task "Convert hero with bg-gradient-to-r from-purple-500 to-pink-500" \
  --refs ./hero.html
```

**Result:** Uses your explicit colors instead of mapping to theme.

### Custom Spacing Scales

If your project uses a custom spacing scale:

`tailwind.config.js`:
```javascript
module.exports = {
  theme: {
    spacing: {
      'xs': '0.5rem',
      'sm': '1rem',
      'md': '1.5rem',
      'lg': '2rem',
      'xl': '3rem'
    }
  }
}
```

**Re-scan to pick up changes:**
```bash
node scripts/scan.js
```

UI Forge will now map numeric spacing to your custom scale.

### Global CSS Integration

If you have global overrides in `globals.css`:

```css
@layer base {
  h1 {
    @apply text-4xl font-bold tracking-tight;
  }
}
```

UI Forge reads this (excerpt in design-arch.json) and prefers semantic HTML tags over explicit utility classes when your globals provide styling.

## Troubleshooting Common Errors

### Error: "design-arch.json not found"

**Cause:** First time running, or file was deleted.

**Solution:**
```bash
node scripts/scan.js
```

### Error: "Reference file not found"

**Cause:** Incorrect path or relative vs absolute path issue.

**Solution:** Use relative paths from current directory:
```bash
# Wrong:
--refs hero.html

# Right (if in parent directory):
--refs ./templates/hero.html
```

### Warning: "No component library detected"

**Cause:** Project doesn't use a recognized component library.

**Effect:** UI Forge will still work, but won't swap library components (generates vanilla JSX).

**Solution (optional):**
1. Install a component library (shadcn/ui, Radix, etc.)
2. Use it in at least one existing component
3. Re-run `node scripts/scan.js`

### Error: "Plan file exists but refs don't match"

**Cause:** Running Stage 2 with different --refs than Stage 1.

**Solution:** Delete the plan and start over:
```bash
rm design/forge-page-plan.json
node scripts/invoke.js --task "Convert page" --refs ./page.html
```

### Generated component has type errors

**Cause:** UI Forge couldn't find existing types to reuse.

**Solution:**
1. Check FORGE NOTES for flagged type issues
2. Create proper type definitions in your project
3. Re-run generation
4. Or manually fix generated types

### Token mapping seems wrong

**Cause:** design-arch.json is stale (theme changed but scan didn't re-run).

**Solution:**
```bash
node scripts/scan.js  # Refresh design authority
```

## Integration with Workflow Skills

### Chaining with Other Skills

UI Forge can be part of a larger workflow:

**Example: Design handoff workflow**

1. Receive Figma export (HTML + images)
2. Run UI Forge to convert to components
3. Run linter/formatter
4. Run tests
5. Create PR

```bash
#!/bin/bash
# Workflow script

# Step 1: Convert components
node scripts/invoke.js \
  --task "Convert landing page" \
  --refs ./figma-export/index.html

# Step 2: Format
npx prettier --write components/**/*.tsx

# Step 3: Lint
npx eslint components/**/*.tsx --fix

# Step 4: Test
npm test

# Step 5: Commit
git add components/
git commit -m "Add components from Figma export"
```

### Skill Composition

UI Forge can be invoked by other skills:

**Example: Component library migration skill**

```yaml
---
name: migrate-mui-to-shadcn
description: Migrates Material UI components to shadcn/ui
---

# Migration Skill

For each MUI component:
1. Extract to temp file
2. Invoke ui-forge with --task "Convert to shadcn"
3. Replace original file
4. Update imports throughout project
```

### CI/CD Integration

**GitHub Actions:**
```yaml
- name: Generate components
  run: |
    node scripts/scan.js
    node scripts/invoke.js --task "Convert hero" --refs ./hero.html
```

## Advanced Signal Patterns

### Custom Signal Addition

To add a new signal (requires editing `references/prompt-patterns.md`):

**Example: Add `+ANIMATION` signal**

1. Add pattern block in `prompt-patterns.md` using the exact format `extractBlock()` parses:

```markdown
## SIGNAL_ANIMATION

**System Addendum:**
\```
Include animation library imports and motion components.
Use framer-motion if present in usedLibraries.
Add animate, initial, and transition props.
\```
```

2. Update detection logic in `scripts/invoke.js` (inside `detectSignals()`, after the `modifiers` array):

```javascript
// Add to modifier detection in detectSignals()
if (task.includes('animate') || task.includes('motion')) {
  signals.modifiers.push('ANIMATION')
}
```

3. Use it:

```bash
node scripts/invoke.js \
  --task "Convert hero with animations" \
  --refs ./hero.html
```

### Combining All Signals

Maximum composition example:

```bash
node scripts/invoke.js \
  --task "Convert animated landing page with config and design mockup" \
  --refs ./landing.html,./data.json,./mockup.png
```

**Signals:** `CONVERT_PAGE` + `CONFIG` + `IMAGE` + `ANIMATION` (if implemented)

**Result:** Two-stage pipeline where each section gets config data, matches image design, and includes animations.

## Performance Optimization

### Caching Strategies

**Design authority caching:**
- `design-arch.json` cached until explicit re-scan
- Typical refresh: weekly or on major theme/library changes
- Manual refresh: `node scripts/scan.js`

**API call optimization:**
- Stage 1 uses Haiku (fast, cheap) for planning
- Stage 2 uses Sonnet (higher quality) for code generation
- Sequential section generation (not parallel) to control token usage

### Token Budget Management

**Monitor token usage:**
- Section generation: ~3000-5000 tokens
- Page planning: ~2000-3000 tokens
- Per-section in Stage 2: ~3000-5000 tokens

**Reduce token usage:**
- Keep reference files focused (extract just the section you need)
- Use excerpts in design-arch.json (not full files)
- Split large pages into multiple runs if needed

### Parallel Generation (Advanced)

For truly independent components, run in parallel:

```bash
# Generate three components in parallel
node scripts/invoke.js --task "Convert hero" --refs ./hero.html &
node scripts/invoke.js --task "Convert features" --refs ./features.html &
node scripts/invoke.js --task "Convert pricing" --refs ./pricing.html &
wait
```

**Caution:** Can be expensive (3x API calls). Only use when components are completely independent.

## Custom Prompt Patterns

### Editing prompt-patterns.md

Located at `references/prompt-patterns.md`. Blocks are parsed by `extractBlock()` in `invoke.js`, which looks for `## SIGNAL_NAME` headings containing fenced `**System Addendum:**` and optionally `**Task Wrapper:**` blocks.

```markdown
## SIGNAL_NAME

**System Addendum:**
\```
Additional instructions appended to the base system prompt.
Can be multiple paragraphs.

Use {DESIGN_ARCH_JSON} to inject the full design authority.
Use {DESIGN_ARCH_EXCERPT} for a compact 8-line summary instead.
\```

**Task Wrapper:** (optional — omit to use default CONVERT_SECTION wrapper)
\```
Custom task template. Must include {USER_TASK}.
\```
```

Design standards are injected automatically into the system prompt when `designStandards` entries exist in `design-arch.json`. They are not available as a template variable.

### Example Custom Pattern

Add a custom pattern for form generation:

```markdown
## SIGNAL_FORM

**System Addendum:**
\```
Generate form using react-hook-form if present in usedLibraries.
Include validation schema using zod.
Add error messages for each field.
Use project's Input, Select, and Button components.
Include submit handler with proper TypeScript types.
\```
```

### Testing Custom Patterns

After editing `prompt-patterns.md`:

```bash
# Test generation with your new pattern
node scripts/invoke.js \
  --task "Build form with validation" \
  --refs ./form-spec.json
```

Check FORGE NOTES to see if your pattern was applied.
