# 0.1.9B — PostToolUse auto-verify hook

Released 2026-04-27.

## Summary

Adds a single-arg mode to `verify.js` so it can be wired as a Claude Code `PostToolUse` hook. When Claude writes a `.tsx` file, the hook fires automatically, detects whether the file is a UI Forge variant output, resolves the contract path from a `// @contract <path>` directive in FORGE NOTES, and runs a full contract check — no manual step required.

## What changed

### `scripts/verify.js` — single-arg mode + early exits

- `contractArg` changed from `const` to `let` to allow single-arg resolution.
- New block after arg parsing handles the case where only one positional argument is provided (the hook case):
  1. If the file does not end in `.tsx` → silent exit 0 (hook fires on all writes).
  2. If the resolved path does not exist → silent exit 0.
  3. If the first 30 lines do not contain `// FORGE NOTES` → silent exit 0 (not a UI Forge output).
  4. Scan for `// @contract <path>` in the header. If found, use it as `contractArg`. If absent, emit a stderr note and exit 0 — does not block the write.
- Two-arg invocation (`verify.js <output> <contract>`) is fully unchanged.

### `references/prompt-patterns.md` — SIGNAL_VARIANT FORGE NOTES template

Added `// @contract <contract file path>` as the third line of the required FORGE NOTES header (after `// Signal: CONVERT_VARIANT`). This machine-readable directive is what `verify.js` single-arg mode reads to locate the contract without user intervention.

### `references/advanced-usage.md` — Auto-verify hook section

New section "Auto-verify hook (PostToolUse)" added before "Advanced Signal Patterns". Documents:
- The `.claude/settings.json` snippet to install the hook.
- How `// @contract` auto-detection works and how to add it manually.
- Behaviour matrix covering all four file-type × header-presence × directive-presence cases.
- Manual two-arg invocation and `/forge-verify` slash command for reference.

## Backwards compatibility

- No changes to signal logic, scan.js, invoke.js, or validate-contract.js.
- Two-arg `verify.js` invocation is identical to 0.1.9.
- StackShift paired-mode detection and `a11yRequired` behaviour are unchanged.
- The `// @contract` directive in FORGE NOTES is additive — existing outputs without it continue to work when verify.js is called with two args.
- Hook is opt-in: nothing changes for projects that do not add the settings.json snippet.
