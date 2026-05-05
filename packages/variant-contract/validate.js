/**
 * @extragraj/variant-contract — programmatic validator
 *
 * Validates a CONVERT_VARIANT output component against its props interface contract.
 * No external dependencies. Works in Node.js ≥ 18 (ESM).
 *
 * Usage:
 *   import { validate } from './validate.js'
 *   const { valid, violations, warnings, meta } = validate(outputSrc, contractSrc)
 */

// ─── Contract parsing ─────────────────────────────────────────────────────────

export function parseInterfaceName(src) {
  const m = src.match(/(?:export\s+)?(?:interface|type)\s+(\w+)/)
  return m ? m[1] : null
}

export function parseContractVersion(src) {
  const m = src.match(/@contract-version\s+(\d+\.\d+\.\d+(?:-[\w.]+)?)/)
  return m ? m[1] : '1.0.0'
}

export function parseProps(src, name) {
  if (!name) return { required: [], optional: [] }
  const hm = src.match(new RegExp(`(?:interface|type)\\s+${name}[^{]*\\{`))
  if (!hm) return { required: [], optional: [] }
  let depth = 0, start = hm.index + hm[0].length, end = start
  for (let i = start - 1; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') { depth--; if (!depth) { end = i; break } }
  }
  const body = src.slice(start, end)
  const req = [], opt = []
  let bd = 0, line = ''
  const flush = () => {
    const m = line.match(/^\s*(\w+)\s*(\??):/)
    if (m) (m[2] === '?' ? opt : req).push(m[1])
    line = ''
  }
  for (const ch of body) {
    if ('({[<'.includes(ch)) { bd++; line += ch }
    else if (')}]>'.includes(ch)) { bd--; line += ch }
    else if (!bd && '\n;,'.includes(ch)) flush()
    else line += ch
  }
  flush()
  return { required: req, optional: opt }
}

// ─── Validator ────────────────────────────────────────────────────────────────

/**
 * @param {string} outputSrc   Generated component source
 * @param {string} contractSrc Props interface source
 * @param {{ pairedMode?: boolean }} [options]
 * @returns {{ valid: boolean, violations: string[], warnings: string[], meta: object }}
 */
export function validate(outputSrc, contractSrc, options = {}) {
  const { pairedMode = false } = options
  const ifaceName = parseInterfaceName(contractSrc)
  const contractVersion = parseContractVersion(contractSrc)
  const { required, optional } = parseProps(contractSrc, ifaceName)

  // In paired (StackShift) mode, one named export matching the default export is required
  // by the Variant Router — resolve that name so we can permit it below.
  const pairedDefaultName = pairedMode
    ? (outputSrc.match(/export\s+default\s+function\s+(\w+)/)?.[1]
      ?? outputSrc.match(/export\s+default\s+(\w+)/)?.[1]
      ?? null)
    : null

  const violations = []
  const warnings = []

  const defCount = (outputSrc.match(/export\s+default\b/g) ?? []).length
  if (!defCount) violations.push('No default export found')
  if (defCount > 1) violations.push(`Multiple default exports (${defCount})`)

  const namedExports = []
  let bm; const nbRe = /export\s*\{([^}]+)\}/g
  while ((bm = nbRe.exec(outputSrc)) !== null)
    bm[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean)
      .forEach(n => {
        if (pairedDefaultName && n === pairedDefaultName) return
        namedExports.push(`export { ${n} }`)
      })
  let dm; const ndRe = /export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g
  while ((dm = ndRe.exec(outputSrc)) !== null) {
    if (dm[1] === ifaceName && /export\s+(?:interface|type)/.test(dm[0]))
      namedExports.push(`redefined contract ${ifaceName}`)
    else namedExports.push(`export ${dm[1]}`)
  }
  if (namedExports.length) violations.push(`Disallowed named exports: ${namedExports.join(', ')}`)

  if (ifaceName && !new RegExp(`import\\s+(?:type\\s+)?\\{[^}]*\\b${ifaceName}\\b[^}]*\\}\\s+from`).test(outputSrc))
    violations.push(`Contract interface "${ifaceName}" not imported`)

  const missing = required.filter(p => !new RegExp(`\\b${p}\\b`).test(outputSrc))
  if (missing.length) violations.push(`Required props not consumed: ${missing.join(', ')}`)

  if (required.length && !/return\s+null\s*[;}\n]/.test(outputSrc) && !/\?\s*null\s*:/.test(outputSrc))
    violations.push('No null fallback — required when required props are absent')

  const badNullCount = (outputSrc.match(/\?\?\s*null\b/g) ?? []).length
  if (badNullCount) warnings.push(`${badNullCount}× \`?? null\` — use \`?? undefined\` for optional props`)

  return {
    valid: violations.length === 0,
    violations,
    warnings,
    meta: { ifaceName, contractVersion, required, optional },
  }
}
