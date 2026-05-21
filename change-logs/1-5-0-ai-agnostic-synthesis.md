# 1.5.0 — AI-agnostic scan synthesis

**Date:** 2026-05-21

---

## Background

`scan.js` previously synthesized design-system patterns (spacing, typography, color tokens, conventions) by spawning the `claude` CLI as a subprocess — hardcoded to `claude-haiku-4-5-20251001`. This approach was fundamentally incompatible with any agentic environment that isn't Claude:

- **Cline, Cursor, Codex CLI, OpenRouter-backed agents** — no `claude` binary on PATH; synthesis silently degraded to `spacing: 'unknown'`, `typography: 'unknown'`, empty conventions.
- **Cold subprocess** — no tool-use capability, no real file reads. The subprocess received file paths as text and hoped the model read them, while the session AI already had that capability natively.
- **Double model cost** — Claude Code users paid for a second model call in a subprocess while their session model sat idle.
- **Fragile** — Windows CMD mangled special characters in shell args, requiring a stdin workaround. Timeout failures and non-zero exit codes silently fell back with no user visibility.

The root issue: synthesis was hardwired to a specific binary instead of delegating to the AI already running in the session.

## Changes

### Two-phase scan architecture

`/forge-scan` (and all equivalent scan invocations) is now a two-phase process:

**Phase 1 — Static scan** (`scan.js`, always runs):
- All existing static analysis is unchanged: import scanning, Tailwind config reading, CSS reading, dark token extraction, component directory discovery, design standards population, theme application.
- Writes `design/design-arch.json` with `patterns: { spacing: 'unknown', ... }` as before.
- Emits `design/.synthesis-request.json` — a structured payload containing the list of files to read, top packages, optional CLAUDE.md excerpt, and a pre-built synthesis prompt ready for any AI to consume.

**Phase 2 — Session AI synthesis** (orchestrated by `commands/forge-scan.md`):
- The **calling session AI** — whichever model is active (Claude, GPT-4o, Gemini, Codex, etc.) — reads `.synthesis-request.json`, uses its own file-read capability to read the listed source files, synthesizes, and calls `apply-synthesis.js` with the JSON result.
- `apply-synthesis.js` validates the result, patches `design-arch.json` patterns fields, and deletes `.synthesis-request.json`.
- Works in Claude Code, Cline, Cursor, Codex CLI, and any agentic environment with file-read capability and Bash tool access.

`--quick` flag retains its existing semantics: skip Phase 2 entirely (no `.synthesis-request.json` written; patterns stay `'unknown'`).

### New script: `scripts/apply-synthesis.js`

Receives synthesis JSON from the session AI, applies it to `design-arch.json`:

```bash
node scripts/apply-synthesis.js '<json>'
echo '<json>' | node scripts/apply-synthesis.js
```

**Behavior:**
- Strips markdown code fences if the AI wrapped its response
- Validates required fields: `spacing`, `typography`, `colorTokens`, `conventions`
- Patches `patterns.spacing`, `patterns.typography`, `patterns.conventions` — only if synthesis returned a non-`'unknown'` value
- Patches `tailwind.colorTokens` — only when arch currently has none (never overwrites existing tokens)
- Patches `isStackShift` — only upgrades to `true`, never downgrades an existing `true`
- Writes `_synthesized` ISO timestamp to arch
- Deletes `design/.synthesis-request.json` on success
- Accepts JSON via `argv[2]` or stdin (`readFileSync(0)` — works cross-platform on Node ≥ 18)

**Exit codes:**
- `0` — patched successfully
- `1` — JSON parse error, missing required fields, or read/write error
- `2` — `design-arch.json` not found (scan Phase 1 must run first)

**Idempotent:** running `apply-synthesis.js` twice with the same input produces the same result.

### `scripts/scan.js` — subprocess removed

- Removed: `tryClaudeCLI()`, `warnSynthesisFallback()`, `spawnSync` import
- Removed: the subprocess branch of `synthesize()` and the `QUICK_MODE` check that guarded it
- Added: `writeSynthesisRequest(payload)` — writes `design/.synthesis-request.json` with the payload and pre-built prompt
- `synthesize()` now always calls `staticFallback()` for the arch write, then calls `writeSynthesisRequest()` unless `--quick` is passed
- Header comment updated to document the two-phase strategy

### `commands/forge-scan.md` — two-phase orchestration

Rewritten to instruct the session AI to:
1. Run `scan.js` (Phase 1)
2. Check whether `design/.synthesis-request.json` exists
3. If present: read the listed files using its own file-read capability, synthesize, call `apply-synthesis.js`
4. Skip Phase 2 if `--quick` was passed

The command is AI-agnostic — it issues instructions that any capable AI agent can follow.

### `.synthesis-request.json` shape

```json
{
  "_version": 1,
  "_generated": "<ISO timestamp>",
  "tailwindPath": "tailwind.config.ts",
  "globalCssPath": "app/globals.css",
  "componentFiles": ["components/Hero.tsx", "...up to 12"],
  "topPackages": "@radix-ui/react-dialog(14), clsx(9), ...",
  "claudeMd": "<first 1500 chars of CLAUDE.md — omitted if absent>",
  "prompt": "<pre-built synthesis prompt ready for the session AI>"
}
```

The `prompt` field is self-contained. The slash command reads it and emits it directly to the session AI without reconstruction.

## What does NOT change

- All static analysis logic in `scan.js` — unchanged
- `design-arch.json` schema (v3/v4) — same fields, same shape
- `invoke.js`, `verify.js`, `validate-contract.js` — untouched
- All slash commands except `forge-scan.md`
- Theme system, `.forgeignore` handling, `--theme-override` logic
- `--quick`, `--patch`, `--theme`, `--schema-v4`, `--theme-override`, `--no-backup` flags — all unchanged
- `component-usage.json` generation — unchanged

## Gitignore

`design/.synthesis-request.json` should be gitignored — it is ephemeral and regenerated each scan. Add to your project's `.gitignore`:

```
design/.synthesis-request.json
```

## Tests

`tests/test-1-5-0-ai-agnostic-synthesis.mjs` — 54 assertions across 6 groups:

1. `.synthesis-request.json` written on normal scan; shape is correct
2. `.synthesis-request.json` NOT written with `--quick`
3. `apply-synthesis` happy path — patterns, colorTokens, `_synthesized` timestamp
4. `apply-synthesis` guards — isStackShift not downgraded, colorTokens not overwritten, bad JSON exits 1, missing field exits 1, missing arch exits 2
5. Cleanup and stdin — request file deleted on success, stdin input, code fence stripping, idempotency
6. `scan --patch` re-creates `.synthesis-request.json`; regression: scan core behaviors unbroken, no `claude CLI` mentions in stderr

All prior suites continue to pass: 209 total assertions across five files.
