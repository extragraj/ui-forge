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

// ─── Paired-mode body rules ───────────────────────────────────────────────────
//
// Strips comments and string/template literals from the source before pattern
// matching to avoid false positives on examples inside FORGE NOTES or string
// constants like `const example = "<h1>"`.

function stripCommentsAndStrings(src) {
  let out = ''
  let i = 0
  const n = src.length
  while (i < n) {
    const ch = src[i]
    const next = src[i + 1]
    // Line comment
    if (ch === '/' && next === '/') {
      while (i < n && src[i] !== '\n') i++
      continue
    }
    // Block comment
    if (ch === '/' && next === '*') {
      i += 2
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++
      i += 2
      continue
    }
    // String literal (single, double, backtick) — preserve length-equivalent placeholder
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch
      out += ch
      i++
      while (i < n) {
        if (src[i] === '\\' && i + 1 < n) { i += 2; continue }
        if (src[i] === quote) { out += ch; i++; break }
        if (src[i] === '\n') out += '\n' // preserve line numbering for multi-line strings
        i++
      }
      continue
    }
    out += ch
    i++
  }
  return out
}

function stripCommentsOnly(src) {
  let out = ''
  let i = 0
  const n = src.length
  while (i < n) {
    const ch = src[i]
    const next = src[i + 1]
    if (ch === '/' && next === '/') {
      while (i < n && src[i] !== '\n') i++
      continue
    }
    if (ch === '/' && next === '*') {
      i += 2
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++
      i += 2
      continue
    }
    // Preserve string literals verbatim (we need their contents for import checks
    // and ?? "fallback" detection — those need to see the string body)
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch
      out += ch
      i++
      while (i < n) {
        if (src[i] === '\\' && i + 1 < n) { out += src[i]; out += src[i + 1]; i += 2; continue }
        out += src[i]
        if (src[i] === quote) { i++; break }
        i++
      }
      continue
    }
    out += ch
    i++
  }
  return out
}

/**
 * @param {string} rawSrc Generated component source
 * @returns {{ violations: string[], warnings: string[] }}
 *
 * Two pre-processed copies:
 *   - noComments: comments removed, string bodies preserved.
 *     Used for import-line checks and ?? "string" fallback detection — both
 *     legitimately need to see string contents.
 *   - stripped: comments AND string bodies removed.
 *     Used for content checks where a substring inside a string literal
 *     would be a false positive (raw HTML in JSX, !important in className,
 *     inline style={{...}}).
 */
export function checkPairedModeBodyRules(rawSrc) {
  const noComments = stripCommentsOnly(rawSrc)
  const stripped = stripCommentsAndStrings(rawSrc)
  const violations = []
  const warnings = []

  // VIOLATIONS

  // Raw HTML primitives for content (JSX check — exclude string literals)
  const rawHtmlRe = /<(h[1-6]|p|button|a|img|section)\b/g
  const rawHtmlMatches = new Set()
  let m
  while ((m = rawHtmlRe.exec(stripped)) !== null) rawHtmlMatches.add(m[1])
  if (rawHtmlMatches.size) {
    violations.push(`paired: raw HTML primitive(s) found — ${[...rawHtmlMatches].map(t => `<${t}>`).join(', ')}; use @stackshift-ui equivalent`)
  }

  // !important — only flag inside className context (string, template, or expression).
  // Use noComments so we can see className string contents; restrict the match window to
  // the attribute value so a general comment-stripped string like
  // `const note = "Avoid !important"` does not trigger.
  if (/className\s*=\s*[{"'`][^>]{0,200}?!important/.test(noComments)) {
    violations.push('paired: `!important` found in className — breaks tailwind-merge override order')
  }

  // import React from "react" — exclude commented-out lines but keep import-line strings
  if (/^\s*import\s+React\s+from\s+["']react["']/m.test(noComments)) {
    violations.push('paired: `import React from "react"` — Next.js 17+ omits the React import')
  }

  // import * as from "@stackshift-ui/..."
  if (/import\s+\*\s+as\s+\w+\s+from\s+["']@stackshift-ui\//.test(noComments)) {
    violations.push('paired: `import * as ... from "@stackshift-ui/..."` — barrel import breaks next/dynamic; import each component from its own package')
  }

  // WARNINGS

  // ?? "fallback string" (content-string fallback) — needs string bodies
  const fallbackStrCount = (noComments.match(/\?\?\s*["'][^"']+["']/g) ?? []).length
  if (fallbackStrCount) {
    warnings.push(`paired: ${fallbackStrCount}x "?? string" fallback found — content must come from Sanity props; use conditional rendering instead`)
  }

  // Inline style={{ ... }} on JSX element
  if (/\sstyle=\{\{/.test(stripped)) {
    warnings.push('paired: inline style={{ ... }} found — bypasses theming + tailwind-merge; use className')
  }

  // Direct next/image or next/link import
  const nextImports = []
  if (/from\s+["']next\/image["']/.test(noComments)) nextImports.push('next/image')
  if (/from\s+["']next\/link["']/.test(noComments)) nextImports.push('next/link')
  if (nextImports.length) {
    warnings.push(`paired: direct import of ${nextImports.join(', ')} — StackShiftUIProvider already wires these; use @stackshift-ui/image and <Button as="link"> instead`)
  }

  // @stackshift-ui/system import in a variant file
  if (/from\s+["']@stackshift-ui\/system["']/.test(noComments)) {
    warnings.push('paired: @stackshift-ui/system imported — that package is for StackShiftUIProvider setup in pages/_app.tsx, not variant files')
  }

  return { violations, warnings }
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

  // Paired-mode body checks (StackShift variant-body hard rules)
  if (pairedMode) {
    const bodyResult = checkPairedModeBodyRules(outputSrc)
    violations.push(...bodyResult.violations)
    warnings.push(...bodyResult.warnings)
  }

  return {
    valid: violations.length === 0,
    violations,
    warnings,
    meta: { ifaceName, contractVersion, required, optional, pairedMode },
  }
}
