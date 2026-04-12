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
 *   node ${CLAUDE_SKILL_DIR}/scripts/invoke.js --task "Convert this hero section" --refs ./hero.html
 *   node ${CLAUDE_SKILL_DIR}/scripts/invoke.js --task "Convert page" --refs ./page.html
 *   node ${CLAUDE_SKILL_DIR}/scripts/invoke.js --task "..." --refs ./mockup.png,./section.tsx
 *   node ${CLAUDE_SKILL_DIR}/scripts/invoke.js --config ./forge-request.json
 *   node ${CLAUDE_SKILL_DIR}/scripts/invoke.js --task "..." --rescan
 *   node ${CLAUDE_SKILL_DIR}/scripts/invoke.js --task "..." --replan
 *
 * Flags:
 *   --task      What to build (required unless --config)
 *   --refs      Comma-separated ref file paths
 *   --output    Target output file path (included in context for Claude to write)
 *   --config    Load all params from a JSON file
 *   --rescan    Re-run scan.js before generating
 *   --replan    Force Stage 1 page plan regeneration
 */

import {
  readFileSync, existsSync,
} from 'fs'
import { join, resolve, extname, basename, dirname } from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = process.cwd()
const ARCH_PATH = join(PROJECT_ROOT, 'design', 'design-arch.json')
const PLAN_PATH = join(PROJECT_ROOT, 'design', 'forge-page-plan.json')
const CLAUDE_SKILL_DIR = join(__dirname, '..')
const DIVIDER = '─'.repeat(60)

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

  const age = arch._scanned
    ? (Date.now() - new Date(arch._scanned).getTime()) / 86_400_000
    : 999
  if (age > 7)
    process.stderr.write(`Warning: design-arch.json is ${Math.floor(age)} days old. Re-run scan.js if patterns have changed.\n`)
  return arch
}

function loadDesignStandards(arch) {
  const standards = {}
  if (!arch.designStandards || Object.keys(arch.designStandards).length === 0) return null
  for (const [key, path] of Object.entries(arch.designStandards)) {
    const fullPath = join(PROJECT_ROOT, path)
    if (existsSync(fullPath)) {
      standards[key] = readFileSync(fullPath, 'utf-8')
    } else {
      process.stderr.write(`Warning: Design standard not found: ${path}\n`)
    }
  }
  return Object.keys(standards).length > 0 ? standards : null
}

