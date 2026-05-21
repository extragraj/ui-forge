import { loadLockfile } from './lockfile.js';
import { runInit } from './install.js';
export async function runRepair(cwd, flags) {
    const lock = loadLockfile(cwd);
    if (!lock) {
        console.error('No .ui-forge/installed.json found. Run `ui-forge init` first.');
        process.exit(1);
    }
    // Synthesize flags from the lockfile so install runs non-interactively.
    const forced = {
        ...flags,
        yes: true,
        scope: lock.scope,
        platforms: lock.platforms,
        features: lock.features,
        theme: lock.theme,
        mcp: lock.mcpClients.length > 0 ? 'on' : 'off',
        mcpClients: lock.mcpClients,
        hooks: lock.hooks.postToolUseVerify ? 'on' : 'off',
        projectCli: lock.projectCli ? 'on' : 'off',
        pair: lock.paired ? 'on' : flags.detectPairing ? 'auto' : 'off',
    };
    await runInit(cwd, forced);
}
