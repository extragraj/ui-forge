/**
 * Detect installed agentic platform directories. Returns the platforms whose
 * directory already exists in cwd, plus a canonical list for the prompt.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface Platform {
  id: string;
  label: string;
  dir: string;
  skillSubdir: string;
  commandsSubdir: string;
  settingsFile: string;
}

export const PLATFORMS: Platform[] = [
  {
    id: 'claude',
    label: 'Claude Code (.claude)',
    dir: '.claude',
    skillSubdir: 'skills/ui-forge',
    commandsSubdir: 'commands',
    settingsFile: 'settings.json',
  },
  {
    id: 'agents',
    label: 'Agents (.agents)',
    dir: '.agents',
    skillSubdir: 'skills/ui-forge',
    commandsSubdir: 'commands',
    settingsFile: 'settings.json',
  },
  {
    id: 'cursor',
    label: 'Cursor (.cursor)',
    dir: '.cursor',
    skillSubdir: 'skills/ui-forge',
    commandsSubdir: 'commands',
    settingsFile: 'settings.json',
  },
  {
    id: 'codex',
    label: 'Codex (.codex)',
    dir: '.codex',
    skillSubdir: 'skills/ui-forge',
    commandsSubdir: 'commands',
    settingsFile: 'settings.json',
  },
  {
    id: 'copilot',
    label: 'GitHub Copilot (.copilot or .github)',
    dir: '.copilot',
    skillSubdir: 'skills/ui-forge',
    commandsSubdir: 'commands',
    settingsFile: 'settings.json',
  },
  {
    id: 'gemini',
    label: 'Gemini Antigravity (.gemini/antigravity)',
    dir: '.gemini',
    skillSubdir: 'antigravity/skills/ui-forge',
    commandsSubdir: 'antigravity/commands',
    settingsFile: 'antigravity/settings.json',
  },
];

export function detectPlatforms(cwd: string): Platform[] {
  return PLATFORMS.filter((p) => existsSync(join(cwd, p.dir)));
}

export function platformById(id: string): Platform | undefined {
  return PLATFORMS.find((p) => p.id === id);
}

/**
 * Resolve absolute paths for a platform's skill dir, commands dir, settings file.
 */
export function platformPaths(cwd: string, p: Platform, scope: 'project' | 'global', homedir: string) {
  const base = scope === 'global' ? join(homedir, p.dir) : join(cwd, p.dir);
  return {
    base,
    skillDir: join(base, p.skillSubdir),
    commandsDir: join(base, p.commandsSubdir),
    settingsFile: join(base, p.settingsFile),
  };
}
