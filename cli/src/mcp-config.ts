/**
 * `mcp-config` — print the MCP server snippet for manual wiring.
 */
import { homedir } from 'node:os';
import { loadLockfile } from './lockfile.js';
import { mcpSnippet } from './wiring/mcp.js';
import { platformById, platformPaths } from './platforms.js';
import { expandScope } from './wiring/commands.js';

export function runMcpConfig(cwd: string): void {
  const lock = loadLockfile(cwd);
  if (!lock) {
    console.error('No .ui-forge/installed.json found. Run `ui-forge init` first.');
    process.exit(1);
  }
  const first = platformById(lock.platforms[0]!);
  if (!first) {
    console.error('Cannot resolve platform skill dir.');
    process.exit(1);
  }
  const scope = expandScope(lock.scope)[0]!;
  const paths = platformPaths(cwd, first, scope, homedir());
  console.log('# Paste the following into your MCP client config (mcpServers.ui-forge):');
  console.log(mcpSnippet(paths.skillDir));
}
