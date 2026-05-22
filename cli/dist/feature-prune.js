/**
 * Feature prune — when a user re-runs `init` with fewer optional features
 * selected, delete the files previously written for the removed feature.
 *
 * Rules:
 *  - Required features (REQUIRED_FEATURES) are never pruned.
 *  - File groups in the lockfile that map to a removed optional feature are
 *    deleted; non-feature groups (always, commands, forgeignore, theme,
 *    design-standards) are never pruned by this routine — they're managed by
 *    other code paths (sweep, theme switch, forgeignore write).
 *  - Files shared between retained and removed groups are skipped.
 *  - Each removed file is recorded in the returned list and should be
 *    appended to `lockfile.pruned[]` by the caller.
 */
import { existsSync, readdirSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import { FEATURE_COMMANDS, REQUIRED_FEATURES } from './assets.js';
import { fromPosix, isDirEmpty, pruneEmptyDirs, removeDir, removeFile, toPosix } from './fs-utils.js';
import { PLATFORMS, platformById, platformPaths } from './platforms.js';
import { expandScope, isOwnedCommand, makeRel } from './wiring/commands.js';
import { removePermissionsForSkill } from './wiring/permissions.js';
import { removeHooks } from './wiring/hooks.js';
/**
 * Optional features that can be safely deselected and have file/group impact.
 * Kept in sync with OPTIONAL_FEATURE_IDS in prompts.ts.
 */
const PRUNABLE_GROUPS = [
    'export-design',
    'fetch-handoff',
    // 'post-tool-verify-hook' has no file assets — pruned via removeHooks().
    // 'project-cli' is pruned separately because its file lives at project root.
];
export function prunePriorFeatures(args) {
    const { cwd, priorFiles, nextFeatures, dryRun } = args;
    const removed = [];
    const skipped = [];
    const nextSet = new Set(nextFeatures);
    // Required features cannot be pruned even if somehow absent from `nextFeatures`.
    for (const r of REQUIRED_FEATURES)
        nextSet.add(r);
    // Collect files retained in non-pruned groups so we don't delete shared files.
    const retainedFiles = new Set();
    for (const [group, entries] of Object.entries(priorFiles)) {
        if (!PRUNABLE_GROUPS.includes(group)) {
            for (const e of entries)
                retainedFiles.add(e);
        }
        else if (nextSet.has(group)) {
            for (const e of entries)
                retainedFiles.add(e);
        }
    }
    const now = new Date().toISOString();
    for (const group of PRUNABLE_GROUPS) {
        if (nextSet.has(group))
            continue;
        const entries = priorFiles[group] ?? [];
        for (const rel of entries) {
            if (retainedFiles.has(rel)) {
                skipped.push({ path: rel, reason: 'shared-with-retained-group' });
                continue;
            }
            const abs = isAbsolute(rel) ? rel : join(cwd, fromPosix(rel));
            if (!existsSync(abs)) {
                skipped.push({ path: rel, reason: 'already-missing' });
                continue;
            }
            if (dryRun) {
                console.log(`  would prune: ${rel} (feature '${group}' deselected)`);
                continue;
            }
            try {
                removeFile(abs);
                removed.push({ at: now, path: rel, reason: `feature-deselected: ${group}` });
            }
            catch (err) {
                skipped.push({ path: rel, reason: `error: ${err.message}` });
            }
        }
    }
    return { removed, skipped };
}
/**
 * Delete command files belonging to features that were deselected on re-install.
 * Only removes files that carry the ui-forge provenance header.
 */
export function pruneDeselectedCommands(args) {
    const { cwd, homedir, scope, platformIds, priorFeatures, nextFeatures, dryRun } = args;
    const removed = [];
    const nextSet = new Set(nextFeatures);
    const removedFeatures = priorFeatures.filter((f) => !nextSet.has(f));
    const now = new Date().toISOString();
    for (const feature of removedFeatures) {
        const fileName = FEATURE_COMMANDS[feature];
        if (!fileName)
            continue;
        for (const platformId of platformIds) {
            const platform = platformById(platformId);
            if (!platform)
                continue;
            for (const scopeChoice of expandScope(scope)) {
                const paths = platformPaths(cwd, platform, scopeChoice, homedir);
                const absPath = join(paths.commandsDir, fileName);
                if (!isOwnedCommand(absPath))
                    continue;
                const rel = toPosix(makeRel(cwd, absPath, scopeChoice));
                if (dryRun) {
                    console.log(`  would prune command: ${rel} (feature '${feature}' deselected)`);
                    continue;
                }
                try {
                    removeFile(absPath);
                    removed.push({ at: now, path: rel, reason: `feature-deselected: ${feature}` });
                    pruneEmptyDirs(paths.commandsDir);
                }
                catch {
                    // non-fatal
                }
            }
        }
    }
    return removed;
}
/**
 * Delete skill files, command files, permissions, and hooks for platforms
 * that were deselected on re-install. Uses the lockfile to identify owned
 * skill files; uses provenance headers to identify owned command files.
 */
export function prunePlatforms(args) {
    const { cwd, homedir, priorScope, priorPlatforms, nextPlatforms, priorFiles, dryRun } = args;
    const removed = [];
    const skipped = [];
    const nextSet = new Set(nextPlatforms);
    const removedIds = priorPlatforms.filter((id) => !nextSet.has(id));
    const allLockPaths = Object.values(priorFiles).flat();
    const now = new Date().toISOString();
    for (const removedId of removedIds) {
        const platform = platformById(removedId);
        if (!platform)
            continue;
        const paths = platformPaths(cwd, platform, priorScope, homedir);
        // Skill dir prefix as stored in the lockfile (absolute for global, relative for project)
        const skillPrefix = priorScope === 'global'
            ? toPosix(paths.skillDir)
            : toPosix(relative(cwd, paths.skillDir));
        // 1. Skill files tracked in the lockfile
        for (const lockedPath of allLockPaths) {
            const posixLocked = toPosix(lockedPath);
            if (!posixLocked.startsWith(skillPrefix + '/') && posixLocked !== skillPrefix)
                continue;
            const abs = priorScope === 'global'
                ? fromPosix(lockedPath)
                : join(cwd, fromPosix(lockedPath));
            if (!existsSync(abs)) {
                skipped.push({ path: lockedPath, reason: 'already-missing' });
                continue;
            }
            if (dryRun) {
                console.log(`  would prune: ${lockedPath} (platform '${removedId}' deselected)`);
                continue;
            }
            try {
                removeFile(abs);
                removed.push({ at: now, path: lockedPath, reason: `platform-deselected: ${removedId}` });
            }
            catch (err) {
                skipped.push({ path: lockedPath, reason: `error: ${err.message}` });
            }
        }
        if (!dryRun) {
            pruneEmptyDirs(paths.skillDir);
            // Remove the skill dir itself when all tracked files have been cleaned up.
            if (existsSync(paths.skillDir) && isDirEmpty(paths.skillDir)) {
                removeDir(paths.skillDir);
            }
        }
        // 2. Command files — identified by provenance header, not lockfile
        if (existsSync(paths.commandsDir)) {
            let cmdFiles = [];
            try {
                cmdFiles = readdirSync(paths.commandsDir).filter((f) => f.startsWith('forge') && f.endsWith('.md'));
            }
            catch { /* ignore */ }
            for (const file of cmdFiles) {
                const abs = join(paths.commandsDir, file);
                if (!isOwnedCommand(abs))
                    continue;
                const rel = toPosix(makeRel(cwd, abs, priorScope));
                if (dryRun) {
                    console.log(`  would prune command: ${rel} (platform '${removedId}' deselected)`);
                    continue;
                }
                try {
                    removeFile(abs);
                    removed.push({ at: now, path: rel, reason: `platform-deselected: ${removedId}` });
                }
                catch (err) {
                    skipped.push({ path: rel, reason: `error: ${err.message}` });
                }
            }
            if (!dryRun)
                pruneEmptyDirs(paths.commandsDir);
        }
        // 3. Permissions
        removePermissionsForSkill(paths.settingsFile, [paths.skillDir], dryRun);
        // 4. Hooks
        removeHooks(paths.settingsFile, dryRun);
    }
    return { removed, skipped };
}
/**
 * Scan every selected platform's commands dir for `forge-*.md` files whose
 * feature is not in the current selection, and remove provenance-owned ones.
 *
 * Runs unconditionally on every install (does not depend on a prior-vs-next
 * feature diff), so stale command files from pre-1.6.6 installs — where the
 * lockfile was already updated past the diff window — still get cleaned up.
 */
export function pruneOrphanedCommands(args) {
    const { cwd, homedir, scope, platformIds, nextFeatures, dryRun } = args;
    const removed = [];
    const now = new Date().toISOString();
    // file-name → owning-feature, inverted from FEATURE_COMMANDS
    const ownerByFile = new Map();
    for (const [feature, fileName] of Object.entries(FEATURE_COMMANDS)) {
        if (fileName)
            ownerByFile.set(fileName, feature);
    }
    const nextSet = new Set(nextFeatures);
    for (const platformId of platformIds) {
        const platform = platformById(platformId);
        if (!platform)
            continue;
        for (const scopeChoice of expandScope(scope)) {
            const paths = platformPaths(cwd, platform, scopeChoice, homedir);
            if (!existsSync(paths.commandsDir))
                continue;
            let files = [];
            try {
                files = readdirSync(paths.commandsDir).filter((f) => f.startsWith('forge') && f.endsWith('.md'));
            }
            catch {
                continue;
            }
            for (const file of files) {
                const owner = ownerByFile.get(file);
                if (!owner)
                    continue; // unknown command file → leave alone
                if (nextSet.has(owner))
                    continue; // feature still selected → keep
                const abs = join(paths.commandsDir, file);
                if (!isOwnedCommand(abs))
                    continue; // user-customized → preserve
                const rel = toPosix(makeRel(cwd, abs, scopeChoice));
                if (dryRun) {
                    console.log(`  would prune orphaned command: ${rel} (feature '${owner}' not selected)`);
                    continue;
                }
                try {
                    removeFile(abs);
                    removed.push({ at: now, path: rel, reason: `orphan-feature: ${owner}` });
                }
                catch { /* non-fatal */ }
            }
            if (!dryRun)
                pruneEmptyDirs(paths.commandsDir);
        }
    }
    return removed;
}
/**
 * Scan every known platform's skill dir and clean up any that exist on disk
 * but are NOT in `nextPlatforms`. This catches stale installs from runs
 * before lockfile platform tracking was complete — the lockfile may already
 * show the correct (narrower) platform list while the old skill dirs remain.
 *
 * Safety: only removes dirs that contain `scripts/scan.js` or `SKILL.md`
 * (ui-forge sentinel files). Never removes a dir that doesn't look like a
 * ui-forge install.
 */
export function pruneOrphanedSkillDirs(args) {
    const { cwd, homedir, scope, nextPlatforms, dryRun } = args;
    const removed = [];
    const skipped = [];
    const nextSet = new Set(nextPlatforms);
    const now = new Date().toISOString();
    for (const platform of PLATFORMS) {
        if (nextSet.has(platform.id))
            continue;
        const paths = platformPaths(cwd, platform, scope, homedir);
        if (!existsSync(paths.skillDir))
            continue;
        // Safety check: only remove if it looks like a ui-forge install.
        const hasSentinel = existsSync(join(paths.skillDir, 'scripts', 'scan.js')) ||
            existsSync(join(paths.skillDir, 'SKILL.md'));
        if (!hasSentinel) {
            skipped.push({ path: toPosix(paths.skillDir), reason: 'no-ui-forge-sentinel' });
            continue;
        }
        const rel = toPosix(makeRel(cwd, paths.skillDir, scope));
        if (dryRun) {
            console.log(`  would prune orphaned skill dir: ${rel} (platform '${platform.id}' not selected)`);
        }
        else {
            try {
                removeDir(paths.skillDir);
                removed.push({ at: now, path: rel, reason: `orphaned-platform: ${platform.id}` });
                // Prune parent (skills/) if now empty
                const parent = join(paths.skillDir, '..');
                if (existsSync(parent) && isDirEmpty(parent))
                    removeDir(parent);
            }
            catch (err) {
                skipped.push({ path: rel, reason: `error: ${err.message}` });
            }
        }
        // Clean owned command files
        if (existsSync(paths.commandsDir)) {
            let cmdFiles = [];
            try {
                cmdFiles = readdirSync(paths.commandsDir).filter((f) => f.startsWith('forge') && f.endsWith('.md'));
            }
            catch { /* ignore */ }
            for (const file of cmdFiles) {
                const abs = join(paths.commandsDir, file);
                if (!isOwnedCommand(abs))
                    continue;
                const cmdRel = toPosix(makeRel(cwd, abs, scope));
                if (dryRun) {
                    console.log(`  would prune orphaned command: ${cmdRel} (platform '${platform.id}' not selected)`);
                    continue;
                }
                try {
                    removeFile(abs);
                    removed.push({ at: now, path: cmdRel, reason: `orphaned-platform: ${platform.id}` });
                }
                catch { /* non-fatal */ }
            }
            if (!dryRun)
                pruneEmptyDirs(paths.commandsDir);
        }
        // Clean permissions and hooks
        removePermissionsForSkill(paths.settingsFile, [paths.skillDir], dryRun);
        removeHooks(paths.settingsFile, dryRun);
    }
    return { removed, skipped };
}
/**
 * Prune the project-root `ui-forge.mjs` shim when project-cli is deselected.
 * Returns true if the file was removed. Lives outside the group-prune loop
 * because the shim is a single known path, not a group of skill-dir files.
 */
export function pruneProjectCli(args) {
    const { cwd, prior, next, dryRun } = args;
    if (!prior || next)
        return null;
    const path = join(cwd, 'ui-forge.mjs');
    if (!existsSync(path))
        return null;
    if (dryRun) {
        console.log(`  would prune: ui-forge.mjs (feature 'project-cli' deselected)`);
        return null;
    }
    try {
        removeFile(path);
        return { at: new Date().toISOString(), path: 'ui-forge.mjs', reason: 'feature-deselected: project-cli' };
    }
    catch {
        return null;
    }
}
