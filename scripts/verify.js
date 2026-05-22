#!/usr/bin/env node
/**
 * ui-forge / verify.js
 *
 * Post-generation verifier: static contract checks + optional Playwright visual check.
 *
 * Static checks (always run):
 *   - Single default export
 *   - No disallowed named exports
 *   - Contract interface imported (not redefined)
 *   - All required props consumed
 *   - null fallback present when required props exist
 *   - No `?? null` for optional props (should be `?? undefined`)
 *
 * Paired mode (detected via .stackshift/installed.json):
 *   - a11yRequired flag surfaced in report; warns if no landmark elements found
 *
 * Visual check (optional — requires `npx playwright install`):
 *   --playwright <url>  Screenshot the component at <url>, saves to forge-screenshots/
 *
 * Exit codes: 0 = pass, 1 = violations, 2 = invocation error
 *
 * Usage:
 *   node scripts/verify.js <output-file> <contract-file>
 *   node scripts/verify.js <output-file> <contract-file> --playwright http://localhost:3000
 */

import { readFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { validate } from '../packages/variant-contract/validate.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = process.cwd()
const STACKSHIFT_MARKER = join(PROJECT_ROOT, '.stackshift', 'installed.json')

const args = process.argv.slice(2)
const positional = args.filter(a => !a.startsWith('--'))
// On Windows, PowerShell expands "$CLAUDE_TOOL_INPUT_file_path" in the hook command
// to an empty string (PS variables use $env:VAR syntax). Fall back to the env var
// directly so the hook works cross-platform.
const outputArg = positional[0] || process.env['CLAUDE_TOOL_INPUT_file_path']
let contractArg = positional[1]
const playwrightIdx = args.indexOf('--playwright')
const playwrightUrl = playwrightIdx !== -1 && args[playwrightIdx + 1] && !args[playwrightIdx + 1].startsWith('--')
  ? args[playwrightIdx + 1] : null
const usePlaywright = playwrightIdx !== -1

if (!outputArg) {
  process.stderr.write(
    'Usage: verify.js <output-file> <contract-file> [--playwright <url>]\n\n' +
    'Options:\n' +
    '  --playwright <url>  Screenshot component at <url> (requires: npx playwright install)\n'
  )
  process.exit(2)
}

// Single-arg mode: invoked by PostToolUse hook with only the written file path.
// Auto-detect contract from a // @contract <path> directive in the first 30 lines of FORGE NOTES.
if (!contractArg) {
  // Silently skip non-TSX files — hook fires on every Write/Edit
  if (!outputArg.endsWith('.tsx')) process.exit(0)
  const candidatePath = resolve(PROJECT_ROOT, outputArg)
  if (!existsSync(candidatePath)) process.exit(0)
  const head = readFileSync(candidatePath, 'utf-8').split('\n').slice(0, 30).join('\n')
  // Silently skip files that are not UI Forge outputs
  if (!head.includes('// FORGE NOTES')) process.exit(0)
  const m = head.match(/\/\/\s*@contract\s+(\S+)/)
  if (!m) {
    process.stderr.write('verify.js: no contract path; add // @contract <path> to FORGE NOTES or pass it explicitly. Skipping.\n')
    process.exit(0)
  }
  contractArg = m[1]
}

const outputPath = resolve(PROJECT_ROOT, outputArg)
const contractPath = resolve(PROJECT_ROOT, contractArg)

if (!existsSync(outputPath)) { process.stderr.write(`Error: output not found — ${outputArg}\n`); process.exit(2) }
if (!existsSync(contractPath)) { process.stderr.write(`Error: contract not found — ${contractArg}\n`); process.exit(2) }

const output = readFileSync(outputPath, 'utf-8')
const contract = readFileSync(contractPath, 'utf-8')

// Detect paired mode — marker file OR design-arch.isStackShift (theme-only install)
let paired = null
let archIsStackShift = false
if (existsSync(STACKSHIFT_MARKER)) {
  try {
    const m = JSON.parse(readFileSync(STACKSHIFT_MARKER, 'utf-8'))
    paired = { version: m.version ?? 'unknown', a11yRequired: m.a11yRequired === true }
  } catch { paired = { version: 'unknown', a11yRequired: false } }
} else {
  const archPath = join(PROJECT_ROOT, 'design', 'design-arch.json')
  if (existsSync(archPath)) {
    try {
      const arch = JSON.parse(readFileSync(archPath, 'utf-8'))
      if (arch.isStackShift === true) {
        archIsStackShift = true
        paired = { version: 'theme-only', a11yRequired: arch.a11yRequired === true }
      }
    } catch {}
  }
}

// ─── Run validator (shared module is stdlib-only and always present) ────────

const result = validate(output, contract, { pairedMode: !!paired })
const violations = [...result.violations]
const warnings = [...result.warnings]
const meta = result.meta

if (paired?.a11yRequired && !/aria-|role=|<(main|header|nav|section|article|aside|footer)\b/.test(output))
  warnings.push('a11yRequired is set — no landmark elements or aria-* detected')

// ─── Playwright visual check ──────────────────────────────────────────────────

let playwrightResult = null
if (usePlaywright) {
  if (!playwrightUrl) {
    warnings.push('--playwright passed without a URL. Usage: --playwright http://localhost:3000')
  } else {
    try {
      const { chromium } = await import('@playwright/test')
      const browser = await chromium.launch()
      const page = await browser.newPage()
      const pageErrors = []
      page.on('pageerror', e => pageErrors.push(e.message))
      await page.goto(playwrightUrl, { waitUntil: 'networkidle', timeout: 15000 })
      const screenshotDir = join(PROJECT_ROOT, 'forge-screenshots')
      if (!existsSync(screenshotDir)) mkdirSync(screenshotDir)
      const outFile = join(screenshotDir, `verify-${Date.now()}.png`)
      await page.screenshot({ path: outFile, fullPage: true })
      await browser.close()
      playwrightResult = { ok: true, file: outFile, errors: pageErrors }
    } catch (e) {
      playwrightResult = { ok: false, error: e.message }
    }
  }
}

// ─── Report ───────────────────────────────────────────────────────────────────

const { ifaceName, contractVersion, required, optional } = meta
const report = [
  'UI Forge — Verification Report',
  `  output:    ${outputArg}`,
  `  contract:  ${contractArg}`,
  `  interface: ${ifaceName ?? '<unparsed>'}`,
  `  version:   ${contractVersion ?? '1.0.0'}`,
  `  required:  ${required?.length ? required.join(', ') : '(none)'}`,
  `  optional:  ${optional?.length ? optional.join(', ') : '(none)'}`,
]
if (paired) {
  const trigger = archIsStackShift ? ' via arch.isStackShift' : ''
  report.push(`  paired:    stackshift ${paired.version}${trigger}${paired.a11yRequired ? ' (a11yRequired)' : ''}`)
}

if (violations.length) {
  report.push('\nCONTRACT CHECK: FAIL')
  violations.forEach(v => report.push(`  ✗ ${v}`))
}
if (warnings.length) {
  report.push('\nWARNINGS')
  warnings.forEach(w => report.push(`  ⚠ ${w}`))
}
if (!violations.length) report.push('\nCONTRACT CHECK: PASS')

if (playwrightResult) {
  report.push('\nVISUAL CHECK')
  if (playwrightResult.ok) {
    report.push(`  ✓ screenshot: ${playwrightResult.file}`)
    if (playwrightResult.errors.length)
      playwrightResult.errors.forEach(e => report.push(`  ⚠ page error: ${e}`))
  } else {
    report.push(`  ✗ ${playwrightResult.error}`)
    report.push('    Install: npx playwright install')
  }
}

process.stdout.write(report.join('\n') + '\n')
process.exit(violations.length ? 1 : 0)
