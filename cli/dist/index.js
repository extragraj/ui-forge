#!/usr/bin/env node
/**
 * UI Forge CLI router. Dispatches commands to handlers in this dir.
 */
import { parseFlags, printHelp } from './flags.js';
import { runInit } from './install.js';
import { runRepair } from './repair.js';
import { runDoctor } from './doctor.js';
import { runUninstall } from './uninstall.js';
import { runMigrate } from './migrate.js';
import { runLs } from './ls.js';
import { runMcpConfig } from './mcp-config.js';
import { getSkillVersion, getSkillSourceRoot } from './registry.js';
async function main() {
    const argv = process.argv.slice(2);
    const flags = parseFlags(argv);
    const cwd = process.cwd();
    if (flags.help || flags.command === 'help' || flags.command === '--help' || flags.command === '-h') {
        printHelp();
        return;
    }
    if (flags.command === 'version' || flags.command === '--version' || flags.command === '-v') {
        console.log(`ui-forge ${getSkillVersion()}`);
        console.log(`source: ${getSkillSourceRoot()}`);
        return;
    }
    switch (flags.command) {
        case 'init':
            await runInit(cwd, flags);
            return;
        case 'repair':
            await runRepair(cwd, flags);
            return;
        case 'update':
            console.warn('`ui-forge update` is deprecated. Use `ui-forge repair` instead.');
            await runRepair(cwd, flags);
            return;
        case 'doctor':
            await runDoctor(cwd, flags);
            return;
        case 'uninstall':
            await runUninstall(cwd, flags);
            return;
        case 'migrate':
            await runMigrate(cwd, flags);
            return;
        case 'ls':
            runLs(cwd);
            return;
        case 'mcp-config':
            runMcpConfig(cwd);
            return;
        default:
            console.error(`Unknown command: ${flags.command}\n`);
            printHelp();
            process.exit(1);
    }
}
main().catch((err) => {
    console.error(err instanceof Error ? err.stack ?? err.message : String(err));
    process.exit(1);
});
