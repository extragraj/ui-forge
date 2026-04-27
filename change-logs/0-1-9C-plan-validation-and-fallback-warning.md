# 0.1.9C — Stage 1 plan validation and loud fallback warning

Released 2026-04-27.

## Summary

Two defensive improvements: `invoke.js` now validates `forge-page-plan.json` before Stage 2 begins and exits with a clear error on malformed plans; `scan.js` now emits a prominent banner whenever AI synthesis falls back to static analysis so users know their `design-arch.json` may have degraded pattern data.

## What changed

### `scripts/invoke.js` — `validatePagePlan()` (Stage 1 plan validation)

New function `validatePagePlan(plan, planPath)` added inside the CONVERT_PAGE branch, called immediately after `JSON.parse(readFileSync(PLAN_PATH))`.

Checks validated (zero dependencies — no zod, hand-rolled):
- Plan is a non-null object.
- `plan.sections` is an array.
- Each section: `name` is a non-empty string, `type` is a non-empty string.
- Each section: `lines` is a two-element array of non-negative integers with `lines[0] <= lines[1]`.
- `existingProjectSection` is boolean if present.

On failure: emits a multi-line error listing every violated constraint, instructs the user to fix the file or pass `--replan`, and exits with code 1. No crash, no silent bad state.

### `scripts/scan.js` — `warnSynthesisFallback()` (loud fallback warning)

New function `warnSynthesisFallback(reason)` added before `tryClaudeCLI()`. Emits a 70-char `═` banner to stderr with:
- The specific reason synthesis failed.
- The effect on `design-arch.json` (patterns will be `'unknown'` or coarse).
- The fix (ensure `claude` is on PATH and re-run, or use `--quick` to opt out silently).

Called from `tryClaudeCLI()` at each distinct failure point with a precise reason:
- `'claude CLI not found'` — version check fails (error or non-zero exit).
- `'claude CLI timed out after 45s'` — `spawnSync` returns `ETIMEDOUT`.
- `'claude CLI error: <message>'` — other spawn errors.
- `'claude CLI exited with code N'` — non-zero exit from the synthesis call.
- `'claude CLI returned unparseable JSON'` — stdout is not valid JSON.

`--quick` mode is unaffected: `synthesize()` returns early before calling `tryClaudeCLI()`, so no banner fires for intentional skips.

## Backwards compatibility

- No changes to signal logic, `design-arch.json` schema, or output format.
- Stage 2 behaviour is identical for valid plan files — `validatePagePlan` is a no-op on well-formed JSON.
- `scan.js` still writes `design-arch.json` successfully on fallback; the banner is informational only.
- StackShift paired-mode, `a11yRequired`, and all signal modifiers are unchanged.
- Codex CLI flow is unaffected.