function archToContext(arch) {
  const lines = []
  if (arch.componentLib?.length)
    lines.push(`componentLib: ${arch.componentLib.join(', ')}`)
  if (arch.usedComponents?.length)
    lines.push(`usedComponents: ${arch.usedComponents.slice(0, 40).join(', ')}`)
  if (arch.usedLibraries?.length)
    lines.push(`usedLibraries: ${arch.usedLibraries.map(l => l.name).join(', ')}`)
  if (arch.tailwind?.colorTokens)
    lines.push(`colorTokens: ${arch.tailwind.colorTokens}`)
  if (arch.tailwind?.themeSection)
    lines.push(`tailwind.theme:\n${arch.tailwind.themeSection.slice(0, 800)}`)
  if (arch.globalCss)
    lines.push(`globalCss:\n${arch.globalCss.slice(0, 500)}`)
  if (arch.patterns?.spacing)    lines.push(`spacing: ${arch.patterns.spacing}`)
  if (arch.patterns?.typography) lines.push(`typography: ${arch.patterns.typography}`)
  if (arch.patterns?.conventions?.length)
    lines.push(`conventions:\n${arch.patterns.conventions.map(c => '- ' + c).join('\n')}`)
  return lines.join('\n')
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

    const raw = readFileSync(full, 'utf-8')
    const rawLines = raw.split('\n')

    if (ext === '.html') {
      const { content, stylingType } = preprocessHtml(raw)
      out.push({ role: 'reference', path: ref, ext, content, rawLines, stylingType })
      continue
    }

    if (ext === '.tsx' || ext === '.jsx') {
      const hasJSX = /return\s*\([\s\S]{0,200}<[A-Za-z]/.test(raw)
      if (hasJSX) {
        const { content, stylingType, strippedLogic } = preprocessTsx(raw)
        out.push({ role: 'reference', path: ref, ext, content, rawLines, stylingType, strippedLogic })
      } else {
        out.push({ role: 'config', path: ref, ext, content: preprocessConfig(raw), rawLines })
      }
      continue
    }

    if (ext === '.ts' || ext === '.js') {
      const hasJSX = /return\s*\([\s\S]{0,200}<[A-Za-z]/.test(raw)
      const isConfig = CONFIG_NAMES.test(name) || !hasJSX
      if (isConfig) {
        out.push({ role: 'config', path: ref, ext, content: preprocessConfig(raw), rawLines })
      } else {
        const { content, stylingType, strippedLogic } = preprocessTsx(raw)
        out.push({ role: 'reference', path: ref, ext, content, rawLines, stylingType, strippedLogic })
      }
      continue
    }

    if (ext === '.json') {
      out.push({ role: 'config', path: ref, ext, content: preprocessConfig(raw), rawLines })
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
      out.push({ role: 'companion', path: ref, ext, content, rawLines })
      continue
    }
  }
  return out
}

// ─── Signal detection ─────────────────────────────────────────────────────────

function detectSignals(task, classifiedRefs) {
  const t = task.toLowerCase()
  const byRole = classifiedRefs.reduce((acc, r) => {
    ;(acc[r.role] ??= []).push(r)
    return acc
  }, {})

  const mainRef = byRole.reference?.[0]
  const isPage = mainRef && (
    t.includes('page') || t.includes('landing') ||
    t.includes('whole ') || t.includes('full page') ||
    (mainRef.rawLines?.length ?? 0) > 400
  )

  return {
    primary: isPage ? 'CONVERT_PAGE' : 'CONVERT_SECTION',
    modifiers: [
      ...(byRole.config?.length ? ['CONFIG'] : []),
      ...(byRole.image?.length ? ['IMAGE'] : []),
    ],
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

function extractBlock(src, name) {
  const heading = `## ${name}`
  const start = src.indexOf(heading)
  if (start === -1) return null
  const end = src.indexOf('\n## ', start + heading.length)
  const block = end === -1 ? src.slice(start) : src.slice(start, end)
  const addMatch = block.match(/\*\*System Addendum:\*\*\s*```([\s\S]*?)```/)
  return { addendum: addMatch?.[1]?.trim() ?? '' }
}

function loadComposedAddendum(signals) {
  const src = getPatternSrc()
  const base = extractBlock(src, 'CONVERT_SECTION') ?? { addendum: '' }
  const modAddendums = signals.modifiers
    .map(m => extractBlock(src, `SIGNAL_${m}`)?.addendum)
    .filter(Boolean)
  return [base.addendum, ...modAddendums].filter(Boolean).join('\n\n')
}

// ─── Context output builders ──────────────────────────────────────────────────

function appendStandards(lines, standards) {
  if (!standards) return
  for (const [key, content] of Object.entries(standards)) {
    if (content.length > 3000)
      process.stderr.write(`ui-forge: Warning — design standard "${key}" truncated to 3000 chars (${content.length} total). Consider splitting into focused sections.\n`)
    lines.push('')
    lines.push(`DESIGN STANDARD (${key})`)
    lines.push(content.slice(0, 3000))
  }
}

function buildSectionContext({ task, archCtx, signals, standards, addendum, output }) {
  const { byRole } = signals
  const mainRef = byRole.reference?.[0]
  const extraRefs = (byRole.reference ?? []).slice(1)
  if (extraRefs.length > 0)
    process.stderr.write(`ui-forge: ${extraRefs.length + 1} reference files — using "${mainRef.path}" as primary layout reference. Others ignored.\n`)

  const configRef = byRole.config?.[0]
  const imageRefs = byRole.image ?? []
  const companion = byRole.companion?.[0]

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

  lines.push('')
  lines.push('GENERATION INSTRUCTIONS')
  lines.push(addendum)
  lines.push('')
  if (output) lines.push(`WRITE OUTPUT TO: ${output}`)
  lines.push('Begin with // FORGE NOTES then raw TSX. No markdown fences. No preamble after FORGE NOTES.')
  lines.push('Multiple files: separate with // --- FILE: relative/path/to/file.tsx')

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
  --config   Load all params from JSON file
  --rescan   Re-run scan.js before generating
  --replan   Force Stage 1 page plan regeneration

First run: node ${CLAUDE_SKILL_DIR}/scripts/scan.js
`)
    process.exit(1)
  }

  if (typeof params.refs === 'string')
    params.refs = params.refs.split(',').map(s => s.trim())

  for (const flag of ['rescan', 'replan'])
    if (params[flag] === 'true') params[flag] = true

  if (params.rescan) {
    process.stderr.write('ui-forge: re-scanning project...\n')
    spawnSync('node', [join(__dirname, 'scan.js')], { stdio: 'inherit' })
  }

  const arch = loadDesignArch()
  const classifiedRefs = loadRefs(params.refs ?? [])
  const signals = detectSignals(params.task, classifiedRefs)
  const standards = loadDesignStandards(arch)
  const archCtx = archToContext(arch)

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
  }) + '\n')
}

main()
