/**
 * Patch MCP client configs to register ui-forge as a server. Auto-skips
 * clients whose config file doesn't exist. All paths via os.homedir() /
 * process.env.APPDATA — never hardcoded.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { atomicWrite, backupOnce, ensureDir, readJson, toPosix, writeJson } from '../fs-utils.js';
const CLIENTS = [
    {
        id: 'claude-code',
        label: 'Claude Code',
        configPath: ({ home }) => join(home, '.claude.json'),
        format: 'json',
        jsonKey: 'mcpServers',
    },
    {
        id: 'cursor',
        label: 'Cursor',
        configPath: ({ home }) => join(home, '.cursor', 'mcp.json'),
        format: 'json',
        jsonKey: 'mcpServers',
    },
    {
        id: 'codex',
        label: 'Codex',
        configPath: ({ home }) => join(home, '.codex', 'config.toml'),
        format: 'toml',
    },
    {
        id: 'cline',
        label: 'Cline (VS Code)',
        configPath: ({ home, appdata, platform }) => {
            if (appdata) {
                return join(appdata, 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json');
            }
            if (platform === 'darwin') {
                return join(home, 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json');
            }
            return join(home, '.config', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json');
        },
        format: 'json',
        jsonKey: 'mcpServers',
    },
];
export function writeMcp(args) {
    const { homedir, appdata, platform, skillDir, clientIds, dryRun, nodePath } = args;
    const patched = [];
    const planned = [];
    // Cline (and other VS Code-embedded MCP hosts) on Windows often launch
    // servers without inheriting a shell PATH, so bare `node` may not resolve.
    // Default to the absolute path of the currently-running node binary.
    const resolvedNode = nodePath ?? process.execPath ?? 'node';
    const nodeForConfig = toPosix(resolvedNode);
    for (const client of CLIENTS) {
        if (!clientIds.includes(client.id))
            continue;
        const path = client.configPath({ home: homedir, appdata, platform });
        if (!existsSync(path)) {
            // Create minimal config so the MCP entry can be patched in below.
            if (dryRun) {
                planned.push({ path, client: client.id });
                continue;
            }
            ensureDir(dirname(path));
            writeJson(path, { mcpServers: {} });
        }
        planned.push({ path, client: client.id });
        if (dryRun)
            continue;
        const mcpServerScript = toPosix(join(skillDir, 'scripts', 'mcp-server.js'));
        if (client.format === 'json' && client.jsonKey) {
            backupOnce(path);
            const config = safeReadJson(path);
            const root = config ?? {};
            const servers = (root[client.jsonKey] ?? {});
            servers['ui-forge'] = { command: nodeForConfig, args: [mcpServerScript] };
            root[client.jsonKey] = servers;
            writeJson(path, root);
            patched.push({ path, keys: [`${client.jsonKey}.ui-forge`] });
        }
        else if (client.format === 'toml') {
            backupOnce(path);
            const existing = readFileSync(path, 'utf8');
            // TOML escapes: forward slashes are fine; embed paths verbatim.
            const block = `\n[mcp_servers.ui-forge]\ncommand = "${nodeForConfig}"\nargs = ["${mcpServerScript}"]\n`;
            const cleaned = existing.replace(/\n\[mcp_servers\.ui-forge\][\s\S]*?(?=\n\[|\Z)/g, '');
            atomicWrite(path, cleaned + block);
            patched.push({ path, keys: ['mcp_servers.ui-forge'] });
        }
    }
    return { patched, planned };
}
function safeReadJson(path) {
    try {
        return readJson(path);
    }
    catch {
        return {};
    }
}
/**
 * Remove the ui-forge entry from each client config.
 */
export function removeMcp(args) {
    const removed = [];
    for (const client of CLIENTS) {
        if (!args.clientIds.includes(client.id))
            continue;
        const path = client.configPath({ home: args.homedir, appdata: args.appdata, platform: args.platform });
        if (!existsSync(path))
            continue;
        if (args.dryRun) {
            removed.push(path);
            continue;
        }
        if (client.format === 'json' && client.jsonKey) {
            const root = safeReadJson(path) ?? {};
            const servers = root[client.jsonKey] ?? {};
            if ('ui-forge' in servers) {
                delete servers['ui-forge'];
                root[client.jsonKey] = servers;
                writeJson(path, root);
                removed.push(path);
            }
        }
        else if (client.format === 'toml') {
            const existing = readFileSync(path, 'utf8');
            const next = existing.replace(/\n\[mcp_servers\.ui-forge\][\s\S]*?(?=\n\[|\Z)/g, '');
            if (next !== existing) {
                atomicWrite(path, next);
                removed.push(path);
            }
        }
    }
    return removed;
}
export function listMcpClients() {
    return CLIENTS.slice();
}
export function mcpSnippet(skillDir, nodePath) {
    const script = toPosix(join(skillDir, 'scripts', 'mcp-server.js'));
    const node = toPosix(nodePath ?? process.execPath ?? 'node');
    return JSON.stringify({ mcpServers: { 'ui-forge': { command: node, args: [script] } } }, null, 2);
}
