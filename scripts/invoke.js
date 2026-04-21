#!/usr/bin/env node
/**
 * ui-forge / invoke.js
 *
 * Pure context-preparation script for Claude Code.
 * Loads design-arch.json, pre-processes reference files, detects signals,
 * and prints structured generation context to stdout.
 *
 * Claude Code reads the output and generates the component directly using
 * its own session — no external dependencies, no network calls.
 *
 * CLI:
 *   node .claude/skills/ui-forge/scripts/invoke.js --task "Convert this hero section" --refs ./hero.html
 *   node .claude/skills/ui-forge/scripts/invoke.js --task "Convert page" --refs ./page.html
 *   node .claude/skills/ui-forge/scripts/invoke.js --task "..." --refs ./mockup.png,./section.tsx
 *   node .claude/skills/ui-forge/scripts/invoke.js --config ./forge-request.json
 *   node .claude/skills/ui-forge/scripts/invoke.js --task "..." --signal CONVERT_VARIANT --refs ./types.ts
 *   node .claude/skills/ui-forge/scripts/invoke.js --task "..." --mode body-only --refs ./types.ts --output ./Variant.tsx
 *
 * Flags:
 *   --task      What to build (required unless --config)
 *   --refs      Comma-separated ref file paths
 *   --output    Target output file path (included in context for Claude to write)
 *   --signal    Force primary signal: CONVERT_SECTION, CONVERT_PAGE, CONVERT_VARIANT
 *   --mode      full (default) or body-only. body-only requires --output to point at an existing file
 *   --a11y      Enable WCAG 2.1 AA enforcement (adds +A11Y modifier)
 *   --creative  Greenfield generation (adds +CREATIVE; standalone-mode only)
 *   --diff      Iterative regeneration — point at an existing file; task describes the delta (adds +DIFF)
 *   --config    Load all params from a JSON file
 *   --rescan    Re-run scan.js before generating
 *   --replan    Force Stage 1 page plan regeneration
 */

import {
  readFileSync, writeFileSync, existsSync, statSync,
} from 'fs'
import { join, resolve, extname, basename, dirname } from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = process.cwd()
const ARCH_PATH = join(PROJECT_ROOT, 'design', 'design-arch.json')
const PLAN_PATH = join(PROJECT_ROOT, 'design', 'forge-page-plan.json')
const STACKSHIFT_MARKER = join(PROJECT_ROOT, '.stackshift', 'installed.json')
const CLAUDE_SKILL_DIR = join(__dirname, '..')
const BUILTIN_STANDARDS_DIR = join(CLAUDE_SKILL_DIR, 'references', 'standards')
const BUILTIN_STANDARD_KEYS = ['typography', 'spacing', 'color', 'a11y']
const DIVIDER = '─'.repeat(60)
const DEFAULT_CONTRACT_VERSION = '1.0.0'
const SUPPORTED_CONTRACT_VERSIONS = ['1.0.0']
const BRAND_NAME_RE = /\b(brand|voice|tone)\b/i

// ─── Preview helpers ──────────────────────────────────────────────────────────

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

function generatePreviewHtml({ task, signals, archCtx, refs, paired, standards }) {
  const sig = `${signals.primary}${signals.modifiers.length ? ' +' + signals.modifiers.join(' +') : ''}`
  const css = [
    'body{font:14px/1.6 monospace;max-width:960px;margin:2em auto;padding:1em;background:#0d1117;color:#c9d1d9}',
    'h1{color:#58a6ff;font-size:1.1rem;margin:.5rem 0}h2{color:#8b949e;font-size:.85rem;margin:1.5rem 0 .4rem}',
    'pre{background:#161b22;padding:.75rem 1rem;overflow:auto;border-radius:6px;font-size:12px;white-space:pre-wrap;word-break:break-word}',
    '.badge{display:inline-block;padding:.15em .5em;border-radius:3px;background:#21262d;color:#79c0ff;font-size:.8rem}',
    '.paired{color:#f0883e;font-size:.85rem}.src{color:#3fb950;font-size:.75rem}',
  ].join('')

  const stdBlocks = standards
    ? Object.entries(standards.standards).map(([k, v]) =>
        `<h2>STANDARD: <code>${escapeHtml(k)}</code> <span class="src">[${escapeHtml(standards.sources?.[k] ?? 'unknown')}]</span></h2><pre>${escapeHtml(v.slice(0, 600))}</pre>`
      ).join('\n')
    : ''

  const refBlocks = refs.filter(r => r.role !== 'image').map(r =>
    `<h2>${escapeHtml(r.role.toUpperCase())} <code>[${escapeHtml(r.path)}]</code></h2><pre>${escapeHtml(r.content ?? '')}</pre>`
  ).join('\n')

  return [
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    `<title>UI Forge Preview</title><style>${css}</style></head><body>`,
    '<h1>UI Forge — Generation Preview</h1>',
    `${paired ? `<p class="paired">Paired mode: stackshift ${escapeHtml(paired.version)}</p>` : ''}`,
    `<h2>Signal</h2><span class="badge">${escapeHtml(sig)}</span>`,
    `<h2>Task</h2><pre>${escapeHtml(task)}</pre>`,
    `<h2>Design Authority</h2><pre>${escapeHtml(archCtx)}</pre>`,
    stdBlocks,
    refBlocks,
    '</body></html>',
  ].join('\n')
}

// ─── Paired mode ──────────────────────────────────────────────────────────────

function detectPairedMode() {
  if (!existsSync(STACKSHIFT_MARKER)) return null
  try {
    const marker = JSON.parse(readFileSync(STACKSHIFT_MARKER, 'utf-8'))
    return {
      installed: true,
      version: marker.version ?? 'unknown',
      a11yRequired: marker.a11yRequired === true,
    }
  } catch {
    return { installed: true, version: 'unknown', a11yRequired: false }
  }
}

// ─── Contract version ─────────────────────────────────────────────────────────

