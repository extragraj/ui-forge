# 1.3.0 — MCP server: cross-CLI shell-free invocation

**Date:** 2026-05-21

---

## Problem

UI Forge's `invoke.js` is a context-preparation script — the AI runs it as a shell command, then reads its stdout. That model works in Claude Code, Cursor, and Codex, but breaks in environments where the agent has no shell execution: restricted Cline modes, web-based clients, and sandboxed runners. The AI falls back to generating without UI Forge's prepared context, silently losing the design authority, signal detection, and pattern matching the skill provides.

## New: MCP server transport

`scripts/mcp-server.js` exposes UI Forge's core scripts as Model Context Protocol tools. Agentic CLIs that support MCP (Cline, Cursor, Claude Code, Codex, and others) can now invoke ui-forge as a registered tool call instead of a shell command. No shell access required — the MCP client launches the server itself.

### Tools exposed

| Tool | Wraps | Purpose |
|------|-------|---------|
| `forge_invoke` | `invoke.js` | Prepare generation context |
| `forge_scan` | `scan.js` | Scan project → `design/design-arch.json` |
| `forge_verify` | `verify.js` | Verify a generated component against its contract |
| `forge_export_design` | `export-design.js` | Export a Claude Design–ingestible bundle |

Each tool accepts:

- `args: string[]` — CLI arguments passed verbatim to the underlying script (e.g. `["--task", "Build hero", "--refs", "./hero.html", "--output", "./Hero.tsx"]`)
- `project_root: string?` — absolute path to the target project, used as cwd for the spawn

## New CLI commands

```bash
ui-forge mcp           # launch the MCP server (stdio); used in client configs, not run by hand
ui-forge mcp-config    # print the JSON snippet to register the server with your MCP client
```

`mcp-config` prints the ready-to-paste `mcpServers` entry plus the config-file location for each major MCP-aware CLI (Cline, Claude Code, Cursor, Codex).

## Protocol details

- **Transport:** stdio, newline-delimited JSON-RPC 2.0
- **Protocol version:** `2025-06-18`
- **Capabilities:** `tools` (no resources/prompts/sampling)
- **Methods implemented:** `initialize`, `notifications/initialized`, `tools/list`, `tools/call`, `ping`, `shutdown`
- **Errors:** malformed JSON → `-32700`; unknown method → `-32601`; internal failure → `-32603`
- Tool failures (script exit code ≠ 0) are returned as `result.isError: true` with stderr captured in the content payload — never as JSON-RPC protocol errors

## Architecture choice: stdlib only

No `@modelcontextprotocol/sdk` dependency. The server implements the protocol directly using `readline` + `child_process.spawn` + JSON, preserving UI Forge's "no external dependencies" rule (CLAUDE.md). The implementation is ~180 lines.

## Testing

`scripts/test-mcp.mjs` drives the server end-to-end with raw JSON-RPC over stdio. Covers:

- `initialize` handshake (protocol version, server info, capabilities)
- `tools/list` shape and tool count
- `tools/call` for `forge_invoke` (args propagation, error capture)
- Unknown-tool and unknown-method error paths
- `ping`, malformed-line recovery

All 27 assertions pass.

## When to use MCP vs. slash commands

| Mode | Use when |
|------|----------|
| Slash commands (`/forge`, `/forge-scan`) | Your CLI supports shell command execution (Claude Code, Cursor, Codex CLI) |
| MCP server | Your CLI has no shell access, or you prefer typed tool calls over shell invocations (Cline, Cursor with MCP, web-based clients) |

Both paths share the same underlying scripts — same signals, same design authority, same output. The MCP server simply moves the invocation off the shell and onto the MCP protocol.

---

## Files Changed

| File | Change |
|------|--------|
| `scripts/mcp-server.js` | New: stdlib-only MCP server (JSON-RPC over stdio) exposing `forge_invoke`, `forge_scan`, `forge_verify`, `forge_export_design` |
| `scripts/cli.js` | New `mcp` and `mcp-config` subcommands; `mcp` proxies to the server, `mcp-config` prints the registration snippet with per-CLI paths |
| `scripts/test-mcp.mjs` | New: end-to-end smoke test harness; drives the server with raw JSON-RPC, asserts all responses |
| `skill.version` | 1.2.0 → 1.3.0 |
| `package.json`, `README.md`, `SKILL.md` | Version synced; README changelog and SKILL.md MCP section added |
