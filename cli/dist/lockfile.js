/**
 * Lockfile shape and helpers. Stored at `.ui-forge/installed.json`.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ensureDir, readJsonSafe, writeJson } from './fs-utils.js';
export const LOCKFILE_DIR = '.ui-forge';
export const LOCKFILE_NAME = 'installed.json';
export function lockfilePath(cwd) {
    return join(cwd, LOCKFILE_DIR, LOCKFILE_NAME);
}
export function loadLockfile(cwd) {
    return readJsonSafe(lockfilePath(cwd));
}
export function saveLockfile(cwd, lock) {
    const path = lockfilePath(cwd);
    ensureDir(dirname(path));
    writeJson(path, lock);
}
export function lockfileExists(cwd) {
    return existsSync(lockfilePath(cwd));
}
