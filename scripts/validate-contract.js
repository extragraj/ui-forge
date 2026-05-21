#!/usr/bin/env node
/**
 * ui-forge / validate-contract.js
 *
 * CLI wrapper around packages/variant-contract/validate.js — the shared,
 * stdlib-only contract validator. Use this for direct CLI verification of a
 * CONVERT_VARIANT output against its props interface.
 *
 * Exit codes:
 *   0 — pass
 *   1 — violations found (prints report to stdout, exit 1)
 *   2 — invocation error (bad args, missing files)
 *
 * Usage:
 *   node scripts/validate-contract.js <output-tsx-file> <contract-ts-file>
 *   node scripts/validate-contract.js ./components/MyVariant.tsx ./components/types.ts
 *
 * Paired-mode detection:
 *   - .stackshift/installed.json present, OR
 *   - design/design-arch.json has isStackShift: true
 *
 * In paired mode the validator runs additional variant-body rule checks
 * (no raw HTML primitives, no !important, no import React, etc.) on top
 * of the standard contract checks.
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { validate } from '../packages/variant-contract/validate.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const STACKSHIFT_MARKER = join(process.cwd(), '.stackshift', 'installed.json')
const DESIGN_ARCH = join(process.cwd(), 'design', 'design-arch.json')

const [, , outputArg, contractArg] = process.argv

if (!outputArg || !contractArg) {
  process.stderr.write('Usage: validate-contract.js <output-file> <contract-file>\n')
  process.exit(2)
}

const outputPath = resolve(process.cwd(), outputArg)
const contractPath = resolve(process.cwd(), contractArg)

if (!existsSync(outputPath)) {
  process.stderr.write(`Error: output file not found — ${outputArg}\n`)
  process.exit(2)
}
if (!existsSync(contractPath)) {
  process.stderr.write(`Error: contract file not found — ${contractArg}\n`)
  process.exit(2)
}

const output = readFileSync(outputPath, 'utf-8')
const contract = readFileSync(contractPath, 'utf-8')

// Paired-mode detection — marker file OR arch.isStackShift
let pairedMode = existsSync(STACKSHIFT_MARKER)
let archIsStackShift = false
if (!pairedMode && existsSync(DESIGN_ARCH)) {
  try {
    const arch = JSON.parse(readFileSync(DESIGN_ARCH, 'utf-8'))
    if (arch.isStackShift === true) {
      pairedMode = true
      archIsStackShift = true
    }
  } catch {}
}

const result = validate(output, contract, { pairedMode })
const { violations, warnings, meta } = result

// Resolve paired-mode default-export name (for report display)
let pairedDefaultName = null
if (pairedMode) {
  pairedDefaultName =
    output.match(/export\s+default\s+function\s+(\w+)/)?.[1] ??
    output.match(/export\s+default\s+(\w+)/)?.[1] ??
    null
}

const report = []
report.push(`UI Forge — Contract Validation`)
report.push(`  output:    ${outputArg}`)
report.push(`  contract:  ${contractArg}`)
report.push(`  interface: ${meta.ifaceName ?? '<unparsed>'}`)
report.push(`  version:   ${meta.contractVersion}`)
report.push(`  required:  ${meta.required.length ? meta.required.join(', ') : '(none)'}`)
report.push(`  optional:  ${meta.optional.length ? meta.optional.join(', ') : '(none)'}`)
if (pairedMode) {
  const trigger = archIsStackShift ? 'arch.isStackShift' : 'marker file'
  const namedNote = pairedDefaultName ? ` (named export "${pairedDefaultName}" permitted)` : ''
  report.push(`  paired:    stackshift via ${trigger}${namedNote}`)
}

if (violations.length) {
  report.push('')
  report.push('CONTRACT CHECK: FAIL')
  for (const v of violations) report.push(`  ✗ ${v}`)
}
if (warnings.length) {
  report.push('')
  report.push('WARNINGS')
  for (const w of warnings) report.push(`  ⚠ ${w}`)
}
if (!violations.length && !warnings.length) {
  report.push('')
  report.push('CONTRACT CHECK: PASS')
}

process.stdout.write(report.join('\n') + '\n')
process.exit(violations.length ? 1 : 0)
