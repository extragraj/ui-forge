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
 *   node ${CLAUDE_SKILL_DIR}/scripts/scan.js --patch                    (re-scan everything, preserve existing designStandards entries)
 *   node ${CLAUDE_SKILL_DIR}/scripts/scan.js --quick                    (skip claude CLI synthesis; static analysis only)
 *   node ${CLAUDE_SKILL_DIR}/scripts/scan.js --ignore ./extra.ignore    (load an additional ignore file; repeatable)
 *   node ${CLAUDE_SKILL_DIR}/scripts/scan.js --no-default-ignore        (skip the built-in base ignore list)
 *   node ${CLAUDE_SKILL_DIR}/scripts/scan.js --theme <name>             (seed baseline from themes/<name>.json; fills gaps only)
 *   node ${CLAUDE_SKILL_DIR}/scripts/scan.js --schema-v4                (emit v4 schema with darkColorTokens; version-gated)
 *
 * Available themes: shadcn, mantine, plain-tailwind, stackshift.
 *
 * Ignore precedence (last wins on conflict):
 *   built-in base → .gitignore → .agentic.ignore → .claude.ignore → .forgeignore → --ignore <file>
 *
 * AI synthesis strategy (in priority order, first available wins):
 *   1. claude CLI  — works in Claude Code without an API key
 *   2. Static only — pure Node.js analysis, no AI synthesis (still useful)
 */

import {
  readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync,
} from 'fs'
import { join, relative, extname, dirname } from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CLAUDE_SKILL_DIR = join(__dirname, '..')
const THEMES_DIR = join(CLAUDE_SKILL_DIR, 'themes')

const args = process.argv.slice(2)
const flag = k => args.includes(k)
const flagVal = k => { const i = args.indexOf(k); return i !== -1 ? args[i + 1] : null }
const flagValAll = k => {
  const out = []
  for (let i = 0; i < args.length; i++) {
    if (args[i] === k && args[i + 1] != null) out.push(args[i + 1])
  }
  return out
}

const PROJECT_ROOT = flagVal('--project-root') ?? process.cwd()
const PATCH_MODE = flag('--patch')
const QUICK_MODE = flag('--quick')
const NO_DEFAULT_IGNORE = flag('--no-default-ignore')
const EXTRA_IGNORE_FILES = flagValAll('--ignore')
const THEME_NAME = flagVal('--theme')
const SCHEMA_V4 = flag('--schema-v4')
const OUT_DIR = join(PROJECT_ROOT, 'design')
const OUT_FILE = join(OUT_DIR, 'design-arch.json')
const COMPONENT_USAGE_FILE = join(OUT_DIR, 'component-usage.json')

// ─── Ignore patterns (gitignore-subset matcher) ───────────────────────────────
//
// Pattern object shape:
//   { raw, negate, anchored, dirOnly, regex }
//
// Supported syntax:
//   #comment, blank         — skipped
//   /pattern                — anchored to project root
//   pattern/                — matches directories only
//   !pattern                — negation (re-include)
//   **                      — depth-wildcard (zero or more path segments)
//   *                       — single-segment wildcard
//   ?                       — single char

const BASE_PATTERNS_RAW = [
  'node_modules/', '.git/', '.next/', 'dist/', 'build/', 'out/', '.turbo/',
  'coverage/', '.cache/', 'public/', 'static/', 'design/', '.agentic/', '.claude/',
]

