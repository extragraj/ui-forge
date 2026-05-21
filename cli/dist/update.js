import { runRepair } from './repair.js';
import { getSkillVersion } from './registry.js';
import { loadLockfile } from './lockfile.js';
export async function runUpdate(cwd, flags) {
    const lock = loadLockfile(cwd);
    if (!lock) {
        console.error('No .ui-forge/installed.json found. Run `ui-forge init` first.');
        process.exit(1);
    }
    const current = getSkillVersion();
    if (lock.skillVersion === current) {
        console.log(`Already at v${current}. Nothing to update.`);
        if (!flags.force)
            return;
    }
    console.log(`Updating from v${lock.skillVersion} → v${current}…`);
    await runRepair(cwd, flags);
}
