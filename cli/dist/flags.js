const ALIASES = {
    y: 'yes',
    h: 'help',
};
const BOOLEAN_FLAGS = new Set([
    'yes',
    'help',
    'dry-run',
    'prune-unknown',
    'force',
    'force-forgeignore',
    'detect-pairing',
    'theme-override',
    'no-backup',
]);
function readArg(arg, next) {
    let stripped = arg.replace(/^--?/, '');
    if (stripped in ALIASES)
        stripped = ALIASES[stripped];
    if (stripped.includes('=')) {
        const eq = stripped.indexOf('=');
        return { key: stripped.slice(0, eq), value: stripped.slice(eq + 1), consumed: false };
    }
    if (BOOLEAN_FLAGS.has(stripped)) {
        return { key: stripped, value: true, consumed: false };
    }
    if (next === undefined || next.startsWith('-')) {
        return { key: stripped, value: true, consumed: false };
    }
    return { key: stripped, value: next, consumed: true };
}
function csv(value) {
    if (typeof value !== 'string')
        return undefined;
    return value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}
function onoff(value) {
    if (typeof value === 'boolean')
        return value ? 'on' : undefined;
    if (value === 'on' || value === 'off')
        return value;
    return undefined;
}
export function parseFlags(argv) {
    const [command = 'init', ...rest] = argv;
    const positional = [];
    const raw = {};
    for (let i = 0; i < rest.length; i++) {
        const arg = rest[i];
        if (!arg.startsWith('-')) {
            positional.push(arg);
            continue;
        }
        const { key, value, consumed } = readArg(arg, rest[i + 1]);
        raw[key] = value;
        if (consumed)
            i++;
    }
    const pair = (() => {
        const v = raw['pair'];
        if (v === 'auto' || v === 'on' || v === 'off')
            return v;
        return undefined;
    })();
    const scope = (() => {
        const v = raw['scope'];
        if (v === 'project' || v === 'global')
            return v;
        if (v === 'both') {
            console.error("Unknown scope 'both' — use 'project' or 'global'.");
            process.exit(2);
        }
        return undefined;
    })();
    const theme = (() => {
        const v = raw['theme'];
        if (v === 'shadcn' || v === 'mantine' || v === 'plain-tailwind' || v === 'stackshift' || v === 'none')
            return v;
        return undefined;
    })();
    const quickScan = (() => {
        const v = raw['quick-scan'];
        if (v === 'on' || v === 'off' || v === 'auto')
            return v;
        if (v === true)
            return 'on';
        return undefined;
    })();
    return {
        command,
        yes: raw['yes'] === true,
        scope,
        platforms: csv(raw['platforms']),
        features: csv(raw['features']),
        theme,
        pair,
        mcp: onoff(raw['mcp']),
        mcpClients: csv(raw['mcp-clients']),
        hooks: onoff(raw['hooks']),
        projectCli: onoff(raw['project-cli']),
        quickScan,
        pruneUnknown: raw['prune-unknown'] === true,
        dryRun: raw['dry-run'] === true,
        force: raw['force'] === true,
        forceForgeignore: raw['force-forgeignore'] === true,
        detectPairing: raw['detect-pairing'] === true,
        themeOverride: raw['theme-override'] === true,
        noBackup: raw['no-backup'] === true,
        help: raw['help'] === true,
        positional,
        raw,
    };
}
export function printHelp() {
    // eslint-disable-next-line no-console
    console.log(`UI Forge CLI

Usage:
  ui-forge <command> [options]

Commands:
  init        Install or modify UI Forge wiring (interactive by default)
  repair      Re-apply wiring from .ui-forge/installed.json
  doctor      Diagnose the install; use --fix to run a full repair after diagnosis
  uninstall   Remove everything UI Forge wrote
  migrate     Migrate from a pre-1.6.0 install
  mcp-config  Print the MCP server snippet for manual wiring
  ls          Summarize the current install
  version     Print the bundled skill version + source location
  help        Show this help

Common options:
  -y, --yes                Accept defaults non-interactively
  --scope <s>              project | global
  --platforms <csv>        claude,cursor,agents,codex,copilot,gemini
  --features <csv>         scan,forge,verify,export-design,fetch-handoff,
                           mcp-server,post-tool-verify-hook,project-cli
  --theme <t>              shadcn | mantine | plain-tailwind | stackshift | none
  --pair <m>               auto | on | off
  --mcp <on|off>           Enable/disable MCP wiring
  --mcp-clients <csv>      Subset of detected clients to wire
  --hooks <on|off>         PostToolUse verify hook (prefer feature 'post-tool-verify-hook')
  --project-cli <on|off>   Create ./ui-forge.mjs shim (prefer feature 'project-cli')
  --quick-scan <on|off>    Run scan after install (default: prompt interactively)
  --theme-override         (stackshift only) destructive rewrite of globals.css + tailwind.config
  --no-backup              Skip .bak creation when --theme-override runs
  --prune-unknown          Auto-delete unknown files during legacy sweep
  --dry-run                Print plan; write nothing
  --force                  (update) overwrite user-modified files
  --force-forgeignore      Overwrite a user-owned .forgeignore on re-install
  -h, --help               Show this help

Examples:
  ui-forge init
  ui-forge init --yes --features=scan,forge,verify,mcp-server --theme=shadcn
  ui-forge doctor --fix
  ui-forge uninstall
`);
}
