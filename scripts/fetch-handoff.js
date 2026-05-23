#!/usr/bin/env node
/**
 * ui-forge / fetch-handoff.js
 *
 * Fetches a Claude Design handoff URL and materializes it as local ref files.
 * Invoked by invoke.js when --handoff <url> is passed; can also be run standalone.
 *
 * Usage:
 *   node scripts/fetch-handoff.js <handoff-url> <out-dir>
 *
 * Outputs (whichever the response contains):
 *   <out-dir>/design.html   — layout reference (HTML branch or JSON manifest.html)
 *   <out-dir>/README.md     — design task summary (JSON manifest.readme)
 *   <out-dir>/tokens.json   — design tokens (JSON manifest.tokens)
 *   <out-dir>/manifest.json — raw manifest (JSON branch, full dump)
 *
 * Auth: Claude Design handoff URLs carry the capability token in the path segment
 * (the long random ID), so no ANTHROPIC_API_KEY is required. If a real URL
 * discovery run shows this assumption is wrong, add auth headers here.
 *
 * See references/docs/claude-design-handoff-format.md for API shape notes.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [, , url, outDir] = process.argv
if (!url || !outDir) {
  process.stderr.write('Usage: fetch-handoff.js <handoff-url> <out-dir>\n')
  process.exit(2)
}

if (!url.startsWith('http://') && !url.startsWith('https://')) {
  process.stderr.write(`fetch-handoff: invalid URL — must start with http:// or https://\n  got: ${url}\n`)
  process.exit(2)
}

process.stderr.write(`ui-forge: fetching Claude Design handoff from ${url}\n`)

let res
try {
  res = await fetch(url, {
    headers: { 'User-Agent': 'ui-forge/0.1.9' },
  })
} catch (e) {
  process.stderr.write(`fetch-handoff: network error — ${e.message}\n`)
  process.exit(1)
}

if (!res.ok) {
  process.stderr.write(`fetch-handoff: ${res.status} ${res.statusText} — ${url}\n`)
  if (res.status === 401 || res.status === 403) {
    process.stderr.write('  Hint: Claude Design handoff URLs may require your claude.ai session.\n')
    process.stderr.write('  Download the handoff HTML manually and pass it as --refs instead.\n')
  }
  process.exit(1)
}

const ctype = res.headers.get('content-type') ?? ''
mkdirSync(outDir, { recursive: true })

if (ctype.includes('application/json')) {
  // Branch A: JSON manifest (may contain html, tokens, readme fields)
  const manifest = await res.json()
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
  if (manifest.html)   writeFileSync(join(outDir, 'design.html'), manifest.html)
  if (manifest.readme) writeFileSync(join(outDir, 'README.md'), manifest.readme)
  if (manifest.tokens) writeFileSync(join(outDir, 'tokens.json'), JSON.stringify(manifest.tokens, null, 2))
  process.stderr.write(`ui-forge: handoff materialized → ${outDir}\n`)

} else if (ctype.includes('text/html')) {
  // Branch B: raw HTML
  writeFileSync(join(outDir, 'design.html'), await res.text())
  process.stderr.write(`ui-forge: handoff materialized → ${outDir}/design.html\n`)

} else if (ctype.includes('application/zip')) {
  // Branch C: zip — not yet supported (no built-in unzipper in Node stdlib)
  process.stderr.write('fetch-handoff: zip handoffs are not yet supported.\n')
  process.stderr.write('  Download the handoff manually, extract, and pass the HTML as --refs.\n')
  process.exit(1)

} else {
  process.stderr.write(`fetch-handoff: unexpected content-type: ${ctype}\n`)
  process.stderr.write(`  URL: ${url}\n`)
  process.stderr.write('  If the handoff requires a claude.ai session, download it manually.\n')
  process.exit(1)
}

// Print the out-dir on stdout so invoke.js can capture it if needed
process.stdout.write(outDir + '\n')
