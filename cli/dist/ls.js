/**
 * `ls` — print a summary of the current install.
 */
import { loadLockfile } from './lockfile.js';
export function runLs(cwd) {
    const lock = loadLockfile(cwd);
    if (!lock) {
        console.error('No .ui-forge/installed.json found.');
        process.exit(1);
    }
    console.log(`UI Forge ${lock.skillVersion} — installed ${lock.installedAt}`);
    console.log(`  Scope:       ${lock.scope}`);
    console.log(`  Platforms:   ${lock.platforms.join(', ')}`);
    console.log(`  Features:    ${lock.features.join(', ')}`);
    console.log(`  Theme:       ${lock.theme}${lock.themeLimited ? ' (limited)' : ''}`);
    console.log(`  Paired:      ${lock.paired}`);
    console.log(`  MCP clients: ${lock.mcpClients.join(', ') || '(none)'}`);
    console.log(`  Hooks:       verify=${lock.hooks.postToolUseVerify} stackshift=${lock.hooks.stackshiftValidate}`);
    console.log(`  Project shim: ${lock.projectCli ? './ui-forge.mjs' : '(none)'}`);
    console.log(`  Written:     ${lock.written.length} file(s)`);
    console.log(`  Patched:     ${lock.patched.length} config(s)`);
}
