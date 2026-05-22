/**
 * `doctor` — diagnose the current install. Read-only by default; `--fix`
 * performs the legacy sweep and prunes stale wiring.
 */
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { sweep } from './legacy-sweep.js';
import { loadLockfile } from './lockfile.js';
import { runRepair } from './repair.js';
import { platformById, platformPaths } from './platforms.js';
import { getSkillVersion } from './registry.js';
import { expandScope } from './wiring/commands.js';
export async function runDoctor(cwd, flags) {
    const fix = flags.raw['fix'] === true;
    const checks = [];
    // 1. Node version.
    const node = process.version;
    const major = parseInt(node.replace(/^v/, '').split('.')[0], 10);
    checks.push({
        name: 'node >= 18',
        ok: major >= 18,
        detail: node,
    });
    // 2. Lockfile present.
    const lock = loadLockfile(cwd);
    checks.push({
        name: 'lockfile present (.ui-forge/installed.json)',
        ok: !!lock,
        detail: lock ? `v${lock.skillVersion}` : 'missing',
    });
    if (!lock) {
        report(checks);
        if (!checks.every((c) => c.ok))
            process.exit(1);
        return;
    }
    // 3. Skill scripts exist for each platform.
    const home = homedir();
    for (const id of lock.platforms) {
        const platform = platformById(id);
        if (!platform) {
            checks.push({ name: `platform: ${id}`, ok: false, detail: 'unknown platform id' });
            continue;
        }
        for (const scope of expandScope(lock.scope)) {
            const paths = platformPaths(cwd, platform, scope, home);
            const invokePath = join(paths.skillDir, 'scripts', 'invoke.js');
            checks.push({
                name: `${id} (${scope}): scripts/invoke.js exists`,
                ok: existsSync(invokePath),
                detail: invokePath,
            });
            // Settings file.
            checks.push({
                name: `${id} (${scope}): settings.json exists`,
                ok: existsSync(paths.settingsFile),
                detail: paths.settingsFile,
            });
        }
    }
    // 4. Version drift.
    const current = getSkillVersion();
    checks.push({
        name: 'skill.version matches lockfile',
        ok: lock.skillVersion === current,
        detail: lock.skillVersion === current ? current : `lock=${lock.skillVersion}, current=${current}`,
    });
    // 5. Paired marker matches.
    const paired = existsSync(join(cwd, '.stackshift', 'installed.json'));
    if (lock.paired && !paired) {
        checks.push({ name: 'paired flag matches .stackshift', ok: false, detail: 'lock says paired but .stackshift missing' });
    }
    else if (!lock.paired && paired) {
        checks.push({ name: 'paired flag matches .stackshift', ok: false, detail: '.stackshift exists but lock says unpaired — run `ui-forge repair`' });
    }
    else {
        checks.push({ name: 'paired flag matches .stackshift', ok: true });
    }
    // 6. Legacy sweep (read-only — always 'report' mode; --fix triggers repair below).
    for (const id of lock.platforms) {
        const platform = platformById(id);
        if (!platform)
            continue;
        for (const scope of expandScope(lock.scope)) {
            const paths = platformPaths(cwd, platform, scope, home);
            const sweepResult = sweep({
                skillDir: paths.skillDir,
                features: lock.features,
                theme: lock.theme,
                paired: lock.paired,
                mode: 'report',
            });
            if (sweepResult.kept.some((k) => k.reason.startsWith('would-delete'))) {
                const cnt = sweepResult.kept.filter((k) => k.reason.startsWith('would-delete')).length;
                checks.push({
                    name: `${id} (${scope}): legacy sweep`,
                    ok: false,
                    detail: `${cnt} legacy file(s) detected — run \`ui-forge doctor --fix\``,
                });
            }
            else {
                checks.push({ name: `${id} (${scope}): legacy sweep`, ok: true });
            }
        }
    }
    report(checks);
    if (fix) {
        console.log('\nRunning repair…');
        await runRepair(cwd, flags);
        return;
    }
    if (!checks.every((c) => c.ok))
        process.exit(1);
}
function report(checks) {
    console.log('\nUI Forge Doctor');
    console.log('═══════════════');
    for (const c of checks) {
        const icon = c.ok ? 'OK ' : 'FAIL';
        console.log(`  [${icon}] ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
    }
    const ok = checks.filter((c) => c.ok).length;
    const total = checks.length;
    console.log(`\n${ok}/${total} checks passed.\n`);
}
