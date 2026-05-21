/**
 * Optional PostToolUse hook for auto-running verify after edits.
 * Patches each platform's settings.json hooks array.
 */
import { existsSync } from 'node:fs';
import { posix } from 'node:path';
import { backupOnce, readJson, toPosix, writeJson } from '../fs-utils.js';
import { expandScope, makeRel } from './commands.js';
import { platformById, platformPaths } from '../platforms.js';
const HOOK_MARKER = 'ui-forge:verify-after-edit';
const PAIRED_MARKER = 'ui-forge:stackshift-validate';
export function writeHooks(args) {
    const { cwd, homedir, scope, platformIds, paired, enabled, dryRun } = args;
    const patched = [];
    for (const id of platformIds) {
        const platform = platformById(id);
        if (!platform)
            continue;
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
            const settings = existing ?? {};
            const hooks = (settings.hooks ?? {});
            let post = Array.isArray(hooks.PostToolUse) ? hooks.PostToolUse : [];
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
            if (existsSync(paths.settingsFile))
                backupOnce(paths.settingsFile);
            writeJson(paths.settingsFile, settings);
            patched.push({
                path: toPosix(makeRel(cwd, paths.settingsFile, scopeChoice)),
                keys: ['hooks.PostToolUse'],
            });
        }
    }
    return { patched };
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
 * Remove ui-forge hooks from a settings file. Used by uninstall.
 */
export function removeHooks(settingsPath, dryRun) {
    if (!existsSync(settingsPath))
        return false;
    if (dryRun)
        return true;
    const settings = safeReadJson(settingsPath) ?? {};
    const hooks = settings.hooks ?? {};
    const post = Array.isArray(hooks.PostToolUse) ? hooks.PostToolUse : [];
    const filtered = post.filter((h) => h.id !== HOOK_MARKER && h.id !== PAIRED_MARKER);
    if (filtered.length === post.length)
        return false;
    hooks.PostToolUse = filtered;
    settings.hooks = hooks;
    writeJson(settingsPath, settings);
    return true;
}
