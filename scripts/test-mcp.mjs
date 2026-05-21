#!/usr/bin/env node
/**
 * Smoke test for mcp-server.js.
 * Spawns the server, drives it with newline-delimited JSON-RPC over stdio,
 * and asserts the responses for initialize, tools/list, tools/call, and
 * the unknown-method path. Exits 0 on success, 1 on any failure.
 */

import { spawn } from 'child_process'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SERVER = join(__dirname, 'mcp-server.js')

const child = spawn(process.execPath, [SERVER], {
  stdio: ['pipe', 'pipe', 'pipe'],
  windowsHide: true,
})

let buf = ''
const pending = new Map()
let nextId = 1
const failures = []

child.stdout.setEncoding('utf8')
child.stdout.on('data', (chunk) => {
  buf += chunk
  let idx
  while ((idx = buf.indexOf('\n')) !== -1) {
    const line = buf.slice(0, idx).trim()
    buf = buf.slice(idx + 1)
    if (!line) continue
    let msg
    try { msg = JSON.parse(line) } catch {
      failures.push(`non-JSON line from server: ${line}`)
      continue
    }
    if (msg.id != null && pending.has(msg.id)) {
      const { resolve } = pending.get(msg.id)
      pending.delete(msg.id)
      resolve(msg)
    }
  }
})

let stderrBuf = ''
child.stderr.setEncoding('utf8')
child.stderr.on('data', (d) => { stderrBuf += d })

function call(method, params) {
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        reject(new Error(`timeout waiting for ${method}`))
      }
    }, 15000)
  })
}

function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n')
}

function assert(cond, label) {
  if (cond) console.log(`  PASS  ${label}`)
  else {
    failures.push(label)
    console.log(`  FAIL  ${label}`)
  }
}

async function run() {
  console.log('Test 1 — initialize')
  const init = await call('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'test', version: '1.0.0' },
  })
  assert(init.result?.protocolVersion === '2025-06-18', 'returns protocolVersion 2025-06-18')
  assert(init.result?.serverInfo?.name === 'ui-forge', 'serverInfo.name === "ui-forge"')
  assert(typeof init.result?.serverInfo?.version === 'string', 'serverInfo.version is string')
  assert(init.result?.capabilities?.tools !== undefined, 'declares tools capability')

  notify('notifications/initialized')

  console.log('\nTest 2 — tools/list')
  const list = await call('tools/list')
  const tools = list.result?.tools || []
  const names = tools.map((t) => t.name).sort()
  const expected = ['forge_export_design', 'forge_invoke', 'forge_scan', 'forge_verify']
  assert(JSON.stringify(names) === JSON.stringify(expected), `lists ${expected.length} tools: ${names.join(', ')}`)
  for (const t of tools) {
    assert(typeof t.description === 'string' && t.description.length > 0, `${t.name} has description`)
    assert(t.inputSchema?.type === 'object', `${t.name} inputSchema is object`)
    assert(t.inputSchema?.properties?.args?.type === 'array', `${t.name} accepts args array`)
  }

  console.log('\nTest 3 — tools/call forge_invoke with no args (expect error exit, captured as isError)')
  const callRes = await call('tools/call', {
    name: 'forge_invoke',
    arguments: { args: [] },
  })
  assert(Array.isArray(callRes.result?.content), 'result.content is array')
  assert(callRes.result.content[0]?.type === 'text', 'first content block is text')
  // invoke.js with no args should fail (no --task, no design-arch.json in repo root); we expect isError true.
  const text = callRes.result.content[0]?.text || ''
  assert(typeof text === 'string' && text.length > 0, 'returned non-empty text')
  assert(callRes.result.isError === true, 'isError=true when invoke.js exits non-zero')

  console.log('\nTest 4 — tools/call forge_invoke with valid args path (help-like)')
  // invoke.js doesn't have --help, but --task with no design-arch will still surface a structured error; the
  // point of this test is to confirm args propagate. We pass a clearly-invalid signal to trigger fast exit.
  const callRes2 = await call('tools/call', {
    name: 'forge_invoke',
    arguments: { args: ['--task', 'noop', '--signal', 'BOGUS_SIGNAL'] },
  })
  assert(Array.isArray(callRes2.result?.content), 'args propagated, content returned')

  console.log('\nTest 5 — unknown tool returns isError')
  const unknown = await call('tools/call', {
    name: 'forge_does_not_exist',
    arguments: {},
  })
  assert(unknown.result?.isError === true, 'unknown tool returns isError=true')
  assert((unknown.result?.content?.[0]?.text || '').includes('Unknown tool'), 'message mentions unknown tool')

  console.log('\nTest 6 — unknown method returns JSON-RPC error')
  const bogus = await call('does/not/exist')
  assert(bogus.error?.code === -32601, 'unknown method → -32601')

  console.log('\nTest 7 — ping')
  const pingRes = await call('ping')
  assert(pingRes.result !== undefined, 'ping returns result')

  console.log('\nTest 8 — notification with id is ignored gracefully')
  // Send a malformed line and confirm server keeps responding.
  child.stdin.write('not json at all\n')
  const after = await call('ping')
  assert(after.result !== undefined, 'server survives a bad line')

  child.stdin.end()
  await new Promise((r) => child.on('close', r))

  console.log('\n──────────────────────────────────────────')
  if (failures.length === 0) {
    console.log(`All checks passed.`)
    if (stderrBuf) console.log(`(server stderr was non-empty:\n${stderrBuf})`)
    process.exit(0)
  } else {
    console.log(`${failures.length} check(s) failed:`)
    for (const f of failures) console.log('  - ' + f)
    if (stderrBuf) console.log(`\nserver stderr:\n${stderrBuf}`)
    process.exit(1)
  }
}

run().catch((e) => {
  console.error('Test harness error:', e)
  try { child.kill() } catch {}
  process.exit(1)
})
