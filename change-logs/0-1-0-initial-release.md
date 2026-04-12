# 0.1.0 — First Round Optimization

**Released:** 2026-04-12
**Type:** First round optimization — post-audit
**Scope:** `scripts/invoke.js`, `scripts/scan.js`, `SKILL.md`, `references/advanced-usage.md`, `references/prompt-patterns.md`

---

A full codebase audit was completed prior to the initial release. **23 issues** were identified and resolved across four categories: bugs, code–documentation discrepancies, performance optimizations, and usability improvements. All issues were addressed before the version was cut.

---

## Bug Fixes

| # | File | Description | Severity |
|---|------|-------------|----------|
| 1 | `scripts/invoke.js` | `forge()` returned a raw string instead of the documented `{ code, notes, raw }` object, crashing all programmatic usage | High |
| 2 | `scripts/scan.js` | Component usage scanner produced incorrect counts due to regex `g`-flag state mutation across files | High |
| 3 | `scripts/invoke.js` | Long Markdown companion files (>150 lines) silently lost all section headings when trimmed | Medium |
| 4 | `scripts/invoke.js` | Extra layout reference files were silently dropped with no warning when more than one was supplied | Medium |
| 5 | `scripts/invoke.js` | Page planner was capped at 600 lines — sections in the lower third of long pages were never planned | Medium |
| 6 | `scripts/invoke.js` | Dead `[DONE]` stop-signal check copied from the OpenAI streaming protocol — never triggered on Anthropic streams | Low |

### Details

**Bug 1 — `forge()` return shape.** The documented API showed `result.code` and `result.notes` properties. `forge()` was returning a plain string; accessing `.code` on it returned `undefined`. A `parseForgeResult()` helper was added that extracts the `FORGE NOTES` block into `result.notes` and exposes the full output as `result.code`. The CLI was updated to read `result.code` internally.

**Bug 2 — Regex state mutation.** The import-pattern regex was created with a `g` flag, which causes JavaScript to track its match position across calls. Each file search started mid-string from where the previous file left off. The `g` flag was removed; the pattern now only needs a boolean test per file.

**Bug 3 — Companion document trimming.** The spec said: keep first 100 lines, then append remaining section headings. Only the first 100 lines were kept — headings were replaced with `...`. The fix scans lines 101+ for `#` markers and appends them under a `SECTION HEADINGS` label.

**Bug 4 — Silent ref drop.** When two layout reference files were classified, only the first was used. No warning was printed. A stderr message now identifies which file is used as the primary and that extras were not included.

**Bug 5 — 600-line page cap.** The two-stage pipeline triggers for pages >400 lines, but the planner was only fed the first 600 lines. The cap was removed. Haiku handles large documents cheaply.

**Bug 6 — Dead streaming check.** The `[DONE]` sentinel is an OpenAI SSE convention. Anthropic uses a different signal. The check was removed; stream termination now relies solely on the correct Anthropic mechanism.

---

## Discrepancies Resolved

| # | File | Description | Severity |
|---|------|-------------|----------|
| 7 | `references/advanced-usage.md` | Custom signal block format documented as `## SIGNAL: NAME` — code parses `## SIGNAL_NAME` (underscore, no colon) | High |
| 8 | `references/advanced-usage.md` | `{COMPONENT_STANDARD}` placeholder documented but never substituted — design standards inject automatically via the system prompt | Medium |
| 9 | `references/advanced-usage.md`, `scripts/invoke.js` | `force` option documented but non-functional (removed); `model` option documented but not read (implemented) | Medium |
| 10 | `SKILL.md` | `--stream` flag implemented in the script but absent from the main skill reference card | Low |
| 11 | `SKILL.md` | `ANTHROPIC_API_KEY` described as universally required — scanner has three fallbacks and can run without it | Low |
| 12 | `references/advanced-usage.md` | Custom signal detection example used a broken `.some()` loop and referenced wrong line number (~400 vs ~309) | Low |

---

## Optimizations

| # | File | Description | Severity |
|---|------|-------------|----------|
| 13 | `scripts/invoke.js` | `prompt-patterns.md` re-read from disk on every section call — added in-memory cache; file now read once per run | Low |
| 14 | `scripts/scan.js` | Component usage tracker re-read all project files once per component — O(components × files) → O(files) single pass | Medium |
| 15 | `scripts/invoke.js` | Design arch context and composed pattern recomputed on every iteration of the page section loop | Low |
| 16 | `scripts/scan.js` | `--patch` flag described as "update patterns only" — actually re-scans everything and only preserves `designStandards` | Low |

