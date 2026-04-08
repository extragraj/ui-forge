#!/usr/bin/env node
/**
 * ui-forge / invoke.js
 *
 * Signal-based Next.js TSX component generator.
 * Reads design/design-arch.json as design authority.
 *
 * CLI:
 *   node ${CLAUDE_SKILL_DIR}/scripts/invoke.js --task "Convert this hero section" --refs ./hero.html
 *   node ${CLAUDE_SKILL_DIR}/scripts/invoke.js --task "Convert page" --refs ./page.html,./data.json
 *   node ${CLAUDE_SKILL_DIR}/scripts/invoke.js --task "..." --refs ./mockup.png,./section.tsx
 *   node ${CLAUDE_SKILL_DIR}/scripts/invoke.js --config ./forge-request.json
 *   node ${CLAUDE_SKILL_DIR}/scripts/invoke.js --task "..." --rescan      re-run scan.js first
 *   node ${CLAUDE_SKILL_DIR}/scripts/invoke.js --task "..." --replan      force Stage 1 re-run
 *
 * Flags:
 *   --task      What to build (required unless --config)
 *   --refs      Comma-separated ref file paths
 *   --stream    Stream output to stdout
 *   --output    Write result to file path
 *   --config    Load all params from a JSON file
 *   --rescan    Re-run scan.js before generating
 *   --replan    Force Stage 1 page decomposition even if plan file exists
 *
 * Module:
 *   import { forge } from '${CLAUDE_SKILL_DIR}/scripts/invoke.js'
 *   const result = await forge({ task: '...', refs: ['./ref.html'] })
 */

import {
  readFileSync, writeFileSync, existsSync, mkdirSync,
} from 'fs'
import { join, resolve, extname, basename, dirname } from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = process.cwd()
const ARCH_PATH = join(PROJECT_ROOT, 'design', 'design-arch.json')
const PLAN_PATH = join(PROJECT_ROOT, 'design', 'forge-page-plan.json')
const COMPONENT_USAGE_PATH = join(PROJECT_ROOT, 'design', 'component-usage.json')
const CLAUDE_SKILL_DIR = join(__dirname, '..')
const API_KEY = process.env.ANTHROPIC_API_KEY

// ─── Design architecture ──────────────────────────────────────────────────────