function parseContractVersion(raw) {
  if (!raw) return DEFAULT_CONTRACT_VERSION
  const m = raw.match(/@contract-version\s+(\d+\.\d+\.\d+(?:-[\w.]+)?)/)
  return m ? m[1] : DEFAULT_CONTRACT_VERSION
}

function parseInterfaceName(raw) {
  if (!raw) return null
  const m = raw.match(/(?:export\s+)?(?:interface|type)\s+(\w+)/)
  return m ? m[1] : null
}

// ─── Design architecture ──────────────────────────────────────────────────────

function loadDesignArch() {
  if (!existsSync(ARCH_PATH))
    throw new Error(`design-arch.json not found.\nRun: node ${CLAUDE_SKILL_DIR}/scripts/scan.js`)

  let arch = JSON.parse(readFileSync(ARCH_PATH, 'utf-8'))

  // Auto-migrate v2 → v3
  if (arch._v === 2 || !arch._v) {
    if (typeof arch.componentLib === 'string') {
      arch.componentLib = arch.componentLib ? [arch.componentLib] : ['./components']
    } else if (!arch.componentLib) {
      arch.componentLib = ['./components']
    }
    if (arch.componentStandard) {
      arch.designStandards = { stackshiftComponentStandard: arch.componentStandard }
      delete arch.componentStandard
    }
    if (!arch.designStandards) arch.designStandards = {}
    arch._v = 3
  }

  // Auto-migrate v3 → v4 (additive: darkColorTokens reserved, defaults to undefined)
  if (arch._v === 3) arch._v = 4

  const age = arch._scanned
    ? (Date.now() - new Date(arch._scanned).getTime()) / 86_400_000
    : 999
  if (age > 7)
    process.stderr.write(`Warning: design-arch.json is ${Math.floor(age)} days old. Re-run scan.js if patterns have changed.\n`)
  return arch
}

// Resolution order (last wins per key):
//   1. arch.designStandards  — explicit, includes stackshiftComponentStandard
//   2. PROJECT_ROOT/design/standards/<key>.md — project-local override
//   3. CLAUDE_SKILL_DIR/references/standards/<key>.md — built-in fallback (gap-fill only)
// Opt-out of step 3: pass opts.useBuiltins = false, or set
// arch.designStandards._useBuiltins = false.
function loadDesignStandards(arch, opts = {}) {
  const standards = {}
  const sources = {}  // key → 'arch' | 'project' | 'built-in'

  // Step 1 — explicit arch entries
  const archStandards = arch.designStandards ?? {}
  for (const [key, path] of Object.entries(archStandards)) {
    if (key.startsWith('_')) continue  // skip meta keys like _useBuiltins
    const fullPath = join(PROJECT_ROOT, path)
    if (existsSync(fullPath)) {
      standards[key] = readFileSync(fullPath, 'utf-8')
      sources[key] = 'arch'
    } else {
      process.stderr.write(`Warning: Design standard not found: ${path}\n`)
    }
  }

  // Step 2 — project-local override for standard keys we haven't filled yet
  // (arch entry wins; this is a no-op for keys already present from step 1).
  for (const key of BUILTIN_STANDARD_KEYS) {
    if (standards[key]) continue
    const projectPath = join(PROJECT_ROOT, 'design', 'standards', `${key}.md`)
    if (existsSync(projectPath)) {
      standards[key] = readFileSync(projectPath, 'utf-8')
      sources[key] = 'project'
    }
  }

  // Step 3 — built-in fallback (gap-fill only; non-empty templates only)
  const useBuiltins = opts.useBuiltins !== false && archStandards._useBuiltins !== false
  if (useBuiltins) {
    for (const key of BUILTIN_STANDARD_KEYS) {
      if (standards[key]) continue
      const p = join(BUILTIN_STANDARDS_DIR, `${key}.md`)
      if (!existsSync(p)) continue
      const content = readFileSync(p, 'utf-8')
      if (!isSubstantive(content)) continue  // empty template → skip
      standards[key] = content
      sources[key] = 'built-in'
    }
  }

  if (Object.keys(standards).length === 0) return null
  return { standards, sources }
}

// A standards file is "substantive" if, after stripping comments and blanks,
// it contains at least one non-heading line with real guidance. Empty templates
// that only carry HTML comments or headings are treated as placeholders and
// skipped so they don't inject noise into the generation context.
function isSubstantive(md) {
  const stripped = md
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
  return stripped.length > 0
}

let _archContextCache = null
let _archContextKey = null
function archToContext(arch) {
  // Cache keyed by _scanned timestamp so repeated builders reuse the same
  // serialised context within a single process.
  const key = arch._scanned ?? ''
  if (_archContextKey === key && _archContextCache !== null) return _archContextCache
  const lines = []
  if (arch.componentLib?.length)
    lines.push(`componentLib: ${arch.componentLib.join(', ')}`)
  if (arch.usedComponents?.length)
    lines.push(`usedComponents: ${arch.usedComponents.slice(0, 25).join(', ')}`)
  if (arch.usedLibraries?.length)
    lines.push(`usedLibraries: ${arch.usedLibraries.map(l => l.name).join(', ')}`)
  if (arch.tailwind?.colorTokens)
    lines.push(`colorTokens: ${arch.tailwind.colorTokens}`)
  if (arch.tailwind?.darkColorTokens)
    lines.push(`darkColorTokens: ${arch.tailwind.darkColorTokens}`)
  if (arch.tailwind?.themeSection)
    lines.push(`tailwind.theme:\n${arch.tailwind.themeSection.slice(0, 500)}`)
  if (arch.globalCss) {
    const css = arch.globalCss.trim()
    if (!css.split('\n').every(l => /^\s*(@tailwind|\/\*|\*\/?|$)/.test(l)))
      lines.push(`globalCss:\n${css.slice(0, 300)}`)
  }
  if (arch.patterns?.spacing)    lines.push(`spacing: ${arch.patterns.spacing}`)
  if (arch.patterns?.typography) lines.push(`typography: ${arch.patterns.typography}`)
  if (arch.patterns?.conventions?.length)
    lines.push(`conventions:\n${arch.patterns.conventions.map(c => '- ' + c).join('\n')}`)
  _archContextCache = lines.join('\n')
  _archContextKey = key
  return _archContextCache
}

