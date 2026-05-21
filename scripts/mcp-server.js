#!/usr/bin/env node
/**
 * ui-forge / mcp-server.js
 *
 * Model Context Protocol server exposing UI Forge's core scripts as MCP tools.
 * Lets agentic CLIs without shell execution (e.g. restricted Cline modes,
 * web-based clients) still use ui-forge — the MCP tool call replaces the
 * `node scripts/invoke.js ...` shell invocation.
 *
 * Transport: stdio, newline-delimited JSON-RPC 2.0.
 * Dependencies: stdlib only.
 *
 * Tools exposed:
 *   forge_invoke         — prepare generation context (wraps invoke.js)
 *   forge_scan           — scan project → design/design-arch.json (wraps scan.js)
 *   forge_verify         — verify a generated component (wraps verify.js)
 *   forge_export_design  — export design bundle (wraps export-design.js)
 *
 * Each tool accepts:
 *   args:         string[]   — passed verbatim to the underlying script
 *   project_root: string?    — cwd for the spawn (defaults to MCP server cwd)
 *
 * Launch:
 *   node <skill-root>/scripts/mcp-server.js
 *   ui-forge mcp
 */

import { spawn } from 'child_process'
import { createInterface } from 'readline'
import { readFileSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SKILL_ROOT = dirname(__dirname)

// Force UTF-8 stdout on Windows so script output round-trips correctly.
if (process.platform === 'win32' && !process.stdout.isTTY) {
  process.stdout.setDefaultEncoding('utf8')
}

function getVersion() {
  try { return readFileSync(join(SKILL_ROOT, 'skill.version'), 'utf8').trim() } catch { return '0.0.0' }
}

const PROTOCOL_VERSION = '2025-06-18'
const SERVER_INFO = { name: 'ui-forge', version: getVersion() }

const SCRIPTS = {
  forge_invoke:        { script: 'invoke.js',         description: 'Prepare UI Forge generation context. Loads design-arch.json, classifies refs, detects signals, and returns structured context the AI reads to generate the component. Equivalent to running `node <skill>/scripts/invoke.js` with the given args.' },
  forge_scan:          { script: 'scan.js',           description: 'Scan the target project and write design/design-arch.json. Run once per project, or after dependency/theme changes.' },
  forge_verify:        { script: 'verify.js',         description: 'Verify a generated component against its contract (static checks + optional Playwright screenshot).' },
  forge_export_design: { script: 'export-design.js',  description: 'Export design-arch.json as an uploadable Claude Design bundle.' },
}

const TOOL_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    args: {
      type: 'array',
      items: { type: 'string' },
      description: 'CLI arguments passed verbatim to the underlying script (e.g. ["--task","Build hero","--refs","./hero.html","--output","./Hero.tsx"]).',
      default: [],
    },
    project_root: {
      type: 'string',
      description: 'Absolute path to the target project. Used as cwd for the spawn. Defaults to the MCP server\'s cwd.',
    },
  },
  required: [],
  additionalProperties: false,
}

// ─── JSON-RPC framing ────────────────────────────────────────────────────────

function send(message) {
  process.stdout.write(JSON.stringify(message) + '\n')
}

function ok(id, result) { send({ jsonrpc: '2.0', id, result }) }
function err(id, code, message, data) {
  const error = { code, message }
  if (data !== undefined) error.data = data
  send({ jsonrpc: '2.0', id, error })
}

// ─── Tool execution ──────────────────────────────────────────────────────────

function runScript(scriptName, args, cwd) {
  return new Promise((resolvePromise) => {
    const scriptPath = join(__dirname, scriptName)
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: cwd || process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (d) => { stdout += d })
    child.stderr.on('data', (d) => { stderr += d })
    child.on('error', (e) => {
      resolvePromise({ exitCode: -1, stdout, stderr: (stderr + '\n' + e.message).trim() })
    })
    child.on('close', (code) => {
      resolvePromise({ exitCode: code ?? 0, stdout, stderr })
    })
  })
}

async function handleToolsCall(params) {
  const name = params?.name
  const argsObj = params?.arguments ?? {}
  const spec = SCRIPTS[name]
  if (!spec) {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      isError: true,
    }
  }
  const scriptArgs = Array.isArray(argsObj.args) ? argsObj.args.map(String) : []
  const cwd = argsObj.project_root ? resolve(argsObj.project_root) : undefined
  const { exitCode, stdout, stderr } = await runScript(spec.script, scriptArgs, cwd)

  const parts = []
  if (stdout) parts.push(stdout)
  if (stderr) parts.push(`[stderr]\n${stderr}`)
  if (parts.length === 0) parts.push(`(no output, exit=${exitCode})`)

  return {
    content: [{ type: 'text', text: parts.join('\n\n') }],
    isError: exitCode !== 0,
  }
}

// ─── Request dispatch ────────────────────────────────────────────────────────

async function handle(msg) {
  // Notifications have no id; never reply.
  const isNotification = msg.id === undefined || msg.id === null
  const id = msg.id ?? null

  try {
    switch (msg.method) {
      case 'initialize':
        if (isNotification) return
        ok(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
        })
        return
      case 'notifications/initialized':
      case 'initialized':
        return
      case 'ping':
        if (isNotification) return
        ok(id, {})
        return
      case 'tools/list':
        if (isNotification) return
        ok(id, {
          tools: Object.entries(SCRIPTS).map(([name, { description }]) => ({
            name,
            description,
            inputSchema: TOOL_INPUT_SCHEMA,
          })),
        })
        return
      case 'tools/call': {
        if (isNotification) return
        const result = await handleToolsCall(msg.params)
        ok(id, result)
        return
      }
      case 'shutdown':
        if (!isNotification) ok(id, null)
        return
      default:
        if (isNotification) return
        err(id, -32601, `Method not found: ${msg.method}`)
        return
    }
  } catch (e) {
    if (!isNotification) err(id, -32603, 'Internal error', String(e?.stack || e?.message || e))
  }
}

// ─── stdio loop ──────────────────────────────────────────────────────────────

const rl = createInterface({ input: process.stdin, output: undefined, terminal: false })

rl.on('line', (line) => {
  const trimmed = line.trim()
  if (!trimmed) return
  let msg
  try {
    msg = JSON.parse(trimmed)
  } catch {
    err(null, -32700, 'Parse error')
    return
  }
  // Batch support (rarely used in MCP but legal in JSON-RPC).
  if (Array.isArray(msg)) {
    for (const m of msg) handle(m)
  } else {
    handle(msg)
  }
})

rl.on('close', () => { process.exit(0) })

// Silence broken-pipe noise when the client disconnects.
process.stdout.on('error', (e) => { if (e.code === 'EPIPE') process.exit(0) })
