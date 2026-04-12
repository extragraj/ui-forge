#!/usr/bin/env node
/**
 * ui-forge / scan.js
 *
 * Scans the project and writes design/design-arch.json.
 * Run once, then re-run when dependencies or design conventions change.
 *
 * Usage:
 *   node ${CLAUDE_SKILL_DIR}/scripts/scan.js
 *   node ${CLAUDE_SKILL_DIR}/scripts/scan.js --project-root /path/to/project
 *   node ${CLAUDE_SKILL_DIR}/scripts/scan.js --patch          (re-scan everything, preserve existing designStandards entries)
 *
 * AI synthesis strategy (in priority order, first available wins):
 *   1. claude CLI  — works in Claude Code without an API key
 *   2. Static only — pure Node.js analysis, no AI synthesis (still useful)
 */

import {
  readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync,
} from 'fs'
import { join, relative, extname } from 'path'
import { spawnSync } from 'child_process'

const args = process.argv.slice(2)
const flag = k => args.includes(k)
const flagVal = k => { const i = args.indexOf(k); return i !== -1 ? args[i + 1] : null }

const PROJECT_ROOT = flagVal('--project-root') ?? process.cwd()
const PATCH_MODE = flag('--patch')
const OUT_DIR = join(PROJECT_ROOT, 'design')
const OUT_FILE = join(OUT_DIR, 'design-arch.json')
const COMPONENT_USAGE_FILE = join(OUT_DIR, 'component-usage.json')

// ─── Ignore patterns ──────────────────────────────────────────────────────────

