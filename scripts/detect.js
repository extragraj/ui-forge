#!/usr/bin/env node
/**
 * UI Forge — cross-platform skill root detection (Node.js)
 * Mirrors detect.sh logic; works on Windows, macOS, and Linux.
 *
 * CLI: node scripts/detect.js   → prints skill root to stdout; exit 1 if not found
 * Module: import { detectSkillRoot } from './detect.js'  → returns path string or null
 */
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

const H = homedir();

// Priority 1 — env vars set by agentic platforms
const ENV_VARS = ['CLAUDE_SKILL_DIR', 'CLAUDE_PLUGIN_ROOT', 'SKILL_ROOT'];

// Priority 2 — project-local paths (relative to cwd)
const LOCAL_REL = [
  '.claude/skills/ui-forge',
  '.agents/skills/ui-forge',
  '.github/skills/ui-forge',
  '.cursor/skills/ui-forge',
  '.codex/skills/ui-forge',
  '.copilot/skills/ui-forge',
  '.agentic/skills/ui-forge',
  '.gemini/antigravity/skills/ui-forge',
];

// Priority 3 — global install paths
const GLOBAL_ABS = [
  join(H, '.claude',  'skills', 'ui-forge'),
  join(H, '.agents',  'skills', 'ui-forge'),
  join(H, '.copilot', 'skills', 'ui-forge'),
  join(H, '.cursor',  'skills', 'ui-forge'),
  join(H, '.codex',   'skills', 'ui-forge'),
  join(H, '.agentic', 'skills', 'ui-forge'),
  join(H, '.gemini',  'antigravity', 'skills', 'ui-forge'),
  '/etc/codex/skills/ui-forge',
];

export function detectSkillRoot() {
  for (const key of ENV_VARS) {
    const v = process.env[key];
    if (v && existsSync(join(v, 'SKILL.md'))) return v;
  }
  const cwd = process.cwd();
  for (const rel of LOCAL_REL) {
    const abs = join(cwd, rel);
    if (existsSync(join(abs, 'SKILL.md'))) return abs;
  }
  for (const abs of GLOBAL_ABS) {
    if (existsSync(join(abs, 'SKILL.md'))) return abs;
  }
  return null;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const root = detectSkillRoot();
  if (root) {
    process.stdout.write(root + '\n');
  } else {
    process.stderr.write('ui-forge: skill directory not found.\n\n');
    process.stderr.write('Install with:\n');
    process.stderr.write('  Claude Code:   npx skills add extragraj/ui-forge -y -g -a claude-code\n');
    process.stderr.write('  Codex CLI:     npx skills add extragraj/ui-forge -y -g -a codex\n');
    process.stderr.write('  All agents:    npx skills add extragraj/ui-forge -y -g\n\n');
    process.stderr.write('Or set manually:  export CLAUDE_SKILL_DIR=/path/to/ui-forge\n');
    process.exit(1);
  }
}
