# UI Forge — Token Optimization (0.1.5)

## Context

Question raised: **"When Claude refers to long markdown references like `examples.md` and `advanced-usage.md`, does that consume more tokens? How do we optimize the skill overall?"**

### Direct answer

**`examples.md` and `advanced-usage.md` are NOT auto-loaded.** They sit on disk as documentation. Claude only pays their token cost *when* it actively reads them while solving a task. In normal skill invocation (`node invoke.js ...`), the script prints structured context to stdout — no reference-doc content is bundled in.

Cost splits into five buckets:

| Bucket | File(s) | When paid | Current cost |
|---|---|---|---|
| **Always-loaded, every session** | `CLAUDE.md` | Claude Code auto-loads project instructions on session start | **~2,770 tokens** |
| **Per-skill-match** | `SKILL.md` frontmatter `description:` | Scanned every turn the skill might trigger | ~150 tokens |
| **Per-invoke** (every `invoke.js` run) | extracted blocks from `prompt-patterns.md` + `archToContext()` output + preprocessed ref | Emitted to stdout and read by Claude | ~800–1,500 tokens |
| **On-demand only** | `README.md`, `advanced-usage.md`, `examples.md`, `versions.md` | Paid only if Claude actively reads | 750–6,250 tokens *each* |
| **Never read** | `change-logs/*.md` | — | 0 |

**The biggest wins are in the "always-loaded" and "per-invoke" rows, not in `examples.md` itself.** An index file cheapens on-demand reads further.

---

## Implementation plan — release 0.1.5

Ordered so the highest-impact, lowest-risk changes ship first. StackShift paired-mode invariants (`.stackshift/installed.json` detection, `a11yRequired` auto-enable, `isStackShift` scan flag, `stackshiftComponentStandard` resolution, `PAIRED: stackshift x.y.z` VARIANT header, `SIGNAL_VARIANT` block contract) must survive every step — called out per step below.

### Step 1 — Slim `CLAUDE.md` (186 → ~60 lines)

**Target:** `CLAUDE.md`
**Why:** Claude Code auto-loads this every session. Today it duplicates ~70% of `SKILL.md` (Architecture, Signal details, Standards resolution, Ignore handling).

**Change:** Keep only — (a) 3-line "what this is", (b) versioning procedure, (c) Key Files table, (d) one-line pointer: "See `SKILL.md` for the operating spec; `references/advanced-usage.md` for deeper detail." Delete the Architecture, Signal-based generation, Prompt composition, Pre-processing pipeline, Ignore handling, and Built-in design standards sections.

**Savings:** ~2,000 tokens per session (largest single win).
**Risk:** None — no code reads `CLAUDE.md`.
**StackShift:** N/A.

### Step 2 — Tighten `SKILL.md` frontmatter description

**Target:** `SKILL.md` lines 4–13
**Why:** Frontmatter `description:` is scanned every turn to decide if the skill should activate.

**Change:** Compress ~100 words → ~40. **Keep every trigger verb** ("create component", "convert HTML/TSX/page", "generate from image", "implement this variant", "convert this") — those drive matching. Drop prose about "anti-slop aesthetic guardrails", "WCAG 2.1 AA", and the "Requires design/design-arch.json" trailer (body already covers them).

**Savings:** ~80 tokens per skill-match check.
**Risk:** Low. Validate skill still matches by running a `node scripts/invoke.js` smoke test with a dummy HTML ref.
**StackShift:** N/A.

### Step 3 — Tighten `archToContext()` caps in `invoke.js`

**Target:** `scripts/invoke.js` `archToContext()` (~lines 124–143 region post-0.1.4)

**Changes:**
- `tailwind.themeSection.slice(0, 800)` → `slice(0, 500)`
- `globalCss.slice(0, 500)` → `slice(0, 300)`
- `usedComponents.slice(0, 40)` → `slice(0, 25)`
- Skip emitting `globalCss` when the content is essentially `@tailwind base/components/utilities` (trim + compare).
- When `arch.tailwind.colorTokens` is present and non-empty, emit a compact `tailwind.theme:` excerpt capped at 200 chars (token summary is enough signal); fall back to the 500-char slice above when tokens are missing.

