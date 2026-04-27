# 0.1.9D — Claude Design integration

Released 2026-04-27.

## Summary

Two-way integration with Claude Design (claude.ai/design):

- **Goal A — Consume**: `--handoff <url>` fetches a Claude Design handoff, materializes refs into `design/.handoff-cache/`, and generates the component remapped to project tokens with the new `+CLAUDE_DESIGN` modifier signal.
- **Goal B — Produce**: `/forge-export-design` exports `design-arch.json` as a Claude Design–ingestible bundle so prototypes use the project's real tokens from the start.

## What changed

### `scripts/fetch-handoff.js`

Standalone Node.js fetcher. Uses global `fetch` (Node 18+, no deps). Handles three content-type branches:

| Branch | Content-type | Files written |
|--------|---|---|
| A | `application/json` | `manifest.json`, `design.html`, `README.md`, `tokens.json` (whichever fields exist) |
| B | `text/html` | `design.html` |
| C | `application/zip` | Fails with manual-download instructions |

Auth: unauthenticated (capability token assumed to be in the URL path). If a real discovery run shows auth is required, the header is added in one place at the top of this file. Provides actionable hints for 401/403 responses.

### `scripts/invoke.js` — `--handoff` flag + `+CLAUDE_DESIGN` modifier

**New import:** `createHash` from `'crypto'` (no new dependency — Node built-in).

**`--handoff` handling in `main()`** — runs before the `!params.task` early exit:
1. Hashes the URL (SHA-256, 12 hex chars) to derive a stable `design/.handoff-cache/<hash>/` directory.
2. Spawns `fetch-handoff.js` as a child process.
3. Auto-populates `params.refs` with whichever of `design.html`, `README.md`, `tokens.json` were materialized.
4. Derives `params.task` from the README.md first `#` heading when `--task` is omitted.

**`detectSignals()`** — new `CLAUDE_DESIGN` modifier fires when `opts.handoff` is true or any ref path contains `.handoff-cache`. Consumed by `loadComposedAddendum` via the new `## SIGNAL_CLAUDE_DESIGN` block in `prompt-patterns.md`.

**Usage message** updated to document `--handoff` and the optional-`--task` behavior.

### `references/prompt-patterns.md` — `SIGNAL_CLAUDE_DESIGN` block

New `## SIGNAL_CLAUDE_DESIGN` addendum-only block. Authority split:
- Layout/composition → Claude Design handoff (authoritative visual spec)
- Tokens → `design-arch.json` (always remap; never inline Claude Design's generated classes)
- `tokens.json` sibling used only for tokens genuinely absent from `design-arch.json`

Requires a `// CLAUDE_DESIGN` sub-block in FORGE NOTES documenting source, task summary, and token remappings.

### `references/claude-design-handoff-format.md`

Placeholder discovery doc. Documents the hypothesis (capability token in URL, likely unauthenticated), the `fetch-handoff.js` branching table, and instructions for running actual discovery against a real handoff URL and filling in the confirmed shape.

### `scripts/export-design.js`

Reads `design/design-arch.json` and writes `design/claude-design-bundle/`:

| File | Content |
|------|---------|
| `README.md` | Stack summary, file index, quick token reference — entry point for Claude Design onboarding |
| `tokens.json` | `tailwind.themeSection`, `colorTokens`, `darkColorTokens`, `_scanned`, `_theme` |
| `components.md` | Named component imports with paths, component directories |
| `conventions.md` | `patterns.spacing`, `patterns.typography`, `patterns.conventions` |
| `globals.css` | Copy of `arch.globalCss` if present |
| `standards/*.md` | Per-slot design standards (from arch, project `design/standards/`, or both) |

Handles both string and object `colorTokens` formats (v3/v4 schema). Prints a summary and next-step instructions on stdout.

### `commands/forge-export-design.md`

Slash command: `/forge-export-design [out-dir]`

Runs `scripts/export-design.js` via `$CLAUDE_PLUGIN_ROOT`.

### `SKILL.md` — Claude Design sections added

Usage section updated with:
- `--handoff` one-command example
- `/forge-export-design` example
- Full round-trip workflow (scan → export → design in Claude Design → handoff → generate)

Signals section updated with `+CLAUDE_DESIGN` modifier entry.

## Backwards compatibility

- No changes to signal logic for existing signals (`CONVERT_SECTION`, `CONVERT_VARIANT`, `CONVERT_PAGE`, `+BRAND`, `+DIFF`, etc.).
- No changes to `scan.js`, `verify.js`, `validate-contract.js`.
- `--handoff` is purely additive — omitting it is identical to prior behavior.
- StackShift paired-mode, `a11yRequired`, and all existing modifiers are unaffected.
- Codex CLI: `fetch-handoff.js` and `export-design.js` are standalone scripts invokable directly via `node`; no slash-command dependency.
- `design/.handoff-cache/` is written under `design/` (already in the built-in ignore list) so it is excluded from scan traversal.
