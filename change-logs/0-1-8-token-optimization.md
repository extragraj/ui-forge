# 0.1.8 — Token optimization: SKILL.md body, prompt-patterns, archToContext, INDEX.md

Released 2026-04-21.

## Summary

Seven targeted optimizations to reduce the token cost paid by **users** of UI Forge — the cost incurred in a target project when the skill activates, when `invoke.js` runs, and when Claude reads reference docs. Developer-session costs (working inside the `ui-forge` repo) are out of scope and were not touched.

1. **SKILL.md body compressed** — 9 versioned `###` release-note sections collapsed to one-liners; Advanced section updated to include `INDEX.md`.
2. **SKILL.md frontmatter compressed** — `description:` trimmed from ~100 words to ~40 words.
3. **`prompt-patterns.md` addenda condensed** — `CONVERT_SECTION`, `SIGNAL_A11Y`, and `SIGNAL_BRAND` blocks tightened; PHASES 1/2/3 prose collapsed to a numbered checklist; all rule subjects preserved.
4. **`archToContext()` caps tightened** — `usedComponents` 40→25, `themeSection` 800B→500B, `globalCss` 500B→300B; added skip when `globalCss` is only `@tailwind` directives.
5. **`extractBlock()` memoized** — `_blockCache` added so the pattern file is parsed once per block name per process (CPU quality; no token change).
6. **`references/INDEX.md` added** — topic index with heading names and approximate line ranges for targeted `Read offset/limit` calls instead of full-file reads.
7. **`SKILL.md` Advanced section updated** — points to `INDEX.md` first.

## Savings (per-user, not per-developer)

| Area | Before | After | Savings |
|---|---|---|---|
| SKILL.md body (per activation) | ~3,200 tokens (~344 lines) | ~1,400 tokens (~215 lines) | **~1,800 tokens** |
| SKILL.md frontmatter (per turn) | ~100 tokens (~100 words) | ~40 tokens (~40 words) | **~60 tokens** |
| CONVERT_SECTION addendum (per invoke) | ~754 tokens (3,014B) | ~430 tokens (~1,720B) | **~324 tokens** |
| SIGNAL_A11Y addendum (per a11y invoke) | ~519 tokens (2,075B) | ~320 tokens (~1,280B) | **~199 tokens** |
| SIGNAL_BRAND addendum (per brand invoke) | ~299 tokens (1,194B) | ~120 tokens (~480B) | **~179 tokens** |
| On-demand ref reads (via INDEX.md) | ~5,215 tokens (full file) | ~200–500 tokens (targeted) | **−60–80%** |

Net per typical invoke: **−324 to −700 tokens** depending on signal combination.
Net per skill activation: **−1,860 tokens**.

## What was NOT changed

- `SIGNAL_VARIANT` block — StackShift handoff authority; not touched.
- `SIGNAL_CREATIVE` `// FORGE PHILOSOPHY` block — intentionally verbose creative direction.
- `SIGNAL_DIFF` block — already compact.
- `SIGNAL_CONFIG`, `SIGNAL_IMAGE` — under 700B; minimal savings without rule loss.
- All StackShift paired-mode invariants, stdout format, contract validation — byte-identical.
- `validate-contract.js`, `verify.js`, `scan.js` — unchanged.

## Files changed

- `SKILL.md` — compressed frontmatter description (~100→~40 words); collapsed versioned release-note sections (~145 lines→~37 lines); updated Advanced section to include `INDEX.md`; version bumped to 0.1.8.
- `references/prompt-patterns.md` — `CONVERT_SECTION` addendum (~3,014B→~1,720B); `SIGNAL_A11Y` addendum (~2,075B→~1,280B); `SIGNAL_BRAND` addendum (~1,194B→~480B).
- `scripts/invoke.js` — `archToContext()`: `usedComponents` cap 40→25, `themeSection` cap 800B→500B, `globalCss` cap 500B→300B + skip @tailwind-only content; `_blockCache` added to `extractBlock()`.
- `references/INDEX.md` — NEW topic index for targeted on-demand reads.
- `package.json`, `README.md` — version synced to 0.1.8.

## Backwards compatibility

- All existing `invoke.js` stdout formats are structurally identical (same section order, same headers).
- `archToContext()` tighter caps affect edge cases with very large Tailwind configs — mitigated by keeping a 500B fallback for missing color tokens.
- `_blockCache` is process-scoped and deterministic — no observable behavior change.
- All StackShift paired-mode invariants preserved.
