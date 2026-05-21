/**
 * Patch each platform's settings.json `permissions.allow` array with one
 * entry per selected script. Deep-merges with existing entries.
 */
import { existsSync } from 'node:fs';
import { posix } from 'node:path';
import type { FeatureId } from '../assets.js';
import { FEATURE_PERMISSIONS, RUNTIME_ASSETS } from '../assets.js';
import { backupOnce, readJson, toPosix, writeJson } from '../fs-utils.js';
import { expandScope, makeRel } from './commands.js';
import { platformById, platformPaths } from '../platforms.js';

export interface PermissionsArgs {
  cwd: string;
  homedir: string;
  scope: 'project' | 'global' | 'both';
  platformIds: string[];
  features: FeatureId[];
  dryRun: boolean;
}

export interface PermissionsResult {
  patched: { path: string; keys: string[] }[];
  planned: { path: string; entries: string[] }[];
}

const ALWAYS_PERMS = ['scripts/detect.js'];

export function permissionEntry(skillRoot: string, scriptRel: string): string {
  return `Bash(node ${posix.join(toPosix(skillRoot), scriptRel)}:*)`;
}

export function expectedPermissions(skillRoot: string, features: FeatureId[]): string[] {
  const scripts = new Set<string>(ALWAYS_PERMS);
  for (const f of features) {
    for (const s of FEATURE_PERMISSIONS[f] ?? []) scripts.add(s);
  }
  return Array.from(scripts).map((s) => permissionEntry(skillRoot, s));
}

export function writePermissions(args: PermissionsArgs): PermissionsResult {
  const { cwd, homedir, scope, platformIds, features, dryRun } = args;
  const patched: { path: string; keys: string[] }[] = [];
  const planned: { path: string; entries: string[] }[] = [];

  for (const id of platformIds) {
    const platform = platformById(id);
    if (!platform) continue;
    for (const scopeChoice of expandScope(scope)) {
      const paths = platformPaths(cwd, platform, scopeChoice, homedir);
      const entries = expectedPermissions(paths.skillDir, features);
      planned.push({ path: paths.settingsFile, entries });
      if (dryRun) continue;

      const existing = existsSync(paths.settingsFile) ? safeReadJson(paths.settingsFile) : {};
      const settings = (existing as Record<string, unknown>) ?? {};
      const permissions = ((settings.permissions as Record<string, unknown>) ?? {}) as Record<string, unknown>;
      const allow = Array.isArray(permissions.allow) ? (permissions.allow as string[]) : [];

      // Remove any prior ui-forge entries (entries pointing into our skill dir).
      const skillPosix = toPosix(paths.skillDir);
      const filtered = allow.filter((e) => !e.includes(`node ${skillPosix}/scripts/`));
      const merged = Array.from(new Set([...filtered, ...entries])).sort();

      permissions.allow = merged;
      settings.permissions = permissions;

      backupOnce(paths.settingsFile);
      writeJson(paths.settingsFile, settings);
      patched.push({
        path: toPosix(makeRel(cwd, paths.settingsFile, scopeChoice)),
        keys: ['permissions.allow'],
      });
    }
  }
  return { patched, planned };
}

function safeReadJson(path: string): unknown {
  try {
    return readJson(path);
  } catch {
    return {};
  }
}

/**
 * Remove all permission entries pointing into the given skill dirs.
 * Used by uninstall.
 */
export function removePermissionsForSkill(settingsPath: string, skillDirs: string[], dryRun: boolean): boolean {
  if (!existsSync(settingsPath)) return false;
  if (dryRun) return true;
  const settings = (safeReadJson(settingsPath) as Record<string, unknown>) ?? {};
  const permissions = (settings.permissions as Record<string, unknown>) ?? {};
  const allow = Array.isArray(permissions.allow) ? (permissions.allow as string[]) : [];
  const skillPosix = skillDirs.map((d) => toPosix(d));
  const filtered = allow.filter((e) => !skillPosix.some((d) => e.includes(`node ${d}/scripts/`)));
  if (filtered.length === allow.length) return false;
  permissions.allow = filtered;
  settings.permissions = permissions;
  writeJson(settingsPath, settings);
  return true;
}

// Re-export RUNTIME_ASSETS so callers can drop it if unused (silences TS unused warning).
export { RUNTIME_ASSETS };