**Savings:** ~200–400 tokens per invoke.
**Risk:** Low–medium. `_archContextCache` key is unchanged (`_scanned` timestamp); output shape preserved, only truncation tighter.
**StackShift:** `designStandards`, `componentLib`, `isStackShift`, `a11yRequired` remain untouched in the arch context — paired-mode contract holds.

### Step 4 — Memoize `extractBlock()` output

**Target:** `scripts/invoke.js` `loadComposedAddendum()` + `extractBlock()` (~lines 402–420)
**Why:** Called up to 4× per invoke today; each scan is a full-file search.

**Change:** Add `const _blockCache = new Map()` at module scope; key by block name; return cached addendum on subsequent calls.

**Savings:** CPU only (not tokens), but prerequisite for Step 5.
**Risk:** None.
**StackShift:** N/A.

### Step 5 — Condense addenda in `references/prompt-patterns.md`

**Target:** `references/prompt-patterns.md`
**Why:** Extracted blocks are embedded in every invoke's `GENERATION INSTRUCTIONS` section — directly in Claude's context.

**Changes:**
- `CONVERT_SECTION` PHASE 1/2/3 (lines 35–55): collapse to a 10-line numbered list. Same rules, shorter prose.
- `CONVERT_SECTION` ANTI-SLOP block (lines 57–71): trim to ~8 bullets, no rule removals.
- `SIGNAL_A11Y` System Addendum (lines 210–230): each rule on one line.
- `SIGNAL_CONFIG`, `SIGNAL_IMAGE`: light tightening if opportunities appear without rule loss.

**MUST preserve exactly:**
- Every `## SIGNAL_NAME` heading — `extractBlock()` parsing contract.
- The fenced `` **System Addendum:**``` ... ``` `` wrapper — parsing contract.
- `SIGNAL_VARIANT`'s CONTRACT sub-block rules — StackShift handoff authority.

**Savings:** ~200–400 tokens per invoke (directly in stdout).
**Risk:** Medium-low — wording changes can shift model behavior. Mitigate by keeping all rule subjects, not dropping any. Run a before/after invoke and diff FORGE NOTES for regressions.
**StackShift:** `SIGNAL_VARIANT` block is lightly touched or left alone — contract sub-block and all rules preserved.

### Step 6 — Add `references/INDEX.md` for cheap on-demand lookups

**New file:** `references/INDEX.md` (~30 lines)

**Structure:** one-line summary per topic across `examples.md`, `advanced-usage.md`, `versions.md`, `prompt-patterns.md`, `standards/README.md`, with **line ranges** for each section. Example row:

```
- Custom Signal Addition → references/advanced-usage.md lines 518–545
```

**`SKILL.md`** update: the "Advanced" section points at `references/INDEX.md` *first*, with a note that Claude should use `Read` with `offset`/`limit` for targeted slice reads.

**Savings:** On-demand reference lookups drop from ~4–6k tokens to ~1k tokens per lookup.
**Risk:** Additive; existing direct-read path still works.
**StackShift:** N/A.

### Step 7 — Ensure stable `## <Anchor>` headings in the big refs

**Targets:** `references/advanced-usage.md`, `references/examples.md`

**Change:** Scan both files; make sure every major topic has a stable `## <Anchor>` heading with a one-line summary right under it. No file splits — URLs and existing anchor links stay intact. Line ranges in the INDEX depend on these being stable.

**Savings:** Realizes Step 6's potential.
**Risk:** None.

### Step 8 — Version bump + changelog

- `skill.version` → `0.1.5`
- `change-logs/0-1-5-token-optimization.md` — NEW; summarizes Steps 1–7 and the measurements.
- Run `node scripts/sync-version.mjs` to propagate to `package.json`, `README.md`, `SKILL.md` frontmatter.
- Add 0.1.5 row to the `README.md` changelog table.

### Explicitly NOT doing

- **Don't restructure `prompt-patterns.md` heading/fence syntax** — `extractBlock()` and StackShift `SIGNAL_VARIANT` handoff depend on the current parsing contract.
- **Don't minify stdout output** (stripping blank lines or collapsing headers). Structure helps the AI parse; ~50 token win, disproportionate comprehension cost.
- **Don't delete `CLAUDE.md`** — Claude Code auto-loads it; absence = no repo context. Slim, don't remove.
- **Don't trim `SKILL.md` body below ~200 lines** — frontmatter references sections that must exist.
- **Don't dedupe `README.md` vs `SKILL.md`** — different audiences, both have a right to be complete.
- **Don't touch `isSubstantive()`** — already correctly skips the four empty standards templates.
- **Don't delete `change-logs/*.md`** — never read by Claude, zero cost, keep for provenance.

