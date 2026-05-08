#!/usr/bin/env node
/**
 * ui-forge / verify-standards.js
 *
 * Post-generation compliance check against design standards.
 * Run: node scripts/verify-standards.js output.tsx --standards design/standards/
 *
 * Returns exit code 0 (pass) or 1 (violations found).
 * All output goes to stderr so it does not interfere with forge output.
 *
 * Created as part of Issue 6 (Option E) — provides a safety net for catching
 * design standards violations that the AI may have missed.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const args = process.argv.slice(2)
const filePath = args[0]
const standardsDir = args.indexOf('--standards') !== -1
  ? resolve(process.cwd(), args[args.indexOf('--standards') + 1])
  : null

if (!filePath) {
  process.stderr.write('Usage: node scripts/verify-standards.js <file.tsx> --standards <dir>\n')
  process.exit(1)
}

if (!existsSync(filePath)) {
  process.stderr.write(`verify-standards: file not found: ${filePath}\n`)
  process.exit(1)
}

const content = readFileSync(filePath, 'utf-8')
const violations = []

// ── Check 1: Raw hex colors in classnames (04-color-tokens) ──────────────────
const hexColorRE = /className="[^"]*#[0-9a-f]{3,6}[^"]*"/gi
const hexMatches = content.match(hexColorRE)
if (hexMatches) {
  violations.push(
    `[04-color-tokens] Raw hex color found in className. Use CMS-backed tokens instead.\n` +
    hexMatches.map(m => `  → ${m.slice(0, 80)}...`).join('\n')
  )
}

// ── Check 2: Naked <a> tags without Button as='link' (02-conditional-link) ──
const linkRE = /<a\s[^>]*href=/gi
const linkMatches = content.match(linkRE)
if (linkMatches) {
  violations.push(
    `[02-conditional-link] Naked <a> tag detected. Use Button as='link' or conditionalLink instead.\n` +
    linkMatches.map(m => `  → ${m.slice(0, 80)}...`).join('\n')
  )
}

// ── Check 3: Imports not from @stackshift-ui/* (01-import-rule) ──────────────
// Only fire if the standards directory contains stackshift-ui standards
const hasStackShift = standardsDir && existsSync(join(standardsDir, 'stackshift-ui'))
if (hasStackShift) {
  const importRE = /import\s+.*\s+from\s+['"](?!@stackshift-ui)[^'"]+['"]/g
  const importMatches = content.match(importRE)
  if (importMatches) {
    const nonCompliant = importMatches.filter(imp => {
      // Allow: react, next, next/*, @portabletext/*, cors, local relative imports
      const m = imp.match(/from\s+['"]([^'"]+)['"]/)
      if (!m) return false
      const pkg = m[1]
      return !pkg.startsWith('.') && !pkg.startsWith('/') &&
        !pkg.startsWith('react') && !pkg.startsWith('next') &&
        !pkg.startsWith('@portabletext') && pkg !== 'cors'
    })
    if (nonCompliant.length) {
      violations.push(
        `[01-import-rule] Component imports should use @stackshift-ui/* packages.\n` +
        nonCompliant.map(m => `  → ${m.slice(0, 80)}...`).join('\n')
      )
    }
  }
}

// ── Check 4: Top-level content wrapped in <Section> (06-spacing) ─────────────
const defaultExportRE = /export\s+default\s+function\s+(\w+)/g
let exportMatch
while ((exportMatch = defaultExportRE.exec(content)) !== null) {
  const componentName = exportMatch[1]
  // Check if <Section appears after the export
  const afterExport = content.slice(exportMatch.index)
  const sectionInBody = afterExport.match(/<Section[\s>]/)
  if (!sectionInBody) {
    violations.push(
      `[06-spacing] Component "${componentName}" does not use <Section> wrapper. Wrap top-level content in <Section>.\n`
    )
  }
}

// ── Output ───────────────────────────────────────────────────────────────────
if (violations.length > 0) {
  process.stderr.write(`\n⚠  Design Standards Compliance — ${violations.length} violation(s) found\n`)
  process.stderr.write('─'.repeat(60) + '\n')
  for (const v of violations) {
    process.stderr.write(v + '\n')
  }
  process.exit(1)
} else {
  process.stderr.write('✓ Design standards compliance: all checks passed\n')
  process.exit(0)
}