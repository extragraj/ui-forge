/**
 * Patch each platform's settings.json `permissions.allow` array with one
 * entry per selected script. Deep-merges with existing entries.
 */
import { existsSync } from 'node:fs';
import { posix } from 'node:path';
import { FEATURE_PERMISSIONS, RUNTIME_ASSETS } from '../assets.js';
import { backupOnce, readJson, toPosix, writeJson } from '../fs-utils.js';
import { expandScope, makeRel } from './commands.js';
import { platformById, platformPaths } from '../platforms.js';
const ALWAYS_PERMS = ['scripts/detect.js'];
export function permissionEntry(skillRoot, scriptRel) {
    return `Bash(node ${posix.join(toPosix(skillRoot), scriptRel)}:*)`;
}
export function expectedPermissions(skillRoot, features) {
    const scripts = new Set(ALWAYS_PERMS);
    for (const f of features) {
        for (const s of FEATURE_PERMISSIONS[f] ?? [])
            scripts.add(s);
    }
    return Array.from(scripts).map((s) => permissionEntry(skillRoot, s));
}
export function writePermissions(args) {
    const { cwd, homedir, scope, platformIds, features, dryRun } = args;
    const patched = [];
    const planned = [];
    for (const id of platformIds) {
        const platform = platformById(id);
        if (!platform)
            continue;
        for (const scopeChoice of expandScope(scope)) {
            const paths = platformPaths(cwd, platform, scopeChoice, homedir);
            const entries = expectedPermissions(paths.skillDir, features);
            planned.push({ path: paths.settingsFile, entries });
            if (dryRun)
                continue;
            const existing = existsSync(paths.settingsFile) ? safeReadJson(paths.settingsFile) : {};
            const settings = existing ?? {};
            const permissions = (settings.permissions ?? {});
            const allow = Array.isArray(permissions.allow) ? permissions.allow : [];
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
function safeReadJson(path) {
    try {
        return readJson(path);
    }
    catch {
        return {};
    }
}
/**
 * Remove all permission entries pointing into the given skill dirs.
 * Used by uninstall.
 */
export function removePermissionsForSkill(settingsPath, skillDirs, dryRun) {
    if (!existsSync(settingsPath))
        return false;
    if (dryRun)
        return true;
    const settings = safeReadJson(settingsPath) ?? {};
    const permissions = settings.permissions ?? {};
    const allow = Array.isArray(permissions.allow) ? permissions.allow : [];
    const skillPosix = skillDirs.map((d) => toPosix(d));
    const filtered = allow.filter((e) => !skillPosix.some((d) => e.includes(`node ${d}/scripts/`)));
    if (filtered.length === allow.length)
        return false;
    permissions.allow = filtered;
    settings.permissions = permissions;
    writeJson(settingsPath, settings);
    return true;
}
// Re-export RUNTIME_ASSETS so callers can drop it if unused (silences TS unused warning).
export { RUNTIME_ASSETS };