function compilePattern(raw) {
  let pat = raw.trim()
  if (!pat || pat.startsWith('#')) return null

  const negate = pat.startsWith('!')
  if (negate) pat = pat.slice(1)

  const dirOnly = pat.endsWith('/')
  if (dirOnly) pat = pat.slice(0, -1)

  const anchored = pat.startsWith('/')
  if (anchored) pat = pat.slice(1)

  // If the pattern contains no unescaped `/` (other than the leading one we stripped),
  // it should match at any depth — prefix with "**/".
  const hasSlash = pat.includes('/')
  if (!anchored && !hasSlash) pat = '**/' + pat

  // Build regex: escape regex metachars, then expand glob tokens.
  // Use placeholders for **, *, ? so escaping doesn't clobber them.
  const DOUBLESTAR = '\x00DS\x00'
  const STAR = '\x00S\x00'
  const QMARK = '\x00Q\x00'

  let re = pat
    .replace(/\*\*/g, DOUBLESTAR)
    .replace(/\*/g, STAR)
    .replace(/\?/g, QMARK)
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    // `**/` at the start or between slashes → zero or more segments (including none)
    .replace(new RegExp(`${DOUBLESTAR}/`, 'g'), '(?:.*/)?')
    // trailing or standalone `**`  → zero or more of anything
    .replace(new RegExp(DOUBLESTAR, 'g'), '.*')
    // `*` → any chars except `/`
    .replace(new RegExp(STAR, 'g'), '[^/]*')
    // `?` → single char except `/`
    .replace(new RegExp(QMARK, 'g'), '[^/]')

  return {
    raw,
    negate,
    anchored,
    dirOnly,
    regex: new RegExp('^' + re + '$'),
  }
}

function loadIgnorePatterns() {
  const patterns = []

  if (!NO_DEFAULT_IGNORE) {
    for (const p of BASE_PATTERNS_RAW) {
      const c = compilePattern(p)
      if (c) patterns.push(c)
    }
  }

  const files = ['.gitignore', '.agentic.ignore', '.claude.ignore', '.forgeignore']
  for (const f of files) {
    const p = join(PROJECT_ROOT, f)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf-8').split('\n')) {
      const c = compilePattern(line)
      if (c) patterns.push(c)
    }
  }

  for (const extra of EXTRA_IGNORE_FILES) {
    const p = extra.startsWith('/') || /^[A-Za-z]:[\\/]/.test(extra)
      ? extra : join(PROJECT_ROOT, extra)
    if (!existsSync(p)) {
      process.stderr.write(`  --ignore file not found: ${p}\n`)
      continue
    }
    for (const line of readFileSync(p, 'utf-8').split('\n')) {
      const c = compilePattern(line)
      if (c) patterns.push(c)
    }
  }

  return patterns
}

// Match a POSIX-style relative path against the compiled pattern list.
// Last matching pattern wins (negation re-includes).
function isIgnored(rel, isDir, patterns) {
  const posix = rel.split(/[\\/]/).join('/')
  let ignored = false
  for (const p of patterns) {
    if (p.dirOnly && !isDir) continue
    if (!p.regex.test(posix)) continue
    ignored = !p.negate
  }
  return ignored
}

// ─── Source file collector ────────────────────────────────────────────────────

const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx'])

function collectSourceFiles(ignorePatterns) {
  const files = []
  function walk(dir) {
    let entries
    try { entries = readdirSync(dir, { withFileTypes: true }) }
    catch (e) { process.stderr.write(`  skipped dir ${dir}: ${e.message}\n`); return }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      const rel = relative(PROJECT_ROOT, full)
      const isDir = entry.isDirectory()
      // Prune at directory boundary — avoids descending into ignored dirs
      if (isIgnored(rel, isDir, ignorePatterns)) continue
      if (isDir) { walk(full); continue }
      if (entry.isFile() && SOURCE_EXTS.has(extname(entry.name))) files.push(full)
    }
  }
  walk(PROJECT_ROOT)
  return files
}

// ─── Import scanner ───────────────────────────────────────────────────────────

