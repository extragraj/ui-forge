/**
 * Lockfile shape and helpers. Stored at `.ui-forge/installed.json`.
 *
 * Schema v2 (1.6.2+):
 *   - `lockfileVersion: 2`
 *   - `files` (was `writtenByFeature`) — grouped file tracking
 *   - `written[]` is computed on load from `files` (not stored)
 *   - `scope` is `'project' | 'global'` (no more `'both'`)
 *   - Removed from saved JSON: `summary`, `hooks`, `projectCli`,
 *     `themeLimited`, `forgeignoreSource`, `pruned` (when empty)
 *   - `patched` entries for the same path are merged into one
 *
 * v1 lockfiles (no `lockfileVersion`) are auto-migrated on load.
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
    const raw = readJsonSafe(lockfilePath(cwd));
    if (!raw)
        return undefined;
    // Resolve `files`: accept both the v2 `files` key and old `writtenByFeature` key
    let files = {};
    if (raw['files'] && typeof raw['files'] === 'object') {
        files = raw['files'];
    }
    else if (raw['writtenByFeature'] && typeof raw['writtenByFeature'] === 'object') {
        files = raw['writtenByFeature'];
    }
    else if (Array.isArray(raw['written'])) {
        // v1 — flat array
        files = { legacy: raw['written'] };
    }
    const written = flattenFiles(files);
    const scope = raw['scope'] === 'global' ? 'global' : 'project';
    if (raw['scope'] === 'both') {
        console.warn('  [lockfile] scope "both" migrated to "project".');
    }
    const features = Array.isArray(raw['features']) ? raw['features'] : ['scan', 'forge'];
    // Derive back-compat boolean fields from features so old consumers still work
    const hooks = raw['hooks'] ?? {
        postToolUseVerify: features.includes('post-tool-verify-hook'),
        stackshiftValidate: Boolean(raw['paired']),
    };
    return {
        lockfileVersion: 2,
        skillVersion: String(raw['skillVersion'] ?? ''),
        installedAt: String(raw['installedAt'] ?? new Date().toISOString()),
        scope,
        platforms: Array.isArray(raw['platforms']) ? raw['platforms'] : ['claude'],
        paired: Boolean(raw['paired']),
        theme: raw['theme'] ?? 'shadcn',
        features,
        mcpClients: Array.isArray(raw['mcpClients']) ? raw['mcpClients'] : [],
        files,
        written,
        patched: Array.isArray(raw['patched']) ? raw['patched'] : [],
        pruned: Array.isArray(raw['pruned']) ? raw['pruned'] : [],
        // Back-compat
        hooks,
        projectCli: Boolean(raw['projectCli'] ?? features.includes('project-cli')),
        themeLimited: Boolean(raw['themeLimited']),
        forgeignoreSource: String(raw['forgeignoreSource'] ?? ''),
    };
}
function flattenFiles(files) {
    const all = [];
    for (const entries of Object.values(files)) {
        for (const e of entries)
            all.push(e);
    }
    return Array.from(new Set(all)).sort();
}
/** Merge multiple PatchedEntry objects for the same path into one. */
function mergePatched(entries) {
    const map = new Map();
    for (const e of entries) {
        if (!map.has(e.path))
            map.set(e.path, new Set());
        for (const k of e.keys)
            map.get(e.path).add(k);
    }
    return Array.from(map.entries()).map(([path, keys]) => ({
        path,
        keys: Array.from(keys).sort(),
    }));
}
export function saveLockfile(cwd, lock) {
    const path = lockfilePath(cwd);
    ensureDir(dirname(path));
    const allWritten = flattenFiles(lock.files);
    // Only store the essential machine-readable fields.
    // Derived/redundant fields (hooks, projectCli, themeLimited, forgeignoreSource,
    // summary) are intentionally omitted to keep the file lean.
    const toSave = {
        lockfileVersion: 2,
        skillVersion: lock.skillVersion,
        installedAt: lock.installedAt,
        scope: lock.scope,
        platforms: lock.platforms,
        paired: lock.paired,
        theme: lock.theme,
        features: lock.features,
        mcpClients: lock.mcpClients,
        files: lock.files,
        // `written` intentionally omitted — derived on load
        patched: mergePatched(lock.patched),
    };
    // Only include pruned when non-empty (avoid noise)
    if (lock.pruned && lock.pruned.length > 0) {
        toSave['pruned'] = lock.pruned;
    }
    // Stamp the total file count as a trailing comment-like field
    toSave['_fileCount'] = allWritten.length;
    writeJson(path, toSave);
}
export function lockfileExists(cwd) {
    return existsSync(lockfilePath(cwd));
}
/** Whether the post-tool-use verify hook is enabled (derives from features). */
export function isHookEnabled(lock) {
    return lock.features.includes('post-tool-verify-hook') || lock.hooks?.postToolUseVerify === true;
}
/** Whether the project-root CLI shim is installed (derives from features). */
export function isProjectCli(lock) {
    return lock.features.includes('project-cli') || lock.projectCli === true;
}
