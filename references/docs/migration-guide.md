# Migrating to UI Forge v3

## Overview

UI Forge v3 introduces a new design architecture system with improved extensibility and platform independence. This guide will help you migrate from v2 to v3.

## What Changed

### 1. Design Files Location

**Old (v2):** `.agentic/design-arch.json`
**New (v3):** `design/design-arch.json`

**Why?** The `.agentic/` directory is specific to Claude Code CLI, but skills can be installed in different platforms (`.claude/`, `.cursor/`, etc.). Using `./design/` is platform-agnostic and more discoverable.

### 2. design-arch.json Schema Changes

#### componentLib: String → Array

**Old (v2):**
```json
{
  "componentLib": "@stackshift-ui"
}
```

**New (v3):**
```json
{
  "componentLib": [
    "./components",
    "./components/ui",
    "./app/_components"
  ]
}
```

UI Forge now automatically discovers all component directories in your project, not just the package name.

#### componentStandard → designStandards

**Old (v2):**
```json
{
  "componentStandard": "./docs/component-standard.md"
}
```

**New (v3):**
```json
{
  "designStandards": {
    "stackshiftComponentStandard": "./design/standards/stackshift-ui.md",
    "customBrandingStandard": "./design/standards/branding.md"
  }
}
```

The new `designStandards` object allows you to define multiple design standards that UI Forge will load before generation.

### 3. New Files

**design/component-usage.json** (NEW)

Tracks where each component is used in your project:

```json
{
  "_generated": "2026-04-08T10:00:00.000Z",
  "components": {
    "Button": {
      "uses": 42,
      "files": [
        "./app/(marketing)/page.tsx",
        "./components/Hero.tsx"
      ]
    }
  }
}
```

This file is generated during scan and helps identify refactoring opportunities. It's lazy-loaded only when needed.

## Breaking Changes

### Path Changes

All design files have moved from `.agentic/` to `design/`:

| Old Path (v2) | New Path (v3) |
|---------------|---------------|
| `.agentic/design-arch.json` | `design/design-arch.json` |
| `.agentic/forge-page-plan.json` | `design/forge-page-plan.json` |
| N/A | `design/component-usage.json` (new) |

### Command Updates

**Old commands (still work but deprecated):**
```bash
node .agentic/ui-forge/scan.js
node .agentic/ui-forge/invoke.js --task "..." --refs ./ref.html
```

**New commands (recommended):**
```bash
node ${CLAUDE_SKILL_DIR}/scripts/scan.js
node ${CLAUDE_SKILL_DIR}/scripts/invoke.js --task "..." --refs ./ref.html
```

## Migration Steps

### Option 1: Fresh Start (Recommended)

Delete old design files and re-scan:

```bash
# Clean up old files
rm -rf .agentic/

# Re-run scan to generate v3 files
node ${CLAUDE_SKILL_DIR}/scripts/scan.js
```

This creates `design/design-arch.json` with the v3 schema.

### Option 2: Manual Migration

If you have customizations in your old design-arch.json:

```bash
# Create design directory
mkdir -p design

# Copy old file
cp .agentic/design-arch.json design/design-arch.json

# Edit design/design-arch.json manually (see schema changes above)

# Re-run scan to update
node ${CLAUDE_SKILL_DIR}/scripts/scan.js
```

The scan script will automatically detect v2 schema and migrate it to v3.

### Option 3: Automatic Migration (Handled by invoke.js)

No action required! When you run `invoke.js`, it automatically detects v2 schema and migrates it in-memory:

- `componentLib` string → array
- `componentStandard` → `designStandards.stackshiftComponentStandard`
- `_v: 2` → `_v: 3`

However, this migration is only in-memory. To persist it, re-run `scan.js`.

## New Features in v3

### 1. Component Directory Discovery

UI Forge now automatically discovers all component directories:

```javascript
// Scans for:
- ./components
- ./components/ui
- ./src/components
- ./app/_components
- ./lib/components

// Includes directories with 3+ component files
```

