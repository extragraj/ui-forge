#!/usr/bin/env node
/**
 * ui-forge / validate-contract.js
 *
 * Post-generation contract validator for CONVERT_VARIANT outputs.
 * Heuristic / regex-based (no TypeScript compiler dependency).
 *
 * Checks:
 *   - Output has exactly one default export (the component)
 *   - Output has no disallowed named exports (the contract interface must be
 *     imported, not redefined or re-exported)
 *   - Output imports the contract interface by name
 *   - Every required prop from the contract is destructured or referenced
 *   - `null` fallback is present (the Variant Router invariant)
 *   - `?? undefined` is used for optional props (warns if `?? null` appears)
 *
 * Exit codes:
 *   0 — pass
 *   1 — violations found (prints report to stderr)
 *   2 — invocation error (bad args, missing files)
 *
 * Usage:
 *   node scripts/validate-contract.js <output-tsx-file> <contract-ts-file>
 *   node scripts/validate-contract.js ./components/MyVariant.tsx ./components/types.ts
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

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

// ─── Parse contract ──────────────────────────────────────────────────────────

function parseInterfaceName(src) {
  const m = src.match(/(?:export\s+)?(?:interface|type)\s+(\w+)/)
  return m ? m[1] : null
}

function parseContractVersion(src) {
  const m = src.match(/@contract-version\s+(\d+\.\d+\.\d+(?:-[\w.]+)?)/)
  return m ? m[1] : '1.0.0'
}

// Extract prop names from interface/type body.
// Handles:   propName: Type         and    propName?: Type
function parseRequiredProps(src, interfaceName) {
  if (!interfaceName) return { required: [], optional: [] }

  // Grab body between the first { and matching }
  const headerRe = new RegExp(`(?:interface|type)\\s+${interfaceName}[^{]*\\{`)
  const headerMatch = src.match(headerRe)
  if (!headerMatch) return { required: [], optional: [] }

  let depth = 0
  let start = headerMatch.index + headerMatch[0].length
  let end = start
  for (let i = start - 1; i < src.length; i++) {
    const ch = src[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) { end = i; break }
    }
  }
  const body = src.slice(start, end)

  // Walk body and collect prop declarations at top level only
  // (skip nested object / array / generic type members)
  const required = []
  const optional = []
  let bodyDepth = 0
  let line = ''
  const flushLine = () => {
    // Expect leading identifier followed by optional ? and a colon
    const m = line.match(/^\s*(\w+)\s*(\??):/)
    if (m) {
      const [, name, opt] = m
      if (opt === '?') optional.push(name)
      else required.push(name)
    }
    line = ''
  }
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (ch === '{' || ch === '[' || ch === '(' || ch === '<') { bodyDepth++; line += ch; continue }
    if (ch === '}' || ch === ']' || ch === ')' || ch === '>') { bodyDepth--; line += ch; continue }
    if (bodyDepth === 0 && (ch === '\n' || ch === ';' || ch === ',')) { flushLine(); continue }
    line += ch
  }
  flushLine()
  return { required, optional }
}

// ─── Parse output ────────────────────────────────────────────────────────────

function countDefaultExports(src) {
  const matches = src.match(/export\s+default\b/g)
  return matches ? matches.length : 0
}

function findDisallowedNamedExports(src, contractInterfaceName) {
  // Allowed: no named exports at all (the contract is imported, not re-exported)
  // Collect every `export { ... }` and `export const/function/class/interface/type Name`
  const violations = []

  const namedBlockRe = /export\s*\{([^}]+)\}/g
  let bm
  while ((bm = namedBlockRe.exec(src)) !== null) {
    const names = bm[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean)
    for (const n of names) violations.push(`export { ${n} }`)
  }

  const namedDeclRe = /export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g
  let dm
  while ((dm = namedDeclRe.exec(src)) !== null) {
    // Allow type-only re-export of the contract interface (rare but harmless)
    if (dm[1] === contractInterfaceName && /export\s+(?:interface|type)\s+/.test(dm[0])) {
      violations.push(`redefined contract ${contractInterfaceName}`)
    } else {
      violations.push(`export ${dm[1]}`)
    }
  }
  return violations
}

function importsContract(src, interfaceName) {
  if (!interfaceName) return false
  const importRe = new RegExp(
    `import\\s+(?:type\\s+)?\\{[^}]*\\b${interfaceName}\\b[^}]*\\}\\s+from`
  )
  return importRe.test(src)
}

function missingDestructures(src, requiredProps) {
  const missing = []
  for (const prop of requiredProps) {
    // Match destructure, JSX {prop}, props.prop, etc.
    const re = new RegExp(`\\b${prop}\\b`)
    if (!re.test(src)) missing.push(prop)
  }
  return missing
}

function hasNullFallback(src) {
  // Component returns `null` somewhere — the Variant Router invariant
  return /return\s+null\s*[;}\n]/.test(src) || /\?\s*null\s*:/.test(src)
}

function usesNullForOptional(src) {
  // `?? null` is the wrong fallback for optionals (should be ?? undefined)
  const m = [...src.matchAll(/\?\?\s*null\b/g)]
  return m.length
}

// ─── Run checks ──────────────────────────────────────────────────────────────

const interfaceName = parseInterfaceName(contract)
const contractVersion = parseContractVersion(contract)
const { required, optional } = parseRequiredProps(contract, interfaceName)

const violations = []
const warnings = []

const defaultCount = countDefaultExports(output)
if (defaultCount === 0) violations.push('No default export found')
if (defaultCount > 1) violations.push(`Multiple default exports found (${defaultCount})`)

const namedExports = findDisallowedNamedExports(output, interfaceName)
if (namedExports.length)
  violations.push(`Disallowed named exports: ${namedExports.join(', ')}`)

if (interfaceName && !importsContract(output, interfaceName))
  violations.push(`Contract interface "${interfaceName}" is not imported — must be imported, not redefined`)

const missing = missingDestructures(output, required)
if (missing.length)
  violations.push(`Required props not consumed: ${missing.join(', ')}`)

if (required.length > 0 && !hasNullFallback(output))
  violations.push(`No null fallback found — Variant Router invariant requires \`return null\` when required props are absent`)

const badNullCount = usesNullForOptional(output)
if (badNullCount)
  warnings.push(`Found ${badNullCount} instance(s) of \`?? null\` — use \`?? undefined\` for optional props (per SIGNAL_VARIANT rules)`)

// ─── Report ──────────────────────────────────────────────────────────────────

const report = []
report.push(`UI Forge — Contract Validation`)
report.push(`  output:    ${outputArg}`)
report.push(`  contract:  ${contractArg}`)
report.push(`  interface: ${interfaceName ?? '<unparsed>'}`)
report.push(`  version:   ${contractVersion}`)
report.push(`  required:  ${required.length ? required.join(', ') : '(none)'}`)
report.push(`  optional:  ${optional.length ? optional.join(', ') : '(none)'}`)

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
