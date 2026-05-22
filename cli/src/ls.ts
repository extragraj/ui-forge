/**
 * `ls` — print a summary of the current install.
 *
 * For multi-platform installs, the file list collapses per-platform path
 * duplicates into an `× N platforms` notation (Issue 3) since the same
 * skill files are written to every selected platform.
 */
import { loadLockfile } from './lockfile.js';
import { FEATURE_DISPLAY } from './assets.js';
import type { FeatureId } from './assets.js';

export function runLs(cwd: string): void {
  const lock = loadLockfile(cwd);
  if (!lock) {
    console.error('No .ui-forge/installed.json found.');
    process.exit(1);
  }

  const featureNames = lock.features
    .map((f) => FEATURE_DISPLAY[f as FeatureId] ?? f)
    .join(', ');

  const allWritten = Object.values(lock.files).flat();
  const fileCount = new Set(allWritten).size;

  console.log(`UI Forge ${lock.skillVersion} — installed ${lock.installedAt}`);
  console.log(`  Scope:       ${lock.scope}`);
  console.log(`  Platforms:   ${lock.platforms.join(', ')}`);
  console.log(`  Features:    ${featureNames}`);
  console.log(`  Theme:       ${lock.theme}${lock.themeLimited ? ' (limited)' : ''}`);
  console.log(`  Paired:      ${lock.paired}`);
  console.log(`  MCP clients: ${lock.mcpClients.join(', ') || '(none)'}`);

  if (lock.files && Object.keys(lock.files).length > 0) {
    const multi = lock.platforms.length > 1;
    console.log(`  Files (${fileCount} total)${multi ? ` × ${lock.platforms.length} platforms` : ''}:`);
    for (const [group, entries] of Object.entries(lock.files)) {
      if (entries.length === 0) continue;
      if (multi) {
        const uniqueSuffixes = collapsePlatformPrefixes(entries, lock.platforms);
        console.log(`    [${group}] ${uniqueSuffixes} unique file(s) × ${lock.platforms.length} platforms`);
      } else {
        console.log(`    [${group}] ${entries.length} file(s)`);
      }
    }
  } else {
    console.log(`  Files: ${fileCount}`);
  }

  console.log(`  Patched: ${lock.patched.length} config(s)`);
}

/**
 * Count files after stripping per-platform path prefixes. A path like
 * `.claude/skills/ui-forge/SKILL.md` and `.cursor/skills/ui-forge/SKILL.md`
 * both reduce to `skills/ui-forge/SKILL.md`, so they count as one.
 */
function collapsePlatformPrefixes(entries: string[], platforms: string[]): number {
  const suffixes = new Set<string>();
  for (const entry of entries) {
    let stripped = entry;
    for (const p of platforms) {
      // Match `.<platform>/` and `.<platform>-something/` at start (e.g. .agents, .gemini/antigravity).
      const re = new RegExp(`^\\.${escapeRegex(p)}(?:[\\-/].*?/)?`);
      stripped = stripped.replace(re, '');
    }
    suffixes.add(stripped);
  }
  return suffixes.size;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