// Hoisted at module load — no per-call reassignment
const FROM_RE = /from\s+['"](@?[\w][\w\-\/\.]*)['"]/g
const NAMED_RE = /import\s*\{([^}]+)\}\s*from\s*['"](@[\w\-]+\/[\w\-\/\.]+|[@~#]\/[\w\-\/\.]+)['"]/g

function scanImports(files) {
  const pkgCount = {}
  const componentSet = new Set()

  for (const file of files) {
    let src
    try { src = readFileSync(file, 'utf-8') }
    catch (e) { process.stderr.write(`  skipped ${file}: ${e.message}\n`); continue }

    let m
    FROM_RE.lastIndex = 0
    while ((m = FROM_RE.exec(src)) !== null) {
      const pkg = m[1]
      if (pkg.startsWith('.') || pkg.startsWith('@/') || pkg.startsWith('~')) continue
      const root = pkg.startsWith('@') ? pkg.split('/').slice(0, 2).join('/') : pkg.split('/')[0]
      pkgCount[root] = (pkgCount[root] || 0) + 1
    }

    NAMED_RE.lastIndex = 0
    while ((m = NAMED_RE.exec(src)) !== null) {
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

function resolveLibraries(pkgCount, allDeps) {
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
    return { themeSection: (m?.[1] ?? raw).slice(0, 2500), path: n }
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
    return { content: readFileSync(p, 'utf-8').slice(0, 3000), path: n }
  }
  return null
}

function readClaudeMd() {
  const p = join(PROJECT_ROOT, 'CLAUDE.md')
  if (!existsSync(p)) return null
  return readFileSync(p, 'utf-8').slice(0, 1500)
}

function copyBuiltinStandard(srcName, destName) {
  const src = join(CLAUDE_SKILL_DIR, 'references', 'standards', srcName)
  const dest = join(PROJECT_ROOT, 'design', 'standards', destName)
  if (!existsSync(src)) return false
  if (existsSync(dest)) return false // preserve project edits
  try {
    const content = readFileSync(src, 'utf-8')
    writeFileSync(dest, content, 'utf-8')
    return true
  } catch { return false }
}

function copyBuiltinStandardDir(srcDir, destDir) {
  const src = join(CLAUDE_SKILL_DIR, 'references', 'standards', srcDir)
  const dest = join(PROJECT_ROOT, 'design', 'standards', destDir)
  if (!existsSync(src)) return false
  if (existsSync(dest)) return false // preserve project edits
  try {
    mkdirSync(dest, { recursive: true })
    for (const entry of readdirSync(src, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue
      const content = readFileSync(join(src, entry.name), 'utf-8')
      writeFileSync(join(dest, entry.name), content, 'utf-8')
    }
    return true
  } catch { return false }
}

function findDesignStandards(isStackShift) {
  const standards = {}

  // Ensure design/standards/ exists so project-level overrides have a clear home
  const standardsDir = join(PROJECT_ROOT, 'design', 'standards')
  if (!existsSync(standardsDir)) {
    try { mkdirSync(standardsDir, { recursive: true }) } catch {}
  }

  // Copy general built-in standards to project (always, not StackShift-exclusive).
  // sample-standard.md is a template for users to copy, not an active standard.
  // It is copied as _template-standard.md (underscore prefix = meta/template) so
  // the auto-registration loop below skips it (only .md files without underscore
  // prefix are registered as active designStandards).
  const generalStandards = [
    { src: 'nextjs-image.md', dest: 'nextjs-image.md' },
    { src: 'sample-standard.md', dest: '_template-standard.md' },
  ]
  for (const { src, dest } of generalStandards) {
    if (copyBuiltinStandard(src, dest)) {
      process.stderr.write(`  copied built-in standard: ${dest}\n`)
    }
  }

  // Issue 4: Copy stackshift-ui standards directory to project when StackShift
  if (isStackShift) {
    const stackshiftUiCopied = copyBuiltinStandardDir('stackshift-ui', 'stackshift-ui')
    if (stackshiftUiCopied) {
      process.stderr.write('  copied built-in standard: stackshift-ui/\n')
    }

    // Auto-detect StackShift standard if StackShift project
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

    // Record the project-local path (or built-in fallback if copy was skipped)
    const projectStackshiftUi = join(PROJECT_ROOT, 'design', 'standards', 'stackshift-ui')
    if (existsSync(projectStackshiftUi)) {
      standards['stackshift-ui'] = './design/standards/stackshift-ui'
    } else {
      // Fall back to built-in path if project copy doesn't exist
      const builtinPath = join(CLAUDE_SKILL_DIR, 'references', 'standards', 'stackshift-ui')
      if (existsSync(builtinPath)) {
        standards['stackshift-ui'] = './' + relative(PROJECT_ROOT, builtinPath).replace(/\\/g, '/')
      }
    }
  }

  // Auto-register project-local standards shipped under design/standards/*.md.
  // Keys are the file basename (e.g. typography.md → "typography"). Existing
  // entries (including stackshiftComponentStandard above) are not overwritten.
  // Files starting with underscore (e.g. _template-standard.md) are meta/template
  // files and are NOT registered as active designStandards.
  if (existsSync(standardsDir)) {
    try {
      for (const entry of readdirSync(standardsDir, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith('.md')) continue
        // Skip underscore-prefixed files (meta/template files, not active standards)
        if (entry.name.startsWith('_')) continue
        const key = entry.name.replace(/\.md$/, '')
        if (standards[key]) continue
        standards[key] = `./design/standards/${entry.name}`
      }
    } catch {}
  }

  return standards
}

// ─── Theme starters ───────────────────────────────────────────────────────────

function loadTheme(name) {
  if (!name) return null
  const file = join(THEMES_DIR, `${name}.json`)
  if (!existsSync(file)) {
    let available = []
    try {
      available = readdirSync(THEMES_DIR)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace(/\.json$/, ''))
    } catch {}
    process.stderr.write(
      `Error: unknown --theme "${name}". Available: ${available.join(', ') || '(none found)'}\n`
    )
    process.exit(1)
  }
  try { return JSON.parse(readFileSync(file, 'utf-8')) }
  catch (e) { process.stderr.write(`Error: could not parse theme "${name}": ${e.message}\n`); process.exit(1) }
}

// Fill gaps in arch with theme baselines. Scan data wins where present.
function applyTheme(arch, theme) {
  if (!theme) return arch
  const out = { ...arch, _theme: theme._theme ?? THEME_NAME }

  // G-2: explicit --theme stackshift declaration forces isStackShift=true
  // regardless of what synthesize() returned (handles empty codebases, --quick, no claude CLI)
  if (out._theme === 'stackshift') out.isStackShift = true

  // componentLib — replace only if scan fell back to the single default
  const defaulted = Array.isArray(arch.componentLib)
    && arch.componentLib.length === 1
    && arch.componentLib[0] === './components'
  if (defaulted && Array.isArray(theme.componentLib) && theme.componentLib.length)
    out.componentLib = theme.componentLib

  // usedComponents — append theme hints (deduped) when scan found few
  if (Array.isArray(theme.usedComponents) && theme.usedComponents.length
      && (arch.usedComponents?.length ?? 0) < 5) {
    const merged = new Set([...(arch.usedComponents ?? []), ...theme.usedComponents])
    out.usedComponents = [...merged].sort()
  }

  // usedLibraries — append theme libs not already present
  if (Array.isArray(theme.usedLibraries) && theme.usedLibraries.length) {
    const seen = new Set((arch.usedLibraries ?? []).map(l => l.name))
    const extras = theme.usedLibraries.filter(l => !seen.has(l.name))
    if (extras.length) out.usedLibraries = [...(arch.usedLibraries ?? []), ...extras]
  }

  // tailwind.colorTokens — fill if empty
  if (theme.tailwind?.colorTokens && !arch.tailwind?.colorTokens) {
    out.tailwind = { ...(arch.tailwind ?? {}), colorTokens: theme.tailwind.colorTokens }
  }

  // patterns — fill only unknown/empty slots
  const p = { ...(arch.patterns ?? {}) }
  const tp = theme.patterns ?? {}
  if (tp.spacing && (!p.spacing || p.spacing === 'unknown')) p.spacing = tp.spacing
  if (tp.typography && (!p.typography || p.typography === 'unknown')) p.typography = tp.typography
  if (Array.isArray(tp.conventions) && tp.conventions.length
      && (!Array.isArray(p.conventions) || p.conventions.length === 0)) {
    p.conventions = tp.conventions
  }
  out.patterns = p

  return out
}

// ─── Dark-mode token extraction (schema v4) ───────────────────────────────────

// Scans source files for dark: prefixed Tailwind utilities.
// Called only when --schema-v4 is passed. Caps at 100 files for speed.
function extractDarkTokens(files) {
  const darkClasses = new Set()
  const darkRe = /\bdark:([a-zA-Z0-9:/-]+)/g
  for (const file of files.slice(0, 100)) {
    let src
    try { src = readFileSync(file, 'utf-8') } catch { continue }
    let m
    darkRe.lastIndex = 0
    while ((m = darkRe.exec(src)) !== null)
      darkClasses.add(m[1].split('[')[0])  // strip arbitrary values
  }
  const sorted = [...darkClasses].sort().slice(0, 60)
  return sorted.length ? sorted.join(', ') : null
}

// ─── AI synthesis ─────────────────────────────────────────────────────────────

const SYNTHESIS_PROMPT = (payload) => `Analyze this Next.js project's design system. Use the Read tool to read each file listed below, then return ONLY valid JSON with no markdown.

${payload.claudeMd ? `PROJECT NOTES (CLAUDE.md):\n${payload.claudeMd}\n\n` : ''}DESIGN SYSTEM FILES (read these to understand the design foundation):
- ${payload.tailwindPath}
- ${payload.globalCssPath}

COMPONENT FILES (read these to understand actual Tailwind spacing/typography usage patterns):
${payload.componentFiles.map(f => `- ${f}`).join('\n')}

TOP PACKAGES (by import count): ${payload.topPackages}

After reading the files, return this JSON shape exactly:
{"spacing":"<1-2 sentences: dominant section/container padding pattern>","typography":"<1-2 sentences: font usage and heading patterns>","colorTokens":"<comma-separated key token names>","conventions":["<up to 5 short conventions>"],"isStackShift":<true|false>}`

function warnSynthesisFallback(reason) {
  const bar = '═'.repeat(70)
  process.stderr.write(`\n${bar}\n`)
  process.stderr.write(`[ui-forge] WARNING: AI synthesis fell back to static analysis\n`)
  process.stderr.write(`  Reason: ${reason}\n`)
  process.stderr.write(`  Effect: design-arch.json patterns.spacing / typography / conventions\n`)
  process.stderr.write(`          will be 'unknown' or coarse heuristics.\n`)
  process.stderr.write(`  Fix:    ensure 'claude' CLI is on PATH, then re-run scan,\n`)
  process.stderr.write(`          or pass --quick to skip synthesis silently.\n`)
  process.stderr.write(`${bar}\n\n`)
}

function tryClaudeCLI(payload) {
  // Check if claude CLI is available (Claude Code, Cursor, AntiGravity, etc.)
  const check = spawnSync('claude', ['--version'], { encoding: 'utf-8', stdio: 'pipe', shell: true })
  if (check.error || check.status !== 0) {
    warnSynthesisFallback('claude CLI not found')
    return null
  }

  process.stderr.write('  using claude CLI for synthesis\n')
  const prompt = SYNTHESIS_PROMPT(payload)
  // Windows fix: pass prompt via stdin (input option) instead of as a -p <prompt> arg.
  // CMD.exe mangles special chars (& % @ " { }) when concatenated as shell args.
  // -p without an inline prompt reads from stdin ("useful for pipes" — claude --help).
  // shell: true retained so Node resolves claude.cmd on Windows.
  const result = spawnSync(
    'claude',
    ['-p', '--no-session-persistence', '--model', 'claude-haiku-4-5-20251001', '--output-format', 'text'],
    { encoding: 'utf-8', stdio: 'pipe', timeout: 120000, maxBuffer: 512 * 1024, shell: true, input: prompt }
  )
  if (result.error) {
    const reason = result.error?.code === 'ETIMEDOUT'
      ? 'claude CLI timed out after 120s'
      : `claude CLI error: ${result.error.message}`
    warnSynthesisFallback(reason)
    return null
  }
  if (result.status !== 0) {
    warnSynthesisFallback(`claude CLI exited with code ${result.status}`)
    return null
  }
  try {
    return JSON.parse(result.stdout.trim().replace(/```json|```/g, '').trim())
  } catch {
    warnSynthesisFallback('claude CLI returned unparseable JSON')
    return null
  }
}

function staticFallback(pkgCount) {
  process.stderr.write('  no AI available — using static analysis only\n')
  const isStackShift = !!(pkgCount['@stackshift-ui'] || pkgCount['@webriq-pagebuilder'])
  return { spacing: 'unknown', typography: 'unknown', colorTokens: '', conventions: [], isStackShift }
}

function synthesize(payload, pkgCount) {
  if (QUICK_MODE) {
    process.stderr.write('  --quick mode — skipping claude CLI synthesis\n')
    return staticFallback(pkgCount)
  }
  return tryClaudeCLI(payload) ?? staticFallback(pkgCount)
}

// ─── .forgeignore handling for --theme stackshift ──────────────────────────────

function mergeForgeignoreLines(existingContent, stackshiftContent) {
  const existingLines = new Set(
    existingContent.split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'))
  )
  const newLines = []
  const stackshiftLines = stackshiftContent.split('\n')
  for (const line of stackshiftLines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      newLines.push(line)  // keep comments/blank lines
    } else if (!existingLines.has(trimmed)) {
      newLines.push(line)  // only add genuinely new patterns
    }
  }
  return newLines.join('\n')
}

function handleStackshiftForgeignore() {
  const forgeignorePath = join(PROJECT_ROOT, '.forgeignore')
  const stackshiftTemplate = join(CLAUDE_SKILL_DIR, 'references', 'default-stackshift-forgeignore.txt')
  const defaultTemplate = join(CLAUDE_SKILL_DIR, 'references', 'default-forgeignore.txt')

  if (!existsSync(stackshiftTemplate)) return

  const stackshiftContent = readFileSync(stackshiftTemplate, 'utf-8')

  if (!existsSync(forgeignorePath)) {
    // Does not exist → create from stackshift template
    writeFileSync(forgeignorePath, stackshiftContent, 'utf-8')
    process.stderr.write('  .forgeignore created from StackShift template.\n')
    return
  }

  const existingContent = readFileSync(forgeignorePath, 'utf-8')

  // Check if it's a UI Forge template (has the IDENTIFIER marker)
  if (existingContent.includes('IDENTIFIER: ui-forge-template')) {
    // Template → overwrite with stackshift content
    writeFileSync(forgeignorePath, stackshiftContent, 'utf-8')
    process.stderr.write('  .forgeignore overwritten with StackShift template (was default template).\n')
    return
  }

  // Non-template existing file → merge line-by-line to avoid duplicates
  const merged = mergeForgeignoreLines(existingContent, stackshiftContent)
  writeFileSync(forgeignorePath, existingContent.trimEnd() + '\n\n' + merged, 'utf-8')
  process.stderr.write('  .forgeignore: StackShift exclusions merged (deduplicated).\n')
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  process.stderr.write('ui-forge/scan: scanning project...\n')

  const theme = loadTheme(THEME_NAME)
  if (theme) process.stderr.write(`  applying theme starter: ${THEME_NAME}\n`)

  // Issue 2: Handle .forgeignore when --theme stackshift is used
  if (THEME_NAME === 'stackshift') {
    handleStackshiftForgeignore()
  }

  const ignore = loadIgnorePatterns()
  const files = collectSourceFiles(ignore)
  process.stderr.write(`  ${files.length} source files found\n`)

  // Read package.json once here; pass into resolveLibraries.
  const pkgJsonPath = join(PROJECT_ROOT, 'package.json')
  const allDeps = existsSync(pkgJsonPath)
    ? (() => { try { const p = JSON.parse(readFileSync(pkgJsonPath, 'utf-8')); return { ...p.dependencies, ...p.devDependencies } } catch { return {} } })()
    : {}

  const { pkgCount, usedComponents } = scanImports(files)
  const usedLibraries = resolveLibraries(pkgCount, allDeps)
  const tailwind = readTailwindConfig()
  const globalCss = readGlobalCss()
  const claudeMd = readClaudeMd()

  const topPackages = Object.entries(pkgCount)
    .sort((a, b) => b[1] - a[1]).slice(0, 25)
    .map(([k, v]) => `${k}(${v})`).join(', ')

  const darkColorTokens = SCHEMA_V4 ? extractDarkTokens(files) : null
  if (SCHEMA_V4) process.stderr.write(`  schema v4: dark token extraction ${darkColorTokens ? `found ${darkColorTokens.split(',').length} tokens` : 'no dark: classes found'}\n`)

  // Build relative forward-slash component paths for synthesis prompt.
  // Filter to .tsx/.jsx only; cap at 12 for synthesis speed.
  const componentFiles = files
    .map(f => relative(PROJECT_ROOT, f).replace(/\\/g, '/'))
    .filter(f => /\.(tsx|jsx)$/.test(f))
    .slice(0, 12)

  process.stderr.write('  synthesizing patterns...\n')
  const s = synthesize(
    {
      tailwindPath: tailwind?.path ?? 'tailwind.config.ts',
      globalCssPath: globalCss?.path ?? 'styles/globals.css',
      claudeMd,
      topPackages,
      componentFiles,
    },
    pkgCount
  )

  // Gap 1: Always read existing arch to preserve non-scan fields (e.g. _paired)
  let existing = {}
  if (existsSync(OUT_FILE)) {
    try { existing = JSON.parse(readFileSync(OUT_FILE, 'utf-8')) } catch {}
  }

  // Discover component directories and design standards.
  // Always merge existing designStandards to preserve previously registered
  // entries (e.g. stackshift-ui from a prior --theme stackshift scan).
  // discovered provides new/updated entries; existing.designStandards preserves
  // everything else. This ensures rescans never delete standards.
  const effectiveIsStackShift = s.isStackShift || (theme?._theme === 'stackshift')
  const componentDirs = discoverComponentDirectories()
  const discovered = findDesignStandards(effectiveIsStackShift)
  const designStandards = existing.designStandards
    ? { ...discovered, ...existing.designStandards }
    : discovered

  const tailwindField = tailwind
    ? {
        themeSection: tailwind.themeSection,
        colorTokens: s.colorTokens,
        ...(SCHEMA_V4 && darkColorTokens ? { darkColorTokens } : {}),
      }
    : null

  // Gap 1: Always preserve _paired block (StackShift bootstrap writes it)
  const paired = existing._paired

  const arch = {
    ...existing,
    _v: SCHEMA_V4 ? 4 : 3,
    _scanned: new Date().toISOString(),
    isStackShift: s.isStackShift,
    ...(paired ? { _paired: paired } : {}),
    componentLib: componentDirs,  // Now an array
    usedComponents,
    usedLibraries,
    tailwind: tailwindField,
    globalCss: globalCss?.content.slice(0, 2000) ?? null,
    designStandards,  // object keyed by standard name → relative path
    patterns: {
      ...(existing.patterns ?? {}),
      ...(s.spacing && s.spacing !== 'unknown' ? { spacing: s.spacing } : {}),
      ...(s.typography && s.typography !== 'unknown' ? { typography: s.typography } : {}),
      ...(Array.isArray(s.conventions) && s.conventions.length > 0
        ? { conventions: s.conventions }
        : {}),
    },
  }

  // Apply theme starter (fills gaps only; scan data wins)
  const finalArch = applyTheme(arch, theme)

  // Generate component usage dictionary (separate file)
  const componentUsage = {
    _generated: new Date().toISOString(),
    components: generateComponentUsageDict(usedComponents, files)
  }

  // Write both files
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(OUT_FILE, JSON.stringify(finalArch, null, 2), 'utf-8')
  writeFileSync(COMPONENT_USAGE_FILE, JSON.stringify(componentUsage, null, 2), 'utf-8')
  process.stderr.write(`\nWritten: ${OUT_FILE}\n`)
  process.stderr.write(`Written: ${COMPONENT_USAGE_FILE}\n`)
  process.stdout.write(JSON.stringify({ ok: true, path: OUT_FILE }) + '\n')
}

try { main() } catch (e) { process.stderr.write(`scan error: ${e.message}\n`); process.exit(1) }
