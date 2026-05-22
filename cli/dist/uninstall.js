/**
 * `uninstall` — remove everything UI Forge wrote. Tracked via lockfile
 * `written[]` and `patched[]`. Never touches `design/`, `scripts/`, or
 * user code.
 */
import * as p from '@clack/prompts';
import { existsSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { fromPosix, removeFile, removeDir } from './fs-utils.js';
import { loadLockfile, lockfilePath } from './lockfile.js';
import { removeHooks } from './wiring/hooks.js';
import { removeMcp } from './wiring/mcp.js';
import { removePermissionsForSkill } from './wiring/permissions.js';
import { platformById, platformPaths } from './platforms.js';
import { expandScope } from './wiring/commands.js';
export async function runUninstall(cwd, flags) {
    const lock = loadLockfile(cwd);
    if (!lock) {
        console.error('No .ui-forge/installed.json found. Nothing to uninstall.');
        process.exit(1);
    }
    if (!flags.yes) {
        p.intro('UI Forge Uninstall');
        const fileCount = lock.written.length;
        const confirm = await p.confirm({
            message: `This will remove all UI Forge files and wiring (${fileCount} files, ${lock.patched.length} patched configs). Continue?`,
            initialValue: false,
        });
        if (p.isCancel(confirm) || !confirm) {
            p.cancel('Aborted.');
            process.exit(0);
        }
    }
    // 1. Remove tracked files.
    let removed = 0;
    for (const rel of lock.written) {
        const abs = isAbsolute(rel) ? rel : join(cwd, fromPosix(rel));
        if (!existsSync(abs))
            continue;
        if (flags.dryRun) {
            console.log(`  would remove: ${abs}`);
            continue;
        }
        removeFile(abs);
        removed++;
    }
    // 2. Remove patches from settings/MCP files (entries pointing into our skill dirs).
    const home = homedir();
    const skillDirs = [];
    for (const id of lock.platforms) {
        const platform = platformById(id);
        if (!platform)
            continue;
        for (const scope of expandScope(lock.scope)) {
            const paths = platformPaths(cwd, platform, scope, home);
            skillDirs.push(paths.skillDir);
            removePermissionsForSkill(paths.settingsFile, [paths.skillDir], flags.dryRun);
            removeHooks(paths.settingsFile, flags.dryRun);
        }
    }
    // 3. Remove MCP entries.
    if (lock.mcpClients.length > 0) {
        removeMcp({
            homedir: home,
            appdata: process.env.APPDATA,
            platform: process.platform,
            clientIds: lock.mcpClients,
            dryRun: flags.dryRun,
        });
    }
    // 4. Remove each platform's skill dir if empty.
    for (const dir of skillDirs) {
        if (existsSync(dir)) {
            if (flags.dryRun) {
                console.log(`  would clean: ${dir}`);
            }
            else {
                removeDir(dir);
            }
        }
    }
    // 5. Project-root shim + lockfile dir.
    const shim = join(cwd, 'ui-forge.mjs');
    if (existsSync(shim) && !flags.dryRun)
        removeFile(shim);
    if (!flags.dryRun) {
        const lockDir = dirname(lockfilePath(cwd));
        if (existsSync(lockDir))
            rmSync(lockDir, { recursive: true, force: true });
    }
    console.log(`UI Forge uninstalled. Removed ${removed} file(s).`);
}
