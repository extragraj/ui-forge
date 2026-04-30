/**
 * ui-forge / sync-version.mjs
 *
 * Reads the canonical version from ./skill.version and syncs it to:
 *   - package.json          (version field)
 *   - README.md             (> **Version** x.x.x line)
 *   - SKILL.md              (version: x.x.x in YAML frontmatter)
 *
 * Usage:
 *   node scripts/sync-version.mjs
 *
 * To bump the version, edit skill.version and re-run this script.
 */

import { readFileSync, writeFileSync } from 'fs'

const SEMVER = /^\d+\.\d+\.\d+[\w.-]*$/

// ─── Read canonical version ───────────────────────────────────────────────────

const skillVersion = readFileSync('./skill.version', 'utf8').trim()

if (!SEMVER.test(skillVersion)) {
  console.error(`❌  Invalid version in skill.version: "${skillVersion}"`)
  console.error(`    Expected format: x.x.x or x.x.x-prerelease`)
  process.exit(1)
}

console.log(`Syncing version: ${skillVersion}\n`)

// ─── package.json ─────────────────────────────────────────────────────────────

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'))
pkg.version = skillVersion
writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n')
console.log(`✓  package.json       → ${skillVersion}`)

// ─── README.md ───────────────────────────────────────────────────────────────
// Targets the line:  > **Version** x.x.x

const README_RE = /^> \*\*Version\*\* \d+\.\d+\.\d+[\w.-]*/m

let readme = readFileSync('./README.md', 'utf8')
if (!README_RE.test(readme)) {
  console.warn(`⚠   README.md         — version line not found (> **Version** x.x.x). Skipped.`)
} else {
  writeFileSync('./README.md', readme.replace(README_RE, `> **Version** ${skillVersion}`))
  console.log(`✓  README.md          → ${skillVersion}`)
}

// ─── SKILL.md ────────────────────────────────────────────────────────────────
// Targets the frontmatter line:  version: x.x.x

const SKILL_RE = /^(version:\s*)\d+\.\d+\.\d+[\w.-]*/m

let skill = readFileSync('./SKILL.md', 'utf8')
if (!SKILL_RE.test(skill)) {
  console.warn(`⚠   SKILL.md          — "version: x.x.x" line not found in frontmatter. Skipped.`)
} else {
  writeFileSync('./SKILL.md', skill.replace(SKILL_RE, `$1${skillVersion}`))
  console.log(`✓  SKILL.md           → ${skillVersion}`)
}

// ─── Done ─────────────────────────────────────────────────────────────────────

console.log(`\n✓  All targets synced to ${skillVersion}`)