### 2. Extensible Design Standards

Add multiple design standards to your project:

```bash
# Create standards directory
mkdir -p design/standards

# Add your standards
echo "# StackShift UI Standard..." > design/standards/stackshift-ui.md
echo "# Accessibility Rules..." > design/standards/a11y.md
echo "# Animation Guidelines..." > design/standards/motion.md
```

Edit `design/design-arch.json` to register them:

```json
{
  "designStandards": {
    "stackshiftComponentStandard": "./design/standards/stackshift-ui.md",
    "accessibilityStandard": "./design/standards/a11y.md",
    "animationStandard": "./design/standards/motion.md"
  }
}
```

UI Forge loads all registered standards before generation.

### 3. Component Usage Tracking

The new `design/component-usage.json` file tracks component usage:

```json
{
  "components": {
    "Button": {
      "uses": 42,
      "files": ["./app/page.tsx", "./components/Hero.tsx"]
    }
  }
}
```

**Use cases:**
- Identify over-used components that need optimization
- Find unused components to remove
- Track component adoption across the codebase

### 4. Version Bump

Schema version bumped from `_v: 2` to `_v: 3` for tracking purposes.

## Backward Compatibility

### .agentic/ Still Supported

Old `.agentic/` paths still work but are deprecated:

```bash
# Still works (deprecated)
node .agentic/ui-forge/scan.js

# Recommended
node ${CLAUDE_SKILL_DIR}/scripts/scan.js
```

### Auto-Migration

`invoke.js` automatically migrates v2 → v3 in-memory, so old design-arch.json files continue to work.

### Gitignore

Both directories are ignored:

```gitignore
design/
.agentic/
.claude/
```

This ensures design files aren't committed to version control.

## Troubleshooting

### "design-arch.json not found"

**Cause:** You haven't run scan.js after upgrading.

**Solution:**
```bash
node ${CLAUDE_SKILL_DIR}/scripts/scan.js
```

### "componentLib is not an array"

**Cause:** Old v2 design-arch.json with string `componentLib`.

**Solution:** Re-run scan.js to regenerate with v3 schema:
```bash
node ${CLAUDE_SKILL_DIR}/scripts/scan.js
```

Alternatively, edit `design/design-arch.json` manually:
```json
{
  "_v": 3,
  "componentLib": ["@your-lib"]  // Change from string to array
}
```

### "Design standard not found"

**Cause:** `designStandards` path points to non-existent file.

**Solution:** Verify paths in design-arch.json:
```bash
cat design/design-arch.json | jq '.designStandards'
```

Update paths to match actual file locations.

### Old .agentic/ files still present

**Cause:** Migration didn't clean up old files.

**Solution:** Safe to delete:
```bash
rm -rf .agentic/
```

Re-run scan.js to create new design/ directory.

## Verification

After migration, verify your setup:

```bash
# Check design-arch.json schema version
cat design/design-arch.json | jq '._v'
# Should output: 3

# Check componentLib is an array
cat design/design-arch.json | jq '.componentLib'
# Should output: ["./components", "./components/ui"]

# Check designStandards exists
cat design/design-arch.json | jq '.designStandards'
# Should output: {} or {"key": "path"}

# Verify component-usage.json exists
ls design/component-usage.json
```

## Getting Help

If you encounter issues during migration:

1. Check this guide's troubleshooting section
2. Review [Advanced Usage](./advanced-usage.md) for detailed examples
3. Open an issue at https://github.com/username/ui-forge/issues

## Summary

**Key changes:**
- `.agentic/` → `design/` (platform-agnostic)
- `componentLib` string → array (multi-directory support)
- `componentStandard` → `designStandards` object (extensible)
- New `component-usage.json` for tracking component usage
- Schema version bump: `_v: 2` → `_v: 3`

**Migration:** Re-run `node ${CLAUDE_SKILL_DIR}/scripts/scan.js`

**Backward compatibility:** Old v2 files auto-migrate in-memory
