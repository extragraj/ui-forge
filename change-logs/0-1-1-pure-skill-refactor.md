# 0.1.1 — Pure Skill Refactor

**Released:** 2026-04-13
**Type:** Architectural refactor
**Scope:** `scripts/invoke.js`, `scripts/scan.js`, `SKILL.md`, `README.md`, `references/advanced-usage.md`, `package.json`

---

This release refactors UI Forge from a standalone AI client into a pure context-preparation skill. `invoke.js` no longer makes any API calls. It now pre-processes reference files, loads the design authority, and prints structured generation context to stdout. The AI assistant (Claude Code or any compatible assistant) reads that output and generates the component using its own session.

---

## Breaking Changes

### `forge()` programmatic API removed

**File:** `scripts/invoke.js`

The exported `forge()` function has been removed. `invoke.js` is now a CLI-only context-preparation script with no module export.

**Before:**
```javascript
import { forge } from './scripts/invoke.js'
const result = await forge({ task: '...', refs: ['./hero.html'] })
console.log(result.code)
```

**After:** Run the script via CLI. The AI assistant reads stdout and generates the component.

---

### `--stream` and `--model` flags removed

**File:** `scripts/invoke.js`

`--stream` streamed API responses to stdout — no longer relevant without API calls. `--model` selected the generation model — no longer relevant. Both flags are removed.

---

## Core Changes

### `invoke.js` — context-preparation only

`invoke.js` is now a pure Node.js file I/O and text-processing script. All API-calling functions have been removed:

| Removed | Reason |
|---|---|
| `callAPI()` | No longer makes API calls |
| `streamToStdout()` | No streaming without API |
| `runHaikuPlan()` | Stage 1 page planning now delegated to AI |
| `parseForgeResult()` | No result to parse |
| `forge()` export | No programmatic API |
| `API_KEY` constant | No API key needed |

Replaced with three context builders that print structured output to stdout:

| Function | Output |
|---|---|
| `buildSectionContext()` | `=== UI FORGE ===` — single component context |
| `buildPageStage1Context()` | `=== UI FORGE — PAGE DECOMPOSITION (Stage 1) ===` |
| `buildPageStage2Context()` | `=== UI FORGE — PAGE GENERATION (Stage 2) ===` |

All three include: task, design authority, pre-processed refs, design standards, generation instructions, and write target. The AI reads this output and generates the component.

---

### Page pipeline — Stage 1 delegated to AI

**Before:** Stage 1 called the Haiku API to decompose the page into `forge-page-plan.json`.

**After:** Stage 1 outputs the full page content and decomposition instructions to stdout. The AI reads the output and writes `forge-page-plan.json` itself. The plan format and behavior are unchanged.

---

### Image handling — path reference instead of base64

**Before:** Image files were read, base64-encoded, and sent as multipart payloads to the API.

**After:** Image paths are included in the stdout output as read instructions. The AI reads the image directly using its own vision capability.

---

### `scan.js` — removed `tryAnthropicAPI` fallback

The direct Anthropic API fallback for pattern synthesis has been removed. Synthesis now tries the `claude` CLI first, then falls back to static analysis. `synthesize()` is now synchronous.

| Synthesis strategy | Status |
|---|---|
| `claude` CLI | Kept — works in Claude Code without a key |
| Direct Anthropic API call | Removed |
| Static analysis fallback | Kept — works everywhere |

---

### `package.json` — removed `main` and `bin`

`main: "scripts/invoke.js"` and `bin: { "ui-forge": "scripts/invoke.js" }` have been removed. The script is no longer a Node.js module or a globally installable binary. Added `change-logs/` to the `files` array. Updated repository URL to `extragraj/ui-forge`.

---

## Documentation Updates

| File | Change |
|---|---|
| `SKILL.md` | Rewritten — explains pure skill model, removes API key requirement, removes `--stream`/`--model` flags |
| `README.md` | Installation section simplified, Token Optimization updated to reflect zero-API-call architecture |
| `references/advanced-usage.md` | Removed: Programmatic API Usage section, Environment Variable Setup section, API key error from troubleshooting |
| `CLAUDE.md` | Architecture section fully updated to reflect new context-output model |

---

## Summary

| Category | Change |
|---|---|
| Architecture | `invoke.js` is now a context-preparation script, not an AI client |
| API calls | Removed from `invoke.js` entirely; removed direct API fallback from `scan.js` |
| Programmatic API | `forge()` export removed |
| CLI flags | `--stream` and `--model` removed |
| Image handling | Base64 encoding removed; path references used instead |
| Dependencies | Zero external dependencies maintained |
| Compatibility | Works with Claude Code, Cursor, Cline, Copilot, and any AI assistant that can run bash |