---

## Critical files

| File | Change |
|---|---|
| `CLAUDE.md` | Trim from 186 to ~60 lines; keep pointers, drop duplicated sections |
| `SKILL.md` | Frontmatter `description:` compressed; body untouched |
| `references/prompt-patterns.md` | Shrink addendum prose (CONVERT_SECTION phases, ANTI-SLOP, SIGNAL_A11Y); preserve heading/fence contract exactly |
| `references/INDEX.md` | NEW — one-line-per-topic map with line ranges |
| `references/advanced-usage.md` | Stable `##` anchor headings |
| `references/examples.md` | Stable `##` anchor headings |
| `scripts/invoke.js` | Tighter `archToContext()` caps; `_blockCache` for `extractBlock()`; conditional theme excerpt |
| `skill.version` | Bump to `0.1.5` |
| `change-logs/0-1-5-token-optimization.md` | NEW |
| `README.md` | Version + changelog row (via `sync-version.mjs`) |
| `package.json` | Version (via `sync-version.mjs`) |

## Reused utilities (don't re-implement)

- `getPatternSrc()` (`scripts/invoke.js`) — already memoizes file read. Extend with `_blockCache`.
- `isSubstantive()` (`scripts/invoke.js`) — already filters empty standards. Leave as-is.
- `_archContextCache` / `_refCache` (added in 0.1.4) — leave intact.
- `scripts/sync-version.mjs` — propagates version to all targets.

## Verification

```bash
cd "C:/Users/Garry Caber/Desktop/WebriQ/ui-forge"

# 1. Baseline byte/line counts
wc -l -c CLAUDE.md SKILL.md references/prompt-patterns.md \
  references/examples.md references/advanced-usage.md

# 2. Simulated invokes — measure stdout size per signal
echo '<html><body><h1>Hi</h1></body></html>' > /tmp/forge-hero.html

# CONVERT_SECTION
node scripts/invoke.js --task "Convert hero" --refs /tmp/forge-hero.html 2>/dev/null | wc -c

# CONVERT_SECTION + A11Y (exercises SIGNAL_A11Y slimming)
node scripts/invoke.js --task "Convert hero" --refs /tmp/forge-hero.html --a11y 2>/dev/null | wc -c

# CONVERT_VARIANT smoke — requires a minimal types.ts fixture and existing output file

# 3. Structural regression: run one invoke before and after,
#    diff stdout. Only GENERATION INSTRUCTIONS body and DESIGN AUTHORITY
#    content should shrink. Header/section order must be byte-identical.

# 4. StackShift paired-mode regression (non-negotiable):
#    - Create /tmp/fixture/.stackshift/installed.json with
#      {"version":"0.1.5","a11yRequired":true}
#    - Place a minimal design/design-arch.json with a
#      stackshiftComponentStandard entry
#    - Run CONVERT_VARIANT invoke in that directory
#    - Confirm: PAIRED: stackshift 0.1.5 header present,
#      +A11Y in SIGNAL line, stderr says "paired-mode detected",
#      stackshiftComponentStandard resolves from project path.

# 5. Contract validator still passes on an existing fixture
node scripts/validate-contract.js <existing-variant.tsx> <types.ts>

# 6. Version sync
echo 0.1.5 > skill.version
node scripts/sync-version.mjs
# Confirm package.json, README.md, SKILL.md all now show 0.1.5.

# 7. Self-scan regression (ensures 0.1.4 wins still hold)
node scripts/scan.js --quick
# Diff design/design-arch.json before/after — only _scanned differs.
```

**Target reductions:**

- Session baseline (always-loaded): **−2,000 to −2,200 tokens** (CLAUDE.md + frontmatter).
- Per-invoke average: **−400 to −900 tokens** depending on signal.
- On-demand reference lookup: **−60 to −80%** via INDEX.md targeted reads.

Ship only when stdout header order, StackShift paired-mode invariants, and `validate-contract.js` output are unchanged.
