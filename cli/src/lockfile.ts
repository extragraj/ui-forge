/**
 * Lockfile shape and helpers. Stored at `.ui-forge/installed.json`.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { FeatureId, ThemeId } from './assets.js';
import { ensureDir, readJsonSafe, writeJson } from './fs-utils.js';

export interface PatchedEntry {
  path: string;
  keys: string[];
}

export interface PrunedEntry {
  at: string;
  path: string;
  reason: string;
}

export interface Lockfile {
  skillVersion: string;
  installedAt: string;
  scope: 'project' | 'global' | 'both';
  platforms: string[];
  paired: boolean;
  theme: ThemeId;
  themeLimited: boolean;
  features: FeatureId[];
  mcpClients: string[];
  hooks: { postToolUseVerify: boolean; stackshiftValidate: boolean };
  projectCli: boolean;
  forgeignoreSource: string;
  written: string[];
  patched: PatchedEntry[];
  pruned: PrunedEntry[];
}

export const LOCKFILE_DIR = '.ui-forge';
export const LOCKFILE_NAME = 'installed.json';

export function lockfilePath(cwd: string): string {
  return join(cwd, LOCKFILE_DIR, LOCKFILE_NAME);
}

export function loadLockfile(cwd: string): Lockfile | undefined {
  return readJsonSafe<Lockfile>(lockfilePath(cwd));
}

export function saveLockfile(cwd: string, lock: Lockfile): void {
  const path = lockfilePath(cwd);
  ensureDir(dirname(path));
  writeJson(path, lock);
}

export function lockfileExists(cwd: string): boolean {
  return existsSync(lockfilePath(cwd));
}
