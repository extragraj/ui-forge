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
  scope: 'project' | 'global';
  platformIds: string[];
  features: FeatureId[];
  dryRun: boolean;
}

export interface PermissionsResult {
  patched: { path: string; keys: string[] }[];
  planned: { path: string; entries: string[] }[];
}

const ALWAYS_PERMS = ['scripts/detect.js'];

/**
 * Build the permission entries for a single script. When the resolved path
 * contains whitespace (e.g. on Windows under `C:/Users/Garry Caber/...`),
 * slash commands invoke the script with the path quoted — but Claude Code's
 * permission matcher compares strings literally, so an unquoted entry won't
 * match a quoted invocation. We emit BOTH variants for cross-quoting-style
 * robustness; for paths without whitespace we just emit the bare form.
 */
export function permissionEntries(skillRoot: string, scriptRel: string): string[] {
  const full = posix.join(toPosix(skillRoot), scriptRel);
  if (/\s/.test(full)) {
    return [`Bash(node "${full}":*)`, `Bash(node ${full}:*)`];
  }
  return [`Bash(node ${full}:*)`];
}

/** Back-compat — single canonical entry for callers that don't care about quoting variants. */
export function permissionEntry(skillRoot: string, scriptRel: string): string {
  return permissionEntries(skillRoot, scriptRel)[0]!;
}

export function expectedPermissions(skillRoot: string, features: FeatureId[]): string[] {
  const scripts = new Set<string>(ALWAYS_PERMS);
  for (const f of features) {
    for (const s of FEATURE_PERMISSIONS[f] ?? []) scripts.add(s);
  }
  const out: string[] = [];
  for (const s of scripts) {
    for (const e of permissionEntries(skillRoot, s)) out.push(e);
  }
  return out;
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

      // Remove any prior ui-forge entries (entries pointing into our skill
      // dir). Handles both quoted and unquoted forms.
      const skillPosix = toPosix(paths.skillDir);
      const filtered = allow.filter((e) => {
        return (
          !e.includes(`node ${skillPosix}/scripts/`) &&
          !e.includes(`node "${skillPosix}/scripts/`)
        );
      });
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
  const filtered = allow.filter((e) => {
    return !skillPosix.some(
      (d) => e.includes(`node ${d}/scripts/`) || e.includes(`node "${d}/scripts/`)
    );
  });
  if (filtered.length === allow.length) return false;
  permissions.allow = filtered;
  settings.permissions = permissions;
  writeJson(settingsPath, settings);
  return true;
}

// Re-export RUNTIME_ASSETS so callers can drop it if unused (silences TS unused warning).
export { RUNTIME_ASSETS };
