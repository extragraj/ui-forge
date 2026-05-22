import { loadLockfile, isHookEnabled, isProjectCli } from './lockfile.js';
import { runInit } from './install.js';
import { getSkillVersion } from './registry.js';
export async function runRepair(cwd, flags) {
    const lock = loadLockfile(cwd);
    if (!lock) {
        console.error('No .ui-forge/installed.json found. Run `ui-forge init` first.');
        process.exit(1);
    }
    const current = getSkillVersion();
    if (lock.skillVersion !== current) {
        console.log(`Updating from v${lock.skillVersion} → v${current}…`);
    }
    // Synthesize flags from the lockfile so install runs non-interactively.
    // Features now include 'post-tool-verify-hook' and 'project-cli', so the
    // separate --hooks and --project-cli flags are only needed for pre-1.6.2
    // lockfiles that don't have these in features[].
    const forced = {
        ...flags,
        yes: true,
        scope: lock.scope,
        platforms: lock.platforms,
        features: lock.features,
        theme: lock.theme,
        mcp: lock.mcpClients.length > 0 ? 'on' : 'off',
        mcpClients: lock.mcpClients,
        hooks: isHookEnabled(lock) ? 'on' : 'off',
        projectCli: isProjectCli(lock) ? 'on' : 'off',
        pair: lock.paired ? 'on' : flags.detectPairing ? 'auto' : 'off',
        quickScan: 'off', // don't re-run scan on repair
    };
    await runInit(cwd, forced);
}