// ─── Ref pre-processing ───────────────────────────────────────────────────────

function preprocessHtml(raw) {
  const styleBlocks = []
  const styleTagRe = /<style[^>]*>([\s\S]*?)<\/style>/gi
  let m
  while ((m = styleTagRe.exec(raw)) !== null) styleBlocks.push(m[1].trim())

  const inlineStyles = new Set()
  const inlineRe = /style="([^"]{10,})"/g
  while ((m = inlineRe.exec(raw)) !== null && inlineStyles.size < 30)
    inlineStyles.add(m[1])

  let header = ''
  if (styleBlocks.length || inlineStyles.size) {
    const parts = []
    if (styleBlocks.length)
      parts.push(styleBlocks.join('\n').split('\n').slice(0, 50).join('\n'))
    if (inlineStyles.size)
      parts.push('/* inline styles */\n' + [...inlineStyles].join('\n'))
    header = `// EXTRACTED STYLES — for token mapping, do not copy to output\n`
      + parts.join('\n').slice(0, 2000)
      + `\n// END EXTRACTED STYLES\n\n`
  }

  const body = raw
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim().split('\n').slice(0, 200).join('\n')

  return { content: header + body, stylingType: 'html' }
}

function preprocessTsx(raw) {
  let stylingType = 'unknown'
  const sections = []
  const stripped = []

  const cssModuleMatch = raw.match(/import\s+\w+\s+from\s+['"][^'"]+\.module\.css['"]/m)
  if (cssModuleMatch) {
    stylingType = 'css-modules'
    const classKeys = [...new Set([...raw.matchAll(/styles\.(\w+)/g)].map(m => m[1]))]
    sections.push(`// EXTRACTED CLASSNAMES (CSS module — semantic hints only, no values)\n// ${classKeys.join(', ')}`)
  }

  const styledBlocks = [...raw.matchAll(/(?:styled\.\w+|css)`([\s\S]*?)`/g)].map(m => m[1])
  if (styledBlocks.length) {
    stylingType = 'css-in-js'
    sections.push(`// EXTRACTED CSS-IN-JS\n${styledBlocks.slice(0, 8).join('\n---\n').slice(0, 1500)}`)
  }

  const classNames = [...raw.matchAll(/className="([^"]+)"/g)].map(m => m[1])
  if (classNames.length > 3) {
    sections.push(`// EXTRACTED CLASSNAMES (for token mapping)\n${[...new Set(classNames)].slice(0, 30).join('\n')}`)
    if (stylingType === 'unknown') stylingType = 'tailwind'
  }

  const extImports = [...raw.matchAll(/^import .+ from ['"]([^.~@/][^'"]+)['"]/gm)]
    .map(m => m[0]).slice(0, 15)
  if (extImports.length)
    sections.push(`// EXTERNAL IMPORTS (find project equivalents)\n${extImports.join('\n')}`)

  const propsMatch = raw.match(
    /(?:^|\n)(?:export\s+)?(?:interface|type)\s+\w+Props[\s\S]*?(?=\n(?:export|interface|type|const|function|\n))/m
  )
  if (propsMatch)
    sections.push(`// REFERENCE PROPS INTERFACE\n${propsMatch[0].trim()}`)

  const hasState = /useState|useReducer/.test(raw)
  const hasEffects = /useEffect|useLayoutEffect/.test(raw)
  const hasHandlers = /on[A-Z]\w+\s*=\s*(?:async\s*)?\(/.test(raw)
  if (hasState || hasEffects || hasHandlers) {
    stripped.push(
      ...(hasState ? ['useState/useReducer'] : []),
      ...(hasEffects ? ['useEffect'] : []),
      ...(hasHandlers ? ['event handlers'] : []),
    )
    sections.push(`// NOTE: stripped from reference — ${stripped.join(', ')} — replace with project patterns`)
  }

  const returnMatch = raw.match(/return\s*\(\s*([\s\S]*?)\s*\)\s*[;]?\s*\n?}/m)
  if (returnMatch)
    sections.push(`// JSX LAYOUT\n${returnMatch[1]}`)
  else
    sections.push(`// FULL CONTENT (JSX return not isolated)\n${raw}`)

  return {
    content: sections.join('\n\n').split('\n').slice(0, 200).join('\n'),
    stylingType,
    strippedLogic: stripped,
  }
}

function preprocessConfig(raw) {
  const lines = raw.split('\n')
  if (lines.length <= 100) return raw
  return `[condensed: ${lines.length} lines total]\n` + lines.slice(0, 80).join('\n') + '\n...'
}

// ─── Ref file loading + classification ───────────────────────────────────────

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif'])
const CONFIG_NAMES = /constants|config|mock|data|fixture/i

// Cache classified refs within a process (helps CONVERT_PAGE Stage 2 where
// sections may re-trigger preprocessing). Key: fullPath + ':' + mtimeMs.
const _refCache = new Map()

