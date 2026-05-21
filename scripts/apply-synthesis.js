#!/usr/bin/env node
/**
 * ui-forge / apply-synthesis.js
 *
 * Receives synthesis JSON from the session AI, validates it, patches
 * design/design-arch.json with the synthesized patterns, and removes
 * design/.synthesis-request.json.
 *
 * Called by the /forge-scan command after the session AI completes Phase 2
 * synthesis. Works with any AI (Claude, GPT-4o, Gemini, Codex, etc.) —
 * the session AI synthesizes and this script applies the result.
 *
 * Usage:
 *   node scripts/apply-synthesis.js '<json-string>'
 *   echo '<json-string>' | node scripts/apply-synthesis.js
 *
 * Exit codes:
 *   0 — patched successfully
 *   1 — JSON parse error, missing required fields, or read/write error
 *   2 — design-arch.json not found (run scan Phase 1 first)
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PROJECT_ROOT = process.env.FORGE_PROJECT_ROOT ?? process.cwd()
const ARCH_PATH = join(PROJECT_ROOT, 'design', 'design-arch.json')
const REQUEST_PATH = join(PROJECT_ROOT, 'design', '.synthesis-request.json')

// ─── Input reading ────────────────────────────────────────────────────────────

function readInput() {
  // Prefer explicit argument (safest cross-platform)
  if (process.argv[2]) return process.argv[2].trim()

  // Fall back to stdin — readFileSync(0) works on Node ≥ 18, both Unix and Windows
  try {
    return readFileSync(0, 'utf-8').trim()
  } catch {
    return null
  }
}

// ─── Validation ───────────────────────────────────────────────────────────────

const REQUIRED_FIELDS = ['spacing', 'typography', 'colorTokens', 'conventions']

function validate(data) {
  const errors = []
  for (const field of REQUIRED_FIELDS) {
    if (!(field in data)) errors.push(`missing field: "${field}"`)
  }
  if ('conventions' in data && !Array.isArray(data.conventions)) {
    errors.push('"conventions" must be an array')
  }
  return errors
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const raw = readInput()

  if (!raw) {
    process.stderr.write('apply-synthesis: no input — pass JSON as argv[2] or via stdin\n')
    process.exit(1)
  }

  // Strip markdown code fences if the AI wrapped the output
  const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()

  let data
  try {
    data = JSON.parse(cleaned)
  } catch (e) {
    process.stderr.write(`apply-synthesis: JSON parse error — ${e.message}\n`)
    process.stderr.write(`  Input received (first 200 chars): ${cleaned.slice(0, 200)}\n`)
    process.exit(1)
  }

  const errors = validate(data)
  if (errors.length > 0) {
    process.stderr.write('apply-synthesis: invalid synthesis result:\n')
    for (const e of errors) process.stderr.write(`  - ${e}\n`)
    process.exit(1)
  }

  if (!existsSync(ARCH_PATH)) {
    process.stderr.write(`apply-synthesis: design-arch.json not found at ${ARCH_PATH}\n`)
    process.stderr.write('  Run scan Phase 1 first: node scripts/scan.js\n')
    process.exit(2)
  }

  let arch
  try {
    arch = JSON.parse(readFileSync(ARCH_PATH, 'utf-8'))
  } catch (e) {
    process.stderr.write(`apply-synthesis: could not read design-arch.json — ${e.message}\n`)
    process.exit(1)
  }

  // Patch patterns — only overwrite if synthesis returned a real value
  const patterns = { ...(arch.patterns ?? {}) }
  if (data.spacing && data.spacing !== 'unknown') patterns.spacing = data.spacing
  if (data.typography && data.typography !== 'unknown') patterns.typography = data.typography
  if (Array.isArray(data.conventions) && data.conventions.length > 0) {
    patterns.conventions = data.conventions
  }

  // Patch colorTokens — fill only when arch currently has none
  let tailwind = arch.tailwind ? { ...arch.tailwind } : arch.tailwind
  if (tailwind && data.colorTokens && !arch.tailwind?.colorTokens) {
    tailwind = { ...tailwind, colorTokens: data.colorTokens }
  }

  // Patch isStackShift — only upgrade to true, never downgrade an existing true
  const isStackShift = arch.isStackShift || (data.isStackShift === true)

  const updated = {
    ...arch,
    isStackShift,
    ...(tailwind !== undefined ? { tailwind } : {}),
    patterns,
    _synthesized: new Date().toISOString(),
  }

  try {
    writeFileSync(ARCH_PATH, JSON.stringify(updated, null, 2), 'utf-8')
  } catch (e) {
    process.stderr.write(`apply-synthesis: could not write design-arch.json — ${e.message}\n`)
    process.exit(1)
  }

  process.stderr.write(`  synthesis applied → ${ARCH_PATH}\n`)

  // Clean up request file — non-fatal if already gone
  if (existsSync(REQUEST_PATH)) {
    try { unlinkSync(REQUEST_PATH) } catch {}
    process.stderr.write('  synthesis request cleaned up\n')
  }

  process.stdout.write(JSON.stringify({ ok: true }) + '\n')
}

main()