### Details

**Optimization 14 — Usage scan complexity.** A 50-component, 300-file project previously required 15,000 file reads. The fix inverts the loop: one pass over all files, checking all components per file. This also naturally resolved Bug 2 since a fresh regex is created per component per file.

---

## Improvements

| # | File | Description | Severity |
|---|------|-------------|----------|
| 17 | `scripts/invoke.js` | No warning when Stage 2 is run against a plan built from a different source file | Medium |
| 18 | `scripts/invoke.js` | TSX files using both CSS modules and Tailwind had Tailwind class data discarded — early exit on styling type detection | Medium |
| 19 | `scripts/scan.js` | Component scanner only matched scoped npm imports (`@scope/pkg`) — missed `@/`, `~/`, `#/` path aliases used by most Next.js projects | Medium |
| 20 | `references/prompt-patterns.md` | `{DESIGN_ARCH_EXCERPT}` template variable substituted in code but never documented for prompt authors | Low |
| 21 | `SKILL.md` | Two-stage pipeline instructions didn't explain that the same command triggers Stage 2 automatically when a plan file exists | Low |
| 22 | `scripts/invoke.js` | Design standard documents silently truncated to 3000 chars with no console notification | Low |
| 23 | `scripts/scan.js` | File read errors during scanning silently discarded — skipped files were invisible to the operator | Low |

### Details

**Improvement 17 — Stage 2 ref mismatch warning.** Stage 1 records the source file path in the plan. Stage 2 now compares the current `--refs` value against `plan._ref` and prints a warning with `--replan` guidance if they differ.

**Improvement 18 — Dual-mode styling extraction.** Styling type detection previously short-circuited: once CSS modules were found, Tailwind class extraction was skipped. Both extractions now run independently. The primary `stylingType` label still reflects the dominant approach.

**Improvement 19 — Path alias import coverage.** The named-import regex was extended to include `@/`, `~/`, and `#/` prefixes. In a standard Next.js + shadcn/ui project, virtually all component imports use `@/components/ui/...` — the previous pattern would have produced an empty `usedComponents` list.

---

## Full Issue Index

| # | Category | Issue | Severity |
|---|----------|-------|----------|
| 1 | Bug | `forge()` returned string not object — crashed programmatic usage | High |
| 2 | Bug | Component usage counts wrong due to regex `g`-flag state | High |
| 3 | Bug | Markdown companion headings lost on trim | Medium |
| 4 | Bug | Extra reference files dropped silently | Medium |
| 5 | Bug | Page planner capped at 600 lines | Medium |
| 6 | Bug | Dead OpenAI `[DONE]` stop signal in Anthropic stream | Low |
| 7 | Discrepancy | Custom signal format wrong in docs (`SIGNAL: NAME` vs `SIGNAL_NAME`) | High |
| 8 | Discrepancy | `{COMPONENT_STANDARD}` placeholder documented but never substituted | Medium |
| 9 | Discrepancy | `force` and `model` API options non-functional | Medium |
| 10 | Discrepancy | `--stream` flag missing from `SKILL.md` | Low |
| 11 | Discrepancy | API key stated as required for scan — has three fallbacks | Low |
| 12 | Discrepancy | Signal detection example: broken loop, wrong line reference | Low |
| 13 | Optimization | `prompt-patterns.md` re-read per section call | Low |
| 14 | Optimization | Usage scan O(components × files) → O(files) | Medium |
| 15 | Optimization | Arch context and pattern recomputed in page section loop | Low |
| 16 | Optimization | `--patch` description didn't match behavior | Low |
| 17 | Improvement | No warning for Stage 2 / plan ref mismatch | Medium |
| 18 | Improvement | Dual CSS-module + Tailwind styling lost Tailwind class data | Medium |
| 19 | Improvement | Component scanner missed `@/`, `~/`, `#/` path alias imports | Medium |
| 20 | Improvement | `{DESIGN_ARCH_EXCERPT}` undocumented for prompt authors | Low |
| 21 | Improvement | Stage 2 auto-trigger mechanism not explained in `SKILL.md` | Low |
| 22 | Improvement | Design standard truncation silent | Low |
| 23 | Improvement | Scan file-read errors silently discarded | Low |
