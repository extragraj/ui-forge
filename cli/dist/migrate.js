/**
 * `migrate` — one-shot migration from the pre-1.6.0 `scripts/cli.js install`
 * layout. Detects pre-existing `commands/forge-*.md` files, normalizes them
 * into the new wiring, and writes the lockfile.
 */
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { lockfileExists } from './lockfile.js';
import { detectPlatforms, platformPaths } from './platforms.js';
import { runInit } from './install.js';
export async function runMigrate(cwd, flags) {
    if (lockfileExists(cwd)) {
        console.log('Already migrated — .ui-forge/installed.json exists. Nothing to do.');
        return;
    }
    const detected = detectPlatforms(cwd);
    if (detected.length === 0) {
        console.error('No platform directories detected — cannot infer migration source.');
        process.exit(1);
    }
    // Infer features from existing slash command files.
    const home = homedir();
    const featureMap = {
        'forge.md': 'forge',
        'forge-scan.md': 'scan',
        'forge-verify.md': 'verify',
        'forge-export-design.md': 'export-design',
        'forge-handoff.md': 'fetch-handoff',
    };
    const featuresSet = new Set(['scan', 'forge']);
    for (const platform of detected) {
        for (const scope of ['project', 'global']) {
            const paths = platformPaths(cwd, platform, scope, home);
            if (!existsSync(paths.commandsDir))
                continue;
            for (const file of readdirSync(paths.commandsDir)) {
                const feat = featureMap[file];
                if (feat)
                    featuresSet.add(feat);
            }
        }
    }
    const features = Array.from(featuresSet);
    console.log(`Migration: detected platforms=${detected.map((p) => p.id).join(',')} features=${features.join(',')}`);
    console.log('Running init with detected selections…');
    await runInit(cwd, {
        ...flags,
        yes: true,
        scope: 'project',
        platforms: detected.map((p) => p.id),
        features,
        theme: flags.theme ?? 'shadcn',
        pair: flags.pair ?? 'auto',
        projectCli: flags.projectCli ?? 'on',
        mcp: flags.mcp ?? 'off',
        hooks: flags.hooks ?? 'off',
    });
    console.log('Migration complete.');
}
