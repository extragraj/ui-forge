#!/usr/bin/env node
/**
 * ui-forge / export-design.js
 *
 * Exports the project's design-arch.json as a Claude Design–ingestible bundle.
 *
 * Usage:
 *   node scripts/export-design.js [out-dir]
 *
 * Default out-dir: design/claude-design-bundle
 *
 * Output layout:
 *   README.md       — human-readable design system summary (entry point)
 *   tokens.json     — Tailwind tokens + dark tokens
 *   components.md   — component inventory with import paths
 *   conventions.md  — spacing, typography, code conventions
 *   globals.css     — global stylesheet excerpt (if present)
 *   standards/      — per-domain design standards (if present)
 *     typography.md
 *     spacing.md
 *     color.md
 *     a11y.md
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'

const PROJECT_ROOT = process.cwd()
const archPath = join(PROJECT_ROOT, 'design', 'design-arch.json')

if (!existsSync(archPath)) {
  process.stderr.write('export-design: design/design-arch.json not found. Run scan.js first.\n')
  process.exit(1)
}

const arch = JSON.parse(readFileSync(archPath, 'utf-8'))
const outDir = process.argv[2] || join(PROJECT_ROOT, 'design', 'claude-design-bundle')
mkdirSync(outDir, { recursive: true })
mkdirSync(join(outDir, 'standards'), { recursive: true })

// ── 1. README.md — summary (entry point for Claude Design) ───────────────────

const projectName = getProjectName()
const componentLibList = (arch.componentLib || []).join(', ') || 'unknown'
const usedLibsList = Object.keys(arch.usedLibraries || {}).join(', ') || 'none detected'
const themeLabel = arch._theme || 'project-specific (no starter applied)'

const readme = `# ${projectName} — Design System

This bundle describes the design tokens, components, and conventions used in this codebase.
Use it to seed Claude Design so prototypes match production from the start.

## Stack
- Component library: ${componentLibList}
- Used libraries: ${usedLibsList}
- Theme: ${themeLabel}

## Files
- \`tokens.json\` — Tailwind color tokens, dark tokens, theme excerpt
- \`components.md\` — every named component imported in this project
- \`conventions.md\` — spacing, typography, and code conventions (AI-synthesized)
- \`globals.css\` — global stylesheet excerpt
- \`standards/*.md\` — per-domain design standards (typography, spacing, color, a11y)

## Quick token reference
${tokenSummary(arch)}
`
writeFileSync(join(outDir, 'README.md'), readme)

// ── 2. tokens.json ────────────────────────────────────────────────────────────

const tokens = {
  tailwind: {
    themeSection: arch.tailwind?.themeSection || null,
    colorTokens: arch.tailwind?.colorTokens || {},
    darkColorTokens: arch.tailwind?.darkColorTokens || null,
  },
  _scanned: arch._scanned,
  _theme: arch._theme || null,
}
writeFileSync(join(outDir, 'tokens.json'), JSON.stringify(tokens, null, 2))

// ── 3. components.md ─────────────────────────────────────────────────────────

const componentLines = (arch.usedComponents || [])
  .map(c => `- \`${c.name || c}\`${c.path ? ` — from \`${c.path}\`` : ''}`)
  .join('\n') || '_(no components detected)_'

const componentsMd = `# Component Inventory

${componentLines}

## Component directories
${(arch.componentLib || []).map(d => `- \`${d}\``).join('\n')}
`
writeFileSync(join(outDir, 'components.md'), componentsMd)

// ── 4. conventions.md ────────────────────────────────────────────────────────

const conventionsMd = `# Conventions

## Spacing
${arch.patterns?.spacing || '_(unknown)_'}

## Typography
${arch.patterns?.typography || '_(unknown)_'}

## Code conventions
${(arch.patterns?.conventions || []).map(c => `- ${c}`).join('\n') || '_(none)_'}
`
writeFileSync(join(outDir, 'conventions.md'), conventionsMd)

// ── 5. globals.css ────────────────────────────────────────────────────────────

if (arch.globalCss) writeFileSync(join(outDir, 'globals.css'), arch.globalCss)

// ── 6. standards/*.md — copy resolved project standards ──────────────────────

const stdSlots = ['typography', 'spacing', 'color', 'a11y']
let copiedStandards = 0
for (const slot of stdSlots) {
  const relPath = arch.designStandards?.[slot]
  if (!relPath) {
    // Fall back to project design/standards/<slot>.md
    const fallback = join(PROJECT_ROOT, 'design', 'standards', `${slot}.md`)
    if (existsSync(fallback)) {
      copyFileSync(fallback, join(outDir, 'standards', `${slot}.md`))
      copiedStandards++
    }
    continue
  }
  const absPath = join(PROJECT_ROOT, relPath)
  if (existsSync(absPath)) {
    copyFileSync(absPath, join(outDir, 'standards', `${slot}.md`))
    copiedStandards++
  }
}

// ── Report ────────────────────────────────────────────────────────────────────

process.stdout.write(`\nUI Forge — Design Export\n`)
process.stdout.write(`  Bundle written to: ${outDir}\n`)
process.stdout.write(`  Files: README.md, tokens.json, components.md, conventions.md`)
if (arch.globalCss) process.stdout.write(', globals.css')
if (copiedStandards) process.stdout.write(`, standards/ (${copiedStandards} file${copiedStandards !== 1 ? 's' : ''})`)
process.stdout.write('\n\n')
process.stdout.write('Next steps:\n')
process.stdout.write('  1. Upload this folder to Claude Design, or\n')
process.stdout.write('  2. Paste README.md into the design-system onboarding step.\n\n')

// ── Helpers ───────────────────────────────────────────────────────────────────

function getProjectName() {
  try {
    const pkg = JSON.parse(readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf-8'))
    return pkg.name || 'project'
  } catch { return 'project' }
}

function tokenSummary(arch) {
  const colorTokens = arch.tailwind?.colorTokens
  let entries = []
  if (typeof colorTokens === 'string' && colorTokens.trim()) {
    // comma-separated token names
    entries = colorTokens.split(',').map(s => s.trim()).filter(Boolean).slice(0, 8).map(k => `- \`${k}\``)
  } else if (colorTokens && typeof colorTokens === 'object') {
    entries = Object.entries(colorTokens).slice(0, 8).map(([k, v]) => `- \`${k}\`: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
  }
  return entries.length ? entries.join('\n') : '_(no tokens detected)_'
}