function loadIgnorePatterns() {
  const base = [
    'node_modules', '.git', '.next', 'dist', 'build', 'out', '.turbo',
    'coverage', '.cache', 'public', 'static', 'design', '.agentic', '.claude',
  ]
  for (const f of ['.claude.ignore', '.agentic.ignore', '.gitignore']) {
    const p = join(PROJECT_ROOT, f)
    if (!existsSync(p)) continue
    readFileSync(p, 'utf-8').split('\n').forEach(line => {
      const l = line.trim()
      if (l && !l.startsWith('#')) base.push(l.replace(/\/$/, '').replace(/^\//, ''))
    })
  }
  return [...new Set(base)]
}

function isIgnored(rel, patterns) {
  return patterns.some(p =>
    rel === p || rel.startsWith(p + '/') || rel.includes('/' + p + '/') || rel.endsWith('/' + p)
  )
}

// ─── Source file collector ────────────────────────────────────────────────────

function collectSourceFiles(ignorePatterns) {
  const files = []
  function walk(dir) {
    let entries
    try { entries = readdirSync(dir) }
    catch (e) { process.stderr.write(`  skipped dir ${dir}: ${e.message}\n`); return }
    for (const entry of entries) {
      const full = join(dir, entry)
      const rel = relative(PROJECT_ROOT, full)
      if (isIgnored(rel, ignorePatterns)) continue
      try {
        if (statSync(full).isDirectory()) { walk(full); continue }
        if (['.ts', '.tsx', '.js', '.jsx'].includes(extname(full))) files.push(full)
      } catch (e) { process.stderr.write(`  skipped ${full}: ${e.message}\n`) }
    }
  }
  walk(PROJECT_ROOT)
  return files
}

// ─── Import scanner ───────────────────────────────────────────────────────────

function scanImports(files) {
  const pkgCount = {}
  const componentSet = new Set()
  // Match: from 'pkg' or from "@scope/pkg"
  const fromRe = /from\s+['"](@?[\w][\w\-\/\.]*)['"]/g
  // Named imports from component lib (scoped packages and path-alias local directories)
  const namedRe = /import\s*\{([^}]+)\}\s*from\s*['"](@[\w\-]+\/[\w\-\/\.]+|[@~#]\/[\w\-\/\.]+)['"]/g

  for (const file of files) {
    let src
    try { src = readFileSync(file, 'utf-8') }
    catch (e) { process.stderr.write(`  skipped ${file}: ${e.message}\n`); continue }

    let m
    fromRe.lastIndex = 0
    while ((m = fromRe.exec(src)) !== null) {
      const pkg = m[1]
      if (pkg.startsWith('.') || pkg.startsWith('@/') || pkg.startsWith('~')) continue
      const root = pkg.startsWith('@') ? pkg.split('/').slice(0, 2).join('/') : pkg.split('/')[0]
      pkgCount[root] = (pkgCount[root] || 0) + 1
    }

    namedRe.lastIndex = 0
    while ((m = namedRe.exec(src)) !== null) {
      // Only collect from the primary component lib
      m[1].split(',').forEach(s => {
        const name = s.trim().replace(/\s+as\s+\w+/, '').trim()
        if (name) componentSet.add(name)
      })
    }
  }

  return { pkgCount, usedComponents: [...componentSet].sort() }
}

// ─── Component directory discovery ────────────────────────────────────────────

function discoverComponentDirectories() {
  const candidates = [
    'components',
    'components/ui',
    'src/components',
    'app/_components',
    'lib/components'
  ]

  const found = []
  for (const dir of candidates) {
    const fullPath = join(PROJECT_ROOT, dir)
    if (existsSync(fullPath)) {
      try {
        const files = readdirSync(fullPath).filter(f => /\.(tsx|jsx)$/.test(f))
        if (files.length >= 3) {  // At least 3 component files
          found.push(`./${dir}`)
        }
      } catch {}
    }
  }

  return found.length > 0 ? found : ['./components']  // Default fallback
}

// ─── Component usage dictionary generation ────────────────────────────────────

function generateComponentUsageDict(componentSet, files) {
  const usage = {}
  const components = [...componentSet]

  // Single pass over files — build inverted index instead of rescanning per component
  for (const file of files) {
    let src
    try { src = readFileSync(file, 'utf-8') }
    catch (e) { process.stderr.write(`  skipped ${file}: ${e.message}\n`); continue }

    for (const component of components) {
      // No `g` flag — boolean test, no lastIndex mutation
      const pattern = new RegExp(`import\\s+\\{[^}]*\\b${component}\\b[^}]*\\}\\s+from`)
      if (!pattern.test(src)) continue
      if (!usage[component]) usage[component] = { uses: 0, files: [] }
      usage[component].uses++
      if (usage[component].files.length < 10)
        usage[component].files.push(file.replace(PROJECT_ROOT, '.'))
    }
  }

  return usage
}

// ─── Library resolver ─────────────────────────────────────────────────────────

function resolveLibraries(pkgCount) {
  const pkgJson = join(PROJECT_ROOT, 'package.json')
  const allDeps = existsSync(pkgJson)
    ? (() => { try { const p = JSON.parse(readFileSync(pkgJson, 'utf-8')); return { ...p.dependencies, ...p.devDependencies } } catch { return {} } })()
    : {}

  // Skip: framework, build tools, type packages, common utilities
  const skipPrefixes = [
    'react', 'next', '@types', 'typescript', 'eslint', 'prettier',
    'tailwindcss', 'postcss', 'autoprefixer', 'sanity', '@sanity',
    'webpack', 'babel', 'jest', 'vitest', 'turbo', 'esbuild', 'vite', 'tsup',
    '@webriq-pagebuilder', 'nanoid', 'zod', 'clsx', 'class-variance-authority',
    'tailwind-merge', '@radix-ui', '@hookform',
  ]

  return Object.entries(pkgCount)
    .filter(([name, count]) => {
      if (count < 2) return false
      if (!allDeps[name]) return false
      return !skipPrefixes.some(p => name.startsWith(p))
    })
    .sort((a, b) => b[1] - a[1])
    .map(([name, uses]) => ({ name, version: allDeps[name], uses }))
}

// ─── Config readers ───────────────────────────────────────────────────────────

function readTailwindConfig() {
  for (const n of ['tailwind.config.ts', 'tailwind.config.js', 'tailwind.config.mjs']) {
    const p = join(PROJECT_ROOT, n)
    if (!existsSync(p)) continue
    const raw = readFileSync(p, 'utf-8')
    const m = raw.match(/theme\s*:\s*\{([\s\S]*?)\n\s*\},?\s*(?:plugins|module\.exports|\})/m)
    return { themeSection: (m?.[1] ?? raw).slice(0, 2500) }
  }
  return null
}

function readGlobalCss() {
  for (const n of [
    'styles/globals.css', 'styles/global.css', 'app/globals.css',
    'src/styles/globals.css', 'src/app/globals.css',
  ]) {
    const p = join(PROJECT_ROOT, n)
    if (!existsSync(p)) continue
    return readFileSync(p, 'utf-8').slice(0, 3000)
  }
  return null
}

function readClaudeMd() {
  const p = join(PROJECT_ROOT, 'CLAUDE.md')
  if (!existsSync(p)) return null
  return readFileSync(p, 'utf-8').slice(0, 1500)
}

function findDesignStandards(isStackShift) {
  const standards = {}

  // Auto-detect StackShift standard if StackShift project
  if (isStackShift) {
    const candidates = [
      'design/standards/stackshift-ui.md',
      'STACKSHIFT_UI_STANDARD.md',
      'docs/stackshift-ui-standard.md'
    ]
    for (const n of candidates) {
      const p = join(PROJECT_ROOT, n)
      if (existsSync(p)) {
        standards.stackshiftComponentStandard = p.replace(PROJECT_ROOT, '.')
        break
      }
    }
  }

  // User can add more standards to design/standards/ directory
  // We don't auto-detect those - user edits design-arch.json manually

  return standards
}

// ─── AI synthesis ─────────────────────────────────────────────────────────────

const SYNTHESIS_PROMPT = (payload) => `Analyze this Next.js project's design system. Return ONLY valid JSON, no markdown.

${payload.claudeMd ? `PROJECT NOTES (CLAUDE.md):\n${payload.claudeMd}\n` : ''}
TAILWIND THEME:\n${payload.tailwindTheme || 'not found'}

GLOBAL CSS:\n${payload.globalCss || 'not found'}

TOP PACKAGES (by import count):\n${payload.topPackages}

Return this JSON shape exactly:
{"spacing":"<1-2 sentences: dominant section/container padding pattern>","typography":"<1-2 sentences: font usage and heading patterns>","colorTokens":"<comma-separated key token names>","conventions":["<up to 5 short conventions>"],"isStackShift":<true|false>}`

function tryClaudeCLI(payload) {
  // Check if claude CLI is available (Claude Code, Cursor, AntiGravity, etc.)
  const check = spawnSync('claude', ['--version'], { encoding: 'utf-8', stdio: 'pipe' })
  if (check.error || check.status !== 0) return null

  process.stderr.write('  using claude CLI for synthesis\n')
  const prompt = SYNTHESIS_PROMPT(payload)
  const result = spawnSync(
    'claude',
    ['-p', prompt, '--model', 'claude-haiku-4-5-20251001', '--output-format', 'text'],
    { encoding: 'utf-8', stdio: 'pipe', timeout: 45000, maxBuffer: 512 * 1024 }
  )
  if (result.error || result.status !== 0) return null
  try {
    return JSON.parse(result.stdout.trim().replace(/```json|```/g, '').trim())
  } catch { return null }
}

function staticFallback(pkgCount) {
  process.stderr.write('  no AI available — using static analysis only\n')
  const isStackShift = !!(pkgCount['@stackshift-ui'] || pkgCount['@webriq-pagebuilder'])
  return { spacing: 'unknown', typography: 'unknown', colorTokens: '', conventions: [], isStackShift }
}

function synthesize(payload, pkgCount) {
  return tryClaudeCLI(payload) ?? staticFallback(pkgCount)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  process.stderr.write('ui-forge/scan: scanning project...\n')

  const ignore = loadIgnorePatterns()
  const files = collectSourceFiles(ignore)
  process.stderr.write(`  ${files.length} source files found\n`)

  const { pkgCount, usedComponents } = scanImports(files)
  const usedLibraries = resolveLibraries(pkgCount)
  const tailwind = readTailwindConfig()
  const globalCss = readGlobalCss()
  const claudeMd = readClaudeMd()

  const topPackages = Object.entries(pkgCount)
    .sort((a, b) => b[1] - a[1]).slice(0, 25)
    .map(([k, v]) => `${k}(${v})`).join(', ')

  process.stderr.write('  synthesizing patterns...\n')
  const s = synthesize(
    { tailwindTheme: tailwind?.themeSection, globalCss, claudeMd, topPackages },
    pkgCount
  )

  // In patch mode, merge into existing arch rather than replacing
  let existing = {}
  if (PATCH_MODE && existsSync(OUT_FILE)) {
    try { existing = JSON.parse(readFileSync(OUT_FILE, 'utf-8')) } catch {}
  }

  // Discover component directories and design standards
  const componentDirs = discoverComponentDirectories()
  const designStandards = existing.designStandards ?? findDesignStandards(s.isStackShift)

  const arch = {
    ...existing,
    _v: 3,  // Bump version
    _scanned: new Date().toISOString(),
    isStackShift: s.isStackShift,
    componentLib: componentDirs,  // Now an array
    usedComponents,
    usedLibraries,
    tailwind: tailwind ? { themeSection: tailwind.themeSection, colorTokens: s.colorTokens } : null,
    globalCss: globalCss ? globalCss.slice(0, 2000) : null,
    designStandards,  // New field (object, user-extensible)
    patterns: {
      ...(existing.patterns ?? {}),
      spacing: s.spacing,
      typography: s.typography,
      conventions: s.conventions ?? [],
    },
  }

  // Generate component usage dictionary (separate file)
  const componentUsage = {
    _generated: new Date().toISOString(),
    components: generateComponentUsageDict(usedComponents, files)
  }

  // Write both files
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(OUT_FILE, JSON.stringify(arch, null, 2), 'utf-8')
  writeFileSync(COMPONENT_USAGE_FILE, JSON.stringify(componentUsage, null, 2), 'utf-8')
  process.stderr.write(`\nWritten: ${OUT_FILE}\n`)
  process.stderr.write(`Written: ${COMPONENT_USAGE_FILE}\n`)
  process.stdout.write(JSON.stringify({ ok: true, path: OUT_FILE }) + '\n')
}

try { main() } catch (e) { process.stderr.write(`scan error: ${e.message}\n`); process.exit(1) }