function loadRefs(refs = []) {
  const out = []
  for (const ref of refs) {
    const full = resolve(PROJECT_ROOT, ref)
    if (!existsSync(full)) {
      process.stderr.write(`Warning: ref not found: ${full}\n`)
      continue
    }
    const ext = extname(full).toLowerCase()
    const name = basename(full, ext).toLowerCase()

    // Images are referenced by path — Claude Code reads them directly using its vision capability
    if (IMAGE_EXTS.has(ext)) {
      out.push({ role: 'image', path: ref, ext, fullPath: full })
      continue
    }

    let cacheKey
    try {
      cacheKey = `${full}:${statSync(full).mtimeMs}`
      const cached = _refCache.get(cacheKey)
      if (cached) { out.push({ ...cached, path: ref }); continue }
    } catch { /* fall through to uncached read */ }

    const push = entry => {
      out.push(entry)
      if (cacheKey) _refCache.set(cacheKey, entry)
    }

    const raw = readFileSync(full, 'utf-8')
    const rawLines = raw.split('\n')

    if (ext === '.html') {
      const { content, stylingType } = preprocessHtml(raw)
      push({ role: 'reference', path: ref, ext, content, rawLines, stylingType })
      continue
    }

    if (ext === '.tsx' || ext === '.jsx') {
      const hasJSX = /return\s*\([\s\S]{0,200}<[A-Za-z]/.test(raw)
      if (hasJSX) {
        const { content, stylingType, strippedLogic } = preprocessTsx(raw)
        push({ role: 'reference', path: ref, ext, content, rawLines, stylingType, strippedLogic })
      } else {
        push({ role: 'config', path: ref, ext, content: preprocessConfig(raw), rawLines })
      }
      continue
    }

    if (ext === '.ts' || ext === '.js') {
      const hasJSX = /return\s*\([\s\S]{0,200}<[A-Za-z]/.test(raw)
      const isConfig = CONFIG_NAMES.test(name) || !hasJSX
      if (isConfig) {
        push({ role: 'config', path: ref, ext, content: preprocessConfig(raw), rawLines })
      } else {
        const { content, stylingType, strippedLogic } = preprocessTsx(raw)
        push({ role: 'reference', path: ref, ext, content, rawLines, stylingType, strippedLogic })
      }
      continue
    }

    if (ext === '.json') {
      const role = BRAND_NAME_RE.test(name) ? 'brand' : 'config'
      push({ role, path: ref, ext, content: preprocessConfig(raw), rawLines })
      continue
    }

    if (ext === '.md') {
      const lines = raw.split('\n')
      let content
      if (lines.length <= 150) {
        content = raw
      } else {
        const headings = lines.slice(100).filter(l => /^#{1,4}\s/.test(l)).join('\n')
        content = lines.slice(0, 100).join('\n')
          + (headings ? `\n\n// SECTION HEADINGS (truncated content):\n${headings}` : '\n...')
      }
      const role = BRAND_NAME_RE.test(name) ? 'brand' : 'companion'
      push({ role, path: ref, ext, content, rawLines })
      continue
    }
  }
  return out
}

// ─── Signal detection ─────────────────────────────────────────────────────────

function isInterfaceFile(ref) {
  if (!ref || !ref.content) return false
  const ext = ref.ext?.toLowerCase()
  if (ext !== '.ts' && ext !== '.tsx') return false
  const lines = ref.rawLines ?? ref.content.split('\n')
  if (lines.length > 150) return false
  const raw = lines.join('\n')
  return /(?:export\s+)?(?:interface|type)\s+\w+/.test(raw)
}

function detectSignals(task, classifiedRefs, explicitSignal, opts = {}) {
  const t = task.toLowerCase()
  const byRole = classifiedRefs.reduce((acc, r) => {
    ;(acc[r.role] ??= []).push(r)
    return acc
  }, {})

  const modifiers = [
    ...(byRole.config?.length ? ['CONFIG'] : []),
    ...(byRole.image?.length ? ['IMAGE'] : []),
    ...(byRole.brand?.length || opts.brandStandard ? ['BRAND'] : []),
    ...(opts.a11y ? ['A11Y'] : []),
    ...(opts.creative ? ['CREATIVE'] : []),
    ...(opts.diff ? ['DIFF'] : []),
  ]

  // Explicit --signal override
  if (explicitSignal) {
    const sig = explicitSignal.toUpperCase()
    if (!['CONVERT_SECTION', 'CONVERT_PAGE', 'CONVERT_VARIANT'].includes(sig))
      throw new Error(`Unknown signal: ${explicitSignal}. Valid: CONVERT_SECTION, CONVERT_PAGE, CONVERT_VARIANT`)
    return { primary: sig, modifiers, byRole }
  }

  // Auto-detect CONVERT_VARIANT: exactly one .ts/.tsx file exporting an interface,
  // no HTML/image refs carrying layout, and file ≤150 lines
  const allRefs = classifiedRefs
  const tsRefs = allRefs.filter(r => (r.ext === '.ts' || r.ext === '.tsx') && r.role === 'config')
  const htmlRefs = allRefs.filter(r => r.ext === '.html' && r.role === 'reference')
  const layoutImages = byRole.image ?? []
  const interfaceRef = tsRefs.length === 1 && isInterfaceFile(tsRefs[0]) ? tsRefs[0] : null

  const mainRef = byRole.reference?.[0]
  const isPage = mainRef && (
    t.includes('page') || t.includes('landing') ||
    t.includes('whole ') || t.includes('full page') ||
    (mainRef.rawLines?.length ?? 0) > 400
  )

  // Ambiguity guard (Task 4.2): interface file present but page triggers also fire
  if (interfaceRef && htmlRefs.length === 0 && isPage) {
    process.stderr.write(
      `Error: Ambiguous signal. Refs include a props interface file (suggests CONVERT_VARIANT)\n`
      + `but task/size suggest CONVERT_PAGE. Pass --signal explicitly.\n`
    )
    process.exit(1)
  }

  // Auto-detect variant: single interface file, no HTML layout refs
  if (interfaceRef && htmlRefs.length === 0 && layoutImages.length === 0) {
    return { primary: 'CONVERT_VARIANT', modifiers, byRole }
  }

  return {
    primary: isPage ? 'CONVERT_PAGE' : 'CONVERT_SECTION',
    modifiers,
    byRole,
  }
}

// ─── Pattern loading ──────────────────────────────────────────────────────────

let _patternSrc = null
function getPatternSrc() {
  if (_patternSrc === null) {
    const p = join(__dirname, '..', 'references', 'prompt-patterns.md')
    _patternSrc = existsSync(p) ? readFileSync(p, 'utf-8') : ''
  }
  return _patternSrc
}

const _blockCache = new Map()
function extractBlock(src, name) {
  if (_blockCache.has(name)) return _blockCache.get(name)
  const heading = `## ${name}`
  const start = src.indexOf(heading)
  if (start === -1) return null
  const end = src.indexOf('\n## ', start + heading.length)
  const block = end === -1 ? src.slice(start) : src.slice(start, end)
  const addMatch = block.match(/\*\*System Addendum:\*\*\s*```([\s\S]*?)```/)
  const result = { addendum: addMatch?.[1]?.trim() ?? '' }
  _blockCache.set(name, result)
  return result
}

function loadComposedAddendum(signals) {
  const src = getPatternSrc()
  const baseName = signals.primary === 'CONVERT_VARIANT' ? 'SIGNAL_VARIANT' : 'CONVERT_SECTION'
  const base = extractBlock(src, baseName) ?? { addendum: '' }
  const modAddendums = signals.modifiers
    .map(m => extractBlock(src, `SIGNAL_${m}`)?.addendum)
    .filter(Boolean)
  return [base.addendum, ...modAddendums].filter(Boolean).join('\n\n')
}

// ─── Context output builders ──────────────────────────────────────────────────

function appendStandards(lines, standardsResult) {
  if (!standardsResult) return
  const { standards, sources } = standardsResult
  for (const [key, content] of Object.entries(standards)) {
    if (content.length > 3000)
      process.stderr.write(`ui-forge: Warning — design standard "${key}" truncated to 3000 chars (${content.length} total). Consider splitting into focused sections.\n`)
    const source = sources?.[key] ?? 'arch'
    lines.push('')
    lines.push(`// --- STANDARD: ${key} ---`)
    lines.push(`# source: ${source}`)
    lines.push(content.slice(0, 3000))
  }
}

function buildSectionContext({ task, archCtx, signals, standards, addendum, output, diffSource, verify }) {
  const { byRole } = signals
  const mainRef = byRole.reference?.[0]
  const extraRefs = (byRole.reference ?? []).slice(1)
  if (extraRefs.length > 0)
    process.stderr.write(`ui-forge: ${extraRefs.length + 1} reference files — using "${mainRef.path}" as primary layout reference. Others ignored.\n`)

  const configRef = byRole.config?.[0]
  const imageRefs = byRole.image ?? []
  const companion = byRole.companion?.[0]
  const brandRef = byRole.brand?.[0]

  const lines = []
  lines.push(`=== UI FORGE ===`)
  lines.push(`SIGNAL: CONVERT_SECTION${signals.modifiers.length ? ' +' + signals.modifiers.join(' +') : ''}`)
  lines.push('')
  lines.push('TASK')
  lines.push(task)
  lines.push('')
  lines.push('DESIGN AUTHORITY')
  lines.push(archCtx)
  appendStandards(lines, standards)

  if (mainRef) {
    lines.push('')
    lines.push(`REFERENCE [${mainRef.path}${mainRef.stylingType ? ` — ${mainRef.stylingType}` : ''}]`)
    lines.push(mainRef.content)
  }

  if (configRef) {
    lines.push('')
    lines.push(`CONFIG [${configRef.path}]`)
    lines.push(configRef.content)
  }

  if (brandRef) {
    lines.push('')
    lines.push(`BRAND [${brandRef.path}]`)
    lines.push(brandRef.content)
  }

  if (imageRefs.length) {
    lines.push('')
    lines.push('IMAGES')
    lines.push('Read and analyze each image file below using your vision capability:')
    for (const img of imageRefs)
      lines.push(`  ${img.fullPath}`)
  }

  if (companion) {
    lines.push('')
    lines.push(`COMPANION [${companion.path}]`)
    lines.push(companion.content)
  }

  if (diffSource) {
    lines.push('')
    lines.push(`EXISTING COMPONENT [${diffSource.path}] — base; preserve what the task does not ask to change`)
    lines.push(diffSource.content)
  }

  lines.push('')
  lines.push('GENERATION INSTRUCTIONS')
  lines.push(addendum)
  lines.push('')
  if (output) lines.push(`WRITE OUTPUT TO: ${output}`)
  lines.push('Begin with // FORGE NOTES then raw TSX. No markdown fences. No preamble after FORGE NOTES.')
  lines.push('Multiple files: separate with // --- FILE: relative/path/to/file.tsx')

  if (verify) {
    lines.push('')
    lines.push('VERIFY: After writing the component, self-check and include in FORGE NOTES:')
    lines.push('  // VERIFY: single default export ✓ | no named exports ✓ | null fallback ✓')
  }

  return lines.join('\n')
}

function buildVariantContext({ task, archCtx, signals, standards, addendum, output, mode, paired, verify }) {
  const { byRole } = signals

  // Under CONVERT_VARIANT, the interface file is classified as 'config' by loadRefs
  // (it's a .ts file without JSX). Re-classify it as the contract.
  const allConfigs = byRole.config ?? []
  const interfaceRef = allConfigs.find(r => isInterfaceFile(r))
  const configRef = allConfigs.find(r => r !== interfaceRef)
  const imageRefs = byRole.image ?? []
  const brandRef = byRole.brand?.[0]

  // Parse contract metadata (contract version + interface name)
  const rawInterface = interfaceRef?.rawLines?.join('\n') ?? interfaceRef?.content ?? ''
  const contractVersion = parseContractVersion(rawInterface)
  const interfaceName = parseInterfaceName(rawInterface)
  const versionSupported = SUPPORTED_CONTRACT_VERSIONS.includes(contractVersion)

  if (!versionSupported)
    process.stderr.write(`ui-forge: WARNING — contract version ${contractVersion} not in supported list (${SUPPORTED_CONTRACT_VERSIONS.join(', ')}). Proceeding; AI will note in FORGE NOTES.\n`)

  const lines = []
  lines.push(`=== UI FORGE ===`)
  lines.push(`SIGNAL: CONVERT_VARIANT${signals.modifiers.length ? ' +' + signals.modifiers.join(' +') : ''}`)
  lines.push(`MODE: ${mode}`)
  if (paired) lines.push(`PAIRED: stackshift ${paired.version}`)
  lines.push('')
  lines.push('TASK')
  lines.push(task)
  lines.push('')

  // Standards at highest priority (Task 3)
  appendStandards(lines, standards)

  // Props interface — the contract
  if (interfaceRef) {
    lines.push('')
    lines.push(`CONTRACT [${interfaceRef.path}]`)
    lines.push(`  interface: ${interfaceName ?? '<unparsed>'}`)
    lines.push(`  version: ${contractVersion}${versionSupported ? '' : ' (UNSUPPORTED — see WARNING in stderr)'}`)
    lines.push('')
    lines.push(interfaceRef.content)
  }

  lines.push('')
  lines.push('DESIGN AUTHORITY')
  lines.push(archCtx)

  if (configRef) {
    lines.push('')
    lines.push(`CONFIG [${configRef.path}]`)
    lines.push(configRef.content)
  }

  if (brandRef) {
    lines.push('')
    lines.push(`BRAND [${brandRef.path}]`)
    lines.push(brandRef.content)
  }

  if (imageRefs.length) {
    lines.push('')
    lines.push('IMAGES')
    lines.push('Read and analyze each image file below using your vision capability:')
    for (const img of imageRefs)
      lines.push(`  ${img.fullPath}`)
  }

  lines.push('')
  lines.push('GENERATION INSTRUCTIONS')
  lines.push(addendum)
  lines.push('')

  if (mode === 'body-only') {
    lines.push('MODE: body-only')
    lines.push('The output file already exists. Preserve any existing import statements at the top.')
    lines.push('Preserve any existing export signature skeleton if present.')
    lines.push('Replace only the function body (or insert a complete default-export component if the file is empty but exists).')
    lines.push('Place // FORGE NOTES immediately after the last import statement (or at file top if no imports).')
    lines.push('')
  }

  if (output) lines.push(`WRITE OUTPUT TO: ${output}`)
  lines.push('Begin with // FORGE NOTES then raw TSX. No markdown fences. No preamble after FORGE NOTES.')

  if (verify) {
    lines.push('')
    lines.push('VERIFY: After writing the component, include in FORGE NOTES:')
    lines.push('  // CONTRACT CHECK: PASS  (or FAIL — <reason if failed>)')
    lines.push('  Checks: single default export, no disallowed named exports, interface imported,')
    lines.push('  all required props consumed, null fallback present for required props.')
    if (output && interfaceRef) {
      lines.push(`  Optionally run: node ${CLAUDE_SKILL_DIR}/scripts/verify.js ${output} ${interfaceRef.path}`)
    }
  }

  return lines.join('\n')
}

function buildPageStage1Context({ task, mainRef, archCtx }) {
  const lines = []
  lines.push('=== UI FORGE — PAGE DECOMPOSITION (Stage 1) ===')
  lines.push('')
  lines.push('TASK')
  lines.push(task)
  lines.push('')
  lines.push('DESIGN AUTHORITY (for existingProjectSection detection)')
  lines.push(archCtx)
  lines.push('')
  lines.push('PAGE CONTENT')
  lines.push(mainRef.rawLines.join('\n'))
  lines.push('')
  lines.push('INSTRUCTIONS')
  lines.push('Identify all distinct sections in this page.')
  lines.push('Write the following JSON to: design/forge-page-plan.json')
  lines.push('')
  lines.push('{')
  lines.push(`  "_ref": "${mainRef.path}",`)
  lines.push(`  "_created": "<ISO timestamp>",`)
  lines.push('  "sections": [')
  lines.push('    { "name": "camelCaseName", "type": "typeKey", "lines": [startLine, endLine], "existingProjectSection": false }')
  lines.push('  ]')
  lines.push('}')
  lines.push('')
  lines.push('Valid types: hero, features, testimonials, pricing, callToAction, footer, navbar, faq, stats, team, gallery, contact, other')
  lines.push('Set existingProjectSection: true only if highly confident this section already exists in the project.')
  lines.push('Line numbers must refer to the original file — do not adjust for any stripping or preprocessing.')
  lines.push('')
  lines.push('After writing the file, tell the user to:')
  lines.push('  1. Review design/forge-page-plan.json')
  lines.push('  2. Set existingProjectSection: true on sections they already have')
  lines.push('  3. Re-run the same command to generate the sections (Stage 2 runs automatically)')

  return lines.join('\n')
}

function buildPageStage2Context({ archCtx, signals, standards, addendum, plan, mainRef, outputDir }) {
  const todo = plan.sections.filter(s => !s.existingProjectSection)
  const skipped = plan.sections.length - todo.length

  const lines = []
  lines.push('=== UI FORGE — PAGE GENERATION (Stage 2) ===')
  lines.push(`${todo.length} section(s) to generate${skipped ? `, ${skipped} skipped (existingProjectSection: true)` : ''}`)
  lines.push('')
  lines.push('DESIGN AUTHORITY')
  lines.push(archCtx)
  appendStandards(lines, standards)
  lines.push('')
  lines.push('GENERATION INSTRUCTIONS')
  lines.push(addendum)
  lines.push('Generate each section below in order. Write each to the specified file.')
  lines.push('Each file must begin with // FORGE NOTES then raw TSX. No markdown fences.')

  for (let i = 0; i < todo.length; i++) {
    const section = todo[i]
    const slicedRaw = mainRef.rawLines
      .slice(section.lines[0] - 1, section.lines[1])
      .join('\n')
    const { content: slicedContent, stylingType } = mainRef.ext === '.html'
      ? preprocessHtml(slicedRaw)
      : preprocessTsx(slicedRaw)

    const outPath = outputDir
      ? join(outputDir, `${section.name}.tsx`)
      : `${section.name}.tsx`

    lines.push('')
    lines.push(DIVIDER)
    lines.push(`SECTION ${i + 1}/${todo.length}: ${section.name} (type: ${section.type})`)
    lines.push(`Source lines: ${section.lines[0]}–${section.lines[1]}`)
    lines.push(`WRITE TO: ${outPath}`)
    lines.push('')
    lines.push(`REFERENCE [excerpt — ${stylingType ?? mainRef.ext}]`)
    lines.push(slicedContent)
  }

  return lines.join('\n')
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const argv = process.argv.slice(2)
  const flags = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const k = argv[i].slice(2)
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true'
      flags[k] = v
    }
  }

  let params = { ...flags }
  if (flags.config) {
    Object.assign(params,
      JSON.parse(readFileSync(resolve(PROJECT_ROOT, flags.config), 'utf-8')))
    delete params.config
  }

  if (!params.task) {
    process.stderr.write(`
ui-forge — Next.js component generator for Claude Code

  --task     What to build (required)
  --refs     Comma-separated ref files (HTML, TSX, JSON, image, markdown)
  --output   Target output file path (Claude will write here)
  --signal   Force primary signal: CONVERT_SECTION, CONVERT_PAGE, CONVERT_VARIANT
  --mode     full (default) or body-only (requires --output to point at existing file)
  --a11y     Enable WCAG 2.1 AA enforcement (adds +A11Y modifier)
  --creative Greenfield generation — relax ref requirement (adds +CREATIVE).
             Refused under CONVERT_VARIANT, CONVERT_PAGE, and paired mode.
  --diff     Iterative regeneration. Point at an existing component file;
             the task describes the delta (adds +DIFF). --output defaults to
             the --diff path. Refused with CONVERT_PAGE / CONVERT_VARIANT /
             +CREATIVE.
  --preview  Write forge-preview.html — styled HTML snapshot of the generation
             context. Refused in StackShift-paired mode.
  --verify   Require post-write verification. Adds CONTRACT CHECK requirement to
             FORGE NOTES (CONVERT_VARIANT). Run verify.js separately for full check.
  --validate-input  Pre-flight validate the incoming props interface file before
             generating context. CONVERT_VARIANT only. Fails fast on malformed contract.
  --no-default-standards  Skip built-in fallback standards (arch + project only)
  --config   Load all params from JSON file
  --rescan   Re-run scan.js before generating
  --replan   Force Stage 1 page plan regeneration

First run: node .claude/skills/ui-forge/scripts/scan.js
`)
    process.exit(1)
  }

  if (typeof params.refs === 'string')
    params.refs = params.refs.split(',').map(s => s.trim())

  for (const flag of ['rescan', 'replan', 'a11y', 'creative', 'no-default-standards', 'preview', 'verify', 'validate-input'])
    if (params[flag] === 'true') params[flag] = true
  // Normalise kebab-case flags → camelCase for internal use
  if (params['no-default-standards']) params.noDefaultStandards = true
  const preview = params.preview === true
  const verifyMode = params.verify === true
  const validateInput = params['validate-input'] === true

  if (params.rescan) {
    process.stderr.write('ui-forge: re-scanning project...\n')
    spawnSync('node', [join(__dirname, 'scan.js')], { stdio: 'inherit' })
  }

  const arch = loadDesignArch()
  const paired = detectPairedMode()

  // --preview refused in paired (StackShift) mode
  if (preview && paired) {
    process.stderr.write('Error: --preview is disabled in StackShift-paired mode. Use `next dev` or Sanity Studio section preview.\n')
    process.exit(1)
  }
  const a11yRequired = Boolean(
    params.a11y === true
    || params.a11y === 'true'
    || arch.a11yRequired === true
    || (paired && paired.a11yRequired === true)
  )
  const classifiedRefs = loadRefs(params.refs ?? [])
  const brandStandard = Boolean(arch.designStandards?.brand)
  const creative = params.creative === true || params.creative === 'true'

  // Resolve --diff: load the existing file and default --output to its path
  let diffSource = null
  if (params.diff && params.diff !== 'true') {
    const diffFull = resolve(PROJECT_ROOT, params.diff)
    if (!existsSync(diffFull))
      throw new Error(`--diff file not found: ${params.diff}`)
    diffSource = { path: params.diff, content: readFileSync(diffFull, 'utf-8') }
    if (!params.output) params.output = params.diff
  } else if (params.diff === 'true') {
    throw new Error('--diff requires a path to an existing file (e.g. --diff ./components/Hero.tsx).')
  }

  const signals = detectSignals(params.task, classifiedRefs, params.signal, {
    a11y: a11yRequired, creative, brandStandard, diff: Boolean(diffSource),
  })

  // --validate-input: pre-flight check on incoming contract file (CONVERT_VARIANT only)
  if (validateInput) {
    if (signals.primary !== 'CONVERT_VARIANT') {
      process.stderr.write('Error: --validate-input requires CONVERT_VARIANT mode.\n')
      process.exit(1)
    }
    const contractRef = classifiedRefs.find(r => isInterfaceFile(r))
    if (!contractRef) {
      process.stderr.write('Error: --validate-input: no valid props interface found in --refs.\n')
      process.exit(1)
    }
    const rawIface = contractRef.rawLines?.join('\n') ?? contractRef.content
    const ifaceNameCheck = parseInterfaceName(rawIface)
    if (!ifaceNameCheck) {
      process.stderr.write(`Error: --validate-input: could not extract interface name from ${contractRef.path}.\n`)
      process.exit(1)
    }
    process.stderr.write(`ui-forge: input validation passed — interface: ${ifaceNameCheck} (${contractRef.path})\n`)
  }

  const standards = loadDesignStandards(arch, { useBuiltins: !params.noDefaultStandards })
  const archCtx = archToContext(arch)

  if (paired)
    process.stderr.write(`ui-forge: paired-mode detected (stackshift ${paired.version})\n`)

  // +CREATIVE refusal — contract/page always wins over creative latitude
  if (signals.modifiers.includes('CREATIVE')) {
    if (signals.primary === 'CONVERT_VARIANT') {
      process.stderr.write('Error: +CREATIVE is incompatible with CONVERT_VARIANT — contract compliance always wins.\n')
      process.exit(1)
    }
    if (signals.primary === 'CONVERT_PAGE') {
      process.stderr.write('Error: +CREATIVE requires CONVERT_SECTION. Pass --signal CONVERT_SECTION or remove the layout ref.\n')
      process.exit(1)
    }
    if (paired) {
      process.stderr.write('Error: +CREATIVE is refused in paired (StackShift) mode — a contract is always supplied.\n')
      process.exit(1)
    }
  }

  // +DIFF refusal — iterative mode only composes with CONVERT_SECTION
  if (signals.modifiers.includes('DIFF')) {
    if (signals.primary === 'CONVERT_VARIANT') {
      process.stderr.write('Error: +DIFF is incompatible with CONVERT_VARIANT — use --mode body-only for contract-level iteration.\n')
      process.exit(1)
    }
    if (signals.primary === 'CONVERT_PAGE') {
      process.stderr.write('Error: +DIFF requires CONVERT_SECTION. Page generation is two-stage; iterate sections one at a time.\n')
      process.exit(1)
    }
    if (signals.modifiers.includes('CREATIVE')) {
      process.stderr.write('Error: +DIFF is incompatible with +CREATIVE — surgical iteration vs. greenfield generation.\n')
      process.exit(1)
    }
  }

  // Resolve mode: body-only is the default under CONVERT_VARIANT
  let mode = params.mode ?? (signals.primary === 'CONVERT_VARIANT' ? 'body-only' : 'full')
  if (mode !== 'full' && mode !== 'body-only')
    throw new Error(`Unknown mode: ${mode}. Valid: full, body-only`)

  // Validate body-only requirements
  if (mode === 'body-only') {
    if (!params.output)
      throw new Error('--mode body-only requires --output to specify the target file.')
    const outputFull = resolve(PROJECT_ROOT, params.output)
    if (!existsSync(outputFull))
      throw new Error(`--mode body-only requires --output to point at an existing file, but "${params.output}" does not exist.`)
  }

  // ── CONVERT_VARIANT ─────────────────────────────────────────────────────────
  if (signals.primary === 'CONVERT_VARIANT') {
    const addendum = loadComposedAddendum(signals)
    process.stderr.write(`ui-forge: CONVERT_VARIANT${signals.modifiers.length ? ' +' + signals.modifiers.join(' +') : ''} [mode: ${mode}]\n`)

    const variantCtx = buildVariantContext({
      task: params.task,
      archCtx,
      signals,
      standards,
      addendum,
      output: params.output,
      mode,
      paired,
      verify: verifyMode,
    })
    process.stdout.write(variantCtx + '\n')

    if (preview) {
      const previewPath = join(PROJECT_ROOT, 'forge-preview.html')
      writeFileSync(previewPath, generatePreviewHtml({ task: params.task, signals, archCtx, refs: classifiedRefs, paired, standards }), 'utf-8')
      process.stderr.write(`ui-forge: preview written → ${previewPath}\n`)
    }
    return
  }

  // ── CONVERT_PAGE ────────────────────────────────────────────────────────────
  if (signals.primary === 'CONVERT_PAGE') {
    const mainRef = signals.byRole.reference?.[0]
    if (!mainRef) throw new Error('CONVERT_PAGE requires a layout reference file')

    // Stage 2 — plan file exists
    if (existsSync(PLAN_PATH) && !params.replan) {
      const plan = JSON.parse(readFileSync(PLAN_PATH, 'utf-8'))
      if (plan._ref && plan._ref !== mainRef.path)
        process.stderr.write(`ui-forge: WARNING — plan was created for "${plan._ref}" but current ref is "${mainRef.path}".\nPass --replan to regenerate the plan for the current file.\n`)

      const todo = plan.sections.filter(s => !s.existingProjectSection)
      const skipped = plan.sections.length - todo.length
      process.stderr.write(`ui-forge: Stage 2 — ${todo.length} section(s) to generate${skipped ? `, ${skipped} skipped` : ''}.\n`)

      const addendum = loadComposedAddendum({ ...signals, primary: 'CONVERT_SECTION' })
      const outputDir = params.output ? dirname(resolve(PROJECT_ROOT, params.output)) : null

      process.stdout.write(buildPageStage2Context({
        archCtx, signals, standards, addendum, plan, mainRef, outputDir,
      }) + '\n')

      if (preview) {
        const previewPath = join(PROJECT_ROOT, 'forge-preview.html')
        writeFileSync(previewPath, generatePreviewHtml({ task: params.task, signals, archCtx, refs: classifiedRefs, paired, standards }), 'utf-8')
        process.stderr.write(`ui-forge: preview written → ${previewPath}\n`)
      }
      return
    }

    // Stage 1 — no plan yet
    process.stderr.write('ui-forge: Stage 1 — outputting page decomposition context...\n')
    process.stdout.write(buildPageStage1Context({ task: params.task, mainRef, archCtx }) + '\n')
    return
  }

  // ── CONVERT_SECTION ─────────────────────────────────────────────────────────
  const addendum = loadComposedAddendum(signals)
  process.stderr.write(`ui-forge: CONVERT_SECTION${signals.modifiers.length ? ' +' + signals.modifiers.join(' +') : ''}\n`)

  process.stdout.write(buildSectionContext({
    task: params.task,
    archCtx,
    signals,
    standards,
    addendum,
    output: params.output,
    diffSource,
    verify: verifyMode,
  }) + '\n')

  if (preview) {
    const previewPath = join(PROJECT_ROOT, 'forge-preview.html')
    writeFileSync(previewPath, generatePreviewHtml({ task: params.task, signals, archCtx, refs: classifiedRefs, paired, standards }), 'utf-8')
    process.stderr.write(`ui-forge: preview written → ${previewPath}\n`)
  }
}

main()
