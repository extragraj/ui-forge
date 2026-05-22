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
/**
 * Build the permission entries for a single script. When the resolved path
 * contains whitespace (e.g. on Windows under `C:/Users/Garry Caber/...`),
 * slash commands invoke the script with the path quoted — but Claude Code's
 * permission matcher compares strings literally, so an unquoted entry won't
 * match a quoted invocation. We emit BOTH variants for cross-quoting-style
 * robustness; for paths without whitespace we just emit the bare form.
 */
export function permissionEntries(skillRoot, scriptRel) {
    const full = posix.join(toPosix(skillRoot), scriptRel);
    if (/\s/.test(full)) {
        return [`Bash(node "${full}":*)`, `Bash(node ${full}:*)`];
    }
    return [`Bash(node ${full}:*)`];
}
/** Back-compat — single canonical entry for callers that don't care about quoting variants. */
export function permissionEntry(skillRoot, scriptRel) {
    return permissionEntries(skillRoot, scriptRel)[0];
}
export function expectedPermissions(skillRoot, features) {
    const scripts = new Set(ALWAYS_PERMS);
    for (const f of features) {
        for (const s of FEATURE_PERMISSIONS[f] ?? [])
            scripts.add(s);
    }
    const out = [];
    for (const s of scripts) {
        for (const e of permissionEntries(skillRoot, s))
            out.push(e);
    }
    return out;
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
            // Remove any prior ui-forge entries (entries pointing into our skill
            // dir). Handles both quoted and unquoted forms.
            const skillPosix = toPosix(paths.skillDir);
            const filtered = allow.filter((e) => {
                return (!e.includes(`node ${skillPosix}/scripts/`) &&
                    !e.includes(`node "${skillPosix}/scripts/`));
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
    const filtered = allow.filter((e) => {
        return !skillPosix.some((d) => e.includes(`node ${d}/scripts/`) || e.includes(`node "${d}/scripts/`));
    });
    if (filtered.length === allow.length)
        return false;
    permissions.allow = filtered;
    settings.permissions = permissions;
    writeJson(settingsPath, settings);
    return true;
}
// Re-export RUNTIME_ASSETS so callers can drop it if unused (silences TS unused warning).
export { RUNTIME_ASSETS };
