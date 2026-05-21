/**
 * Optional PostToolUse hook for auto-running verify after edits.
 * Patches each platform's settings.json hooks array.
 */
import { existsSync } from 'node:fs';
import { posix } from 'node:path';
import { backupOnce, readJson, toPosix, writeJson } from '../fs-utils.js';
import { expandScope, makeRel } from './commands.js';
import { platformById, platformPaths } from '../platforms.js';

export interface HooksArgs {
  cwd: string;
  homedir: string;
  scope: 'project' | 'global' | 'both';
  platformIds: string[];
  paired: boolean;
  enabled: boolean;
  dryRun: boolean;
}

export interface HooksResult {
  patched: { path: string; keys: string[] }[];
}

const HOOK_MARKER = 'ui-forge:verify-after-edit';
const PAIRED_MARKER = 'ui-forge:stackshift-validate';

export function writeHooks(args: HooksArgs): HooksResult {
  const { cwd, homedir, scope, platformIds, paired, enabled, dryRun } = args;
  const patched: { path: string; keys: string[] }[] = [];

  for (const id of platformIds) {
    const platform = platformById(id);
    if (!platform) continue;
    for (const scopeChoice of expandScope(scope)) {
      const paths = platformPaths(cwd, platform, scopeChoice, homedir);
      if (dryRun) {
        patched.push({
          path: toPosix(makeRel(cwd, paths.settingsFile, scopeChoice)),
          keys: ['hooks.PostToolUse'],
        });
        continue;
      }

      const existing = existsSync(paths.settingsFile) ? safeReadJson(paths.settingsFile) : {};
      const settings = (existing as Record<string, unknown>) ?? {};
      const hooks = ((settings.hooks as Record<string, unknown>) ?? {}) as Record<string, unknown>;
      let post = Array.isArray(hooks.PostToolUse) ? (hooks.PostToolUse as Record<string, unknown>[]) : [];

      // Strip prior ui-forge hooks.
      post = post.filter((h) => h.id !== HOOK_MARKER && h.id !== PAIRED_MARKER);

      if (enabled) {
        post.push({
          id: HOOK_MARKER,
          matcher: { tool: ['Edit', 'Write'], pathGlob: ['app/**/*.tsx', 'src/**/*.tsx', 'components/**/*.tsx'] },
          command: `node ${posix.join(toPosix(paths.skillDir), 'scripts/verify.js')} "$CLAUDE_FILE_PATH"`,
        });
      }
      if (paired) {
        post.push({
          id: PAIRED_MARKER,
          matcher: { tool: ['Edit', 'Write'] },
          command: 'node .stackshift/scripts/validate.js "$CLAUDE_FILE_PATH"',
        });
      }

      hooks.PostToolUse = post;
      settings.hooks = hooks;

      if (existsSync(paths.settingsFile)) backupOnce(paths.settingsFile);
      writeJson(paths.settingsFile, settings);
      patched.push({
        path: toPosix(makeRel(cwd, paths.settingsFile, scopeChoice)),
        keys: ['hooks.PostToolUse'],
      });
    }
  }
  return { patched };
}

function safeReadJson(path: string): unknown {
  try {
    return readJson(path);
  } catch {
    return {};
  }
}

/**
 * Remove ui-forge hooks from a settings file. Used by uninstall.
 */
export function removeHooks(settingsPath: string, dryRun: boolean): boolean {
  if (!existsSync(settingsPath)) return false;
  if (dryRun) return true;
  const settings = (safeReadJson(settingsPath) as Record<string, unknown>) ?? {};
  const hooks = (settings.hooks as Record<string, unknown>) ?? {};
  const post = Array.isArray(hooks.PostToolUse) ? (hooks.PostToolUse as Record<string, unknown>[]) : [];
  const filtered = post.filter((h) => h.id !== HOOK_MARKER && h.id !== PAIRED_MARKER);
  if (filtered.length === post.length) return false;
  hooks.PostToolUse = filtered;
  settings.hooks = hooks;
  writeJson(settingsPath, settings);
  return true;
}