function loadDesignArch() {
  if (!existsSync(ARCH_PATH))
    throw new Error(`design-arch.json not found.\nRun: node ${CLAUDE_SKILL_DIR}/scripts/scan.js`)

  let arch = JSON.parse(readFileSync(ARCH_PATH, 'utf-8'))

  // Auto-migrate v2 → v3
  if (arch._v === 2 || !arch._v) {
    // Migrate componentLib string → array
    if (typeof arch.componentLib === 'string') {
      arch.componentLib = arch.componentLib ? [arch.componentLib] : ['./components']
    } else if (!arch.componentLib) {
      arch.componentLib = ['./components']
    }
    // Migrate componentStandard → designStandards
    if (arch.componentStandard) {
      arch.designStandards = {
        stackshiftComponentStandard: arch.componentStandard
      }
      delete arch.componentStandard
    }
    if (!arch.designStandards) {
      arch.designStandards = {}
    }
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

  if (!arch.designStandards || Object.keys(arch.designStandards).length === 0) {
    return null
  }

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
    lines.push(`componentLib: ${Array.isArray(arch.componentLib) ? arch.componentLib.join(', ') : arch.componentLib}`)
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
  // Extract <style> blocks and inline style="" values for token mapping
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
  const stripped = []  // logic we're removing — logged to FORGE NOTES

  // Detect styling approach and extract tokens
  const cssModuleMatch = raw.match(/import\s+\w+\s+from\s+['"][^'"]+\.module\.css['"]/m)
  if (cssModuleMatch) {
    stylingType = 'css-modules'
    const classKeys = [...new Set([...raw.matchAll(/styles\.(\w+)/g)].map(m => m[1]))]
    sections.push(
      `// EXTRACTED CLASSNAMES (CSS module — semantic hints only, no values)\n// ${classKeys.join(', ')}`
    )
  }

  const styledBlocks = [...raw.matchAll(/(?:styled\.\w+|css)`([\s\S]*?)`/g)].map(m => m[1])
  if (styledBlocks.length) {
    stylingType = 'css-in-js'
    sections.push(
      `// EXTRACTED CSS-IN-JS\n${styledBlocks.slice(0, 8).join('\n---\n').slice(0, 1500)}`
    )
  }

  const classNames = [...raw.matchAll(/className="([^"]+)"/g)].map(m => m[1])
  if (classNames.length > 3 && stylingType === 'unknown') {
    stylingType = 'tailwind'
    sections.push(
      `// EXTRACTED CLASSNAMES (for token mapping)\n${[...new Set(classNames)].slice(0, 30).join('\n')}`
    )
  }

  // External imports (for component swap analysis)
  const extImports = [...raw.matchAll(/^import .+ from ['"]([^.~@/][^'"]+)['"]/gm)]
    .map(m => m[0]).slice(0, 15)
  if (extImports.length)
    sections.push(`// EXTERNAL IMPORTS (find project equivalents)\n${extImports.join('\n')}`)

  // Props interface extraction
  const propsMatch = raw.match(
    /(?:^|\n)(?:export\s+)?(?:interface|type)\s+\w+Props[\s\S]*?(?=\n(?:export|interface|type|const|function|\n))/m
  )
  if (propsMatch)
    sections.push(`// REFERENCE PROPS INTERFACE\n${propsMatch[0].trim()}`)

  // Strip incompatible logic, note what was removed
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

  // JSX layout block
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

function preprocessConfig(raw, ext) {
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

    if (IMAGE_EXTS.has(ext)) {
      const data = readFileSync(full)
      const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
        : ext === '.png' ? 'image/png'
        : ext === '.webp' ? 'image/webp' : 'image/gif'
      out.push({ role: 'image', mime, data: data.toString('base64'), path: ref, ext })
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
        out.push({ role: 'config', path: ref, ext, content: preprocessConfig(raw, ext), rawLines })
      }
      continue
    }

    if (ext === '.ts' || ext === '.js') {
      const hasJSX = /return\s*\([\s\S]{0,200}<[A-Za-z]/.test(raw)
      const isConfig = CONFIG_NAMES.test(name) || !hasJSX
      if (isConfig) {
        out.push({ role: 'config', path: ref, ext, content: preprocessConfig(raw, ext), rawLines })
      } else {
        const { content, stylingType, strippedLogic } = preprocessTsx(raw)
        out.push({ role: 'reference', path: ref, ext, content, rawLines, stylingType, strippedLogic })
      }
      continue
    }

    if (ext === '.json') {
      out.push({ role: 'config', path: ref, ext, content: preprocessConfig(raw, ext), rawLines })
      continue
    }

    if (ext === '.md') {
      const lines = raw.split('\n')
      const content = lines.length <= 150 ? raw : lines.slice(0, 100).join('\n') + '\n...'
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

// ─── Pattern loading + composition ───────────────────────────────────────────

function extractBlock(src, name) {
  const heading = `## ${name}`
  const start = src.indexOf(heading)
  if (start === -1) return null
  const end = src.indexOf('\n## ', start + heading.length)
  const block = end === -1 ? src.slice(start) : src.slice(start, end)
  const addMatch = block.match(/\*\*System Addendum:\*\*\s*```([\s\S]*?)```/)
  const wrapMatch = block.match(/\*\*Task Wrapper:\*\*\s*```([\s\S]*?)```/)
  return {
    addendum: addMatch?.[1]?.trim() ?? '',
    wrapper: wrapMatch?.[1]?.trim() ?? null,
  }
}

function loadComposedPattern(signals) {
  const src = existsSync(join(__dirname, '..', 'references', 'prompt-patterns.md'))
    ? readFileSync(join(__dirname, '..', 'references', 'prompt-patterns.md'), 'utf-8')
    : ''

  // Base always comes from CONVERT_SECTION (even Stage 2 page sections use it)
  const base = extractBlock(src, 'CONVERT_SECTION') ?? { addendum: '', wrapper: '{USER_TASK}' }

  // Append modifier addendums
  const modAddendums = signals.modifiers
    .map(m => extractBlock(src, `SIGNAL_${m}`)?.addendum)
    .filter(Boolean)

  return {
    addendum: [base.addendum, ...modAddendums].filter(Boolean).join('\n\n'),
    wrapper: base.wrapper,
  }
}

// ─── Prompt building ──────────────────────────────────────────────────────────

function buildSystem(arch, addendum, standards) {
  const parts = [
    `You are an expert Next.js TSX engineer generating production-ready component code.

OUTPUT: Begin with // FORGE NOTES comment block, then raw code only.
No markdown fences. No preamble after FORGE NOTES.
Multiple files: separate with // --- FILE: relative/path/to/file.tsx`,
    addendum,
  ]

  // Add all design standards if present
  if (standards && Object.keys(standards).length > 0) {
    for (const [key, content] of Object.entries(standards)) {
      parts.push(`DESIGN STANDARD (${key}):\n${content.slice(0, 3000)}`)
    }
  }

  return parts.filter(Boolean).join('\n\n')
}

function buildMessage(task, wrapper, archCtx, signals) {
  const { byRole } = signals
  const mainRef = byRole.reference?.[0]
  const configRef = byRole.config?.[0]
  const companion = byRole.companion?.[0]
  const imageRefs = byRole.image ?? []

  let msg = (wrapper ?? '{USER_TASK}')
    .replace('{USER_TASK}', task)
    .replace('{DESIGN_ARCH_JSON}', archCtx)
    .replace('{DESIGN_ARCH_EXCERPT}', archCtx.split('\n').slice(0, 8).join('\n'))
    .replace('{REF_CONTENT}', mainRef
      ? `[${mainRef.path}${mainRef.stylingType ? ` — ${mainRef.stylingType}` : ''}]\n${mainRef.content}`
      : '(no layout reference provided)')
    .replace('{CONFIG_CONTENT}', configRef
      ? `Data/config [${configRef.path}]:\n${configRef.content}`
      : '')
    .replace('{IMAGE_NOTE}', imageRefs.length ? '[Reference image provided above]' : '')
    .replace('{COMPANION_CONTENT}', companion ? companion.content : '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (!imageRefs.length) return msg

  return [
    ...imageRefs.map(img => ({
      type: 'image',
      source: { type: 'base64', media_type: img.mime, data: img.data },
    })),
    { type: 'text', text: msg },
  ]
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function callAPI(system, message, stream = false, model = 'claude-sonnet-4-20250514') {
  if (!API_KEY) throw new Error('ANTHROPIC_API_KEY not set')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: model.includes('haiku') ? 512 : 8096,
      system,
      messages: [{ role: 'user', content: message }],
      stream,
    }),
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
  if (!stream) {
    const d = await res.json()
    return d.content.map(b => b.text || '').join('')
  }
  return res
}

async function streamToStdout(res) {
  let full = ''
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const lines = buf.split('\n'); buf = lines.pop()
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const d = line.slice(6).trim()
      if (d === '[DONE]') break
      try {
        const p = JSON.parse(d)
        if (p.type === 'content_block_delta' && p.delta?.text) {
          process.stdout.write(p.delta.text)
          full += p.delta.text
        }
      } catch {}
    }
  }
  process.stdout.write('\n')
  return full
}

// ─── Page pipeline (two-stage) ────────────────────────────────────────────────

// Haiku prompt is hardcoded — it's deterministic JSON extraction, not creative
const PLAN_SYSTEM = `You decompose HTML/TSX pages into distinct sections.
Return a JSON array ONLY. No other text. No markdown.
Format: [{"name":"camelCaseName","type":"typeKey","lines":[startLine,endLine],"existingProjectSection":false}]
Types: hero, features, testimonials, pricing, callToAction, footer, navbar, faq, stats, team, gallery, contact, other
Set existingProjectSection:true only if you are highly confident this section type already exists in the project.`

async function runHaikuPlan(refContent, arch) {
  const userMsg = `Identify all distinct sections in this page.\n\nPage content:\n${refContent.split('\n').slice(0, 600).join('\n')}`
  const raw = await callAPI(PLAN_SYSTEM, userMsg, false, 'claude-haiku-4-5-20251001')
  try {
    const sections = JSON.parse(raw.trim().replace(/```json|```/g, '').trim())
    if (!Array.isArray(sections)) throw new Error('not an array')
    return sections
  } catch {
    throw new Error(`Stage 1 plan parse failed. Raw output:\n${raw}`)
  }
}

async function runPagePipeline(params, arch, classifiedRefs, signals, standard) {
  const mainRef = signals.byRole.reference?.[0]
  if (!mainRef) throw new Error('CONVERT_PAGE requires a layout reference file')

  // Stage 1 — decompose into plan
  let plan
  if (existsSync(PLAN_PATH) && !params.replan) {
    plan = JSON.parse(readFileSync(PLAN_PATH, 'utf-8'))
    process.stderr.write(`ui-forge: using existing page plan (${plan.sections.length} sections). Pass --replan to regenerate.\n`)
  } else {
    process.stderr.write('ui-forge: Stage 1 — decomposing page with Haiku...\n')
    const sections = await runHaikuPlan(mainRef.rawLines.join('\n'), arch)
    plan = { _ref: mainRef.path, _created: new Date().toISOString(), sections }
    if (!existsSync(join(PROJECT_ROOT, 'design')))
      mkdirSync(join(PROJECT_ROOT, 'design'), { recursive: true })
    writeFileSync(PLAN_PATH, JSON.stringify(plan, null, 2), 'utf-8')
    process.stderr.write(`\nPage plan written to design/forge-page-plan.json\n`)
    process.stderr.write(`Review the plan, set existingProjectSection:true to skip sections, then re-run.\n`)
    return JSON.stringify(plan, null, 2)
  }

  // Stage 2 — sequential section generation
  const todo = plan.sections.filter(s => !s.existingProjectSection)
  const skip = plan.sections.length - todo.length
  process.stderr.write(`ui-forge: Stage 2 — ${todo.length} sections to convert${skip ? `, ${skip} skipped` : ''}.\n`)

  const archCtx = archToContext(arch)
  const composed = loadComposedPattern({ ...signals, primary: 'CONVERT_SECTION' })
  const outputs = []

  for (let i = 0; i < todo.length; i++) {
    const section = todo[i]
    process.stderr.write(`  [${i + 1}/${todo.length}] ${section.name} (lines ${section.lines[0]}–${section.lines[1]})...\n`)

    // Extract section slice from raw lines
    const slicedRaw = mainRef.rawLines
      .slice(section.lines[0] - 1, section.lines[1])
      .join('\n')

    // Pre-process the slice the same way as the full ref
    const { content: slicedContent, stylingType } = mainRef.ext === '.html'
      ? preprocessHtml(slicedRaw)
      : preprocessTsx(slicedRaw)

    // Build section-specific signals
    const sectionSignals = {
      primary: 'CONVERT_SECTION',
      modifiers: signals.modifiers,
      byRole: {
        ...signals.byRole,
        reference: [{ ...mainRef, content: slicedContent, stylingType }],
      },
    }

    const task = `Convert section "${section.name}" (type: ${section.type}).`
    const system = buildSystem(arch, composed.addendum, standard)
    const message = buildMessage(task, composed.wrapper, archCtx, sectionSignals)

    // Sequential — extensible to parallel by collecting promises instead
    const result = await callAPI(system, message, false)

    const outPath = params.output
      ? join(dirname(resolve(PROJECT_ROOT, params.output)), `${section.name}.tsx`)
      : null
    if (outPath) writeFileSync(outPath, result, 'utf-8')
    outputs.push({ name: section.name, code: result, outPath })
  }

  process.stderr.write(`\nui-forge: Page conversion complete.\n`)
  return outputs.map(o => `// --- FILE: ${o.name}.tsx\n${o.code}`).join('\n\n')
}

// ─── Section generation (single call) ────────────────────────────────────────

async function runSectionGeneration(task, arch, signals, standard, params) {
  const archCtx = archToContext(arch)
  const composed = loadComposedPattern(signals)
  const system = buildSystem(arch, composed.addendum, standard)
  const message = buildMessage(task, composed.wrapper, archCtx, signals)

  process.stderr.write(`ui-forge: CONVERT_SECTION${signals.modifiers.length ? ` +${signals.modifiers.join(' +')}` : ''}\n`)

  if (params.stream) {
    const res = await callAPI(system, message, true)
    const full = await streamToStdout(res)
    if (params.output) writeFileSync(resolve(PROJECT_ROOT, params.output), full, 'utf-8')
    return full
  }

  const result = await callAPI(system, message, false)
  if (params.output) writeFileSync(resolve(PROJECT_ROOT, params.output), result, 'utf-8')
  return result
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * @param {object}   params
 * @param {string}   params.task      What to build (required)
 * @param {string[]} [params.refs]    Reference file paths
 * @param {boolean}  [params.stream]  Stream to stdout (section only)
 * @param {string}   [params.output]  Write to file path
 * @param {boolean}  [params.rescan]  Re-run scan.js before generating
 * @param {boolean}  [params.replan]  Force Stage 1 page plan regeneration
 * @returns {Promise<string>}
 */
export async function forge(params = {}) {
  if (!params.task) throw new Error('params.task is required')

  if (params.rescan) {
    process.stderr.write('ui-forge: re-scanning project...\n')
    spawnSync('node', [join(__dirname, 'scan.js')], { stdio: 'inherit' })
  }

  const arch = loadDesignArch()
  const classifiedRefs = loadRefs(params.refs ?? [])
  const signals = detectSignals(params.task, classifiedRefs)

  const standards = loadDesignStandards(arch)

  if (signals.primary === 'CONVERT_PAGE')
    return await runPagePipeline(params, arch, classifiedRefs, signals, standards)

  return await runSectionGeneration(params.task, arch, signals, standards, params)
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

async function main() {
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
ui-forge — Next.js component generator

  --task     What to build (required)
  --refs     Comma-separated ref files (HTML, TSX, JSON, image, markdown)
  --stream   Stream section output to stdout
  --output   Write result to file path
  --config   Load all params from JSON file
  --rescan   Re-run scan.js before generating
  --replan   Force Stage 1 page plan regeneration

First run: node ${CLAUDE_SKILL_DIR}/scripts/scan.js
`)
    process.exit(1)
  }

  if (typeof params.refs === 'string')
    params.refs = params.refs.split(',').map(s => s.trim())

  for (const flag of ['stream', 'rescan', 'replan'])
    if (params[flag] === 'true') params[flag] = true

  try {
    const result = await forge(params)
    if (!params.stream && !params.output) process.stdout.write(result + '\n')
    else if (params.output) process.stderr.write(`Written: ${params.output}\n`)
  } catch (e) {
    process.stderr.write(`Error: ${e.message}\n`)
    process.exit(1)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()