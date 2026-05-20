# 1.2.0 — `--full` flag: inline design standards

**Date:** 2026-05-20

---

## New flag: `--full` on `invoke.js` (forge)

### What it does

`--full` changes how design standards are rendered in forge output.

**Default (load-on-demand):**
```
DESIGN STANDARDS (load as needed)
// [REF] 04-color-tokens [design/standards/stackshift-ui/04-color-tokens.md]: RULE: Only use CMS-backed Tailwind tokens… — READ FULL FILE
// [REF] 06-spacing [design/standards/stackshift-ui/06-spacing.md]: RULE: Wrap every top-level section… — READ FULL FILE
```

**With `--full` (inline):**
```
DESIGN STANDARDS (inline)

// --- STANDARD: 04-color-tokens [design/standards/stackshift-ui/04-color-tokens.md] ---
# StackShift UI — Color Tokens

## Rule
Only use CMS-backed Tailwind tokens in variant JSX. Never use raw hex values…
…

// --- STANDARD: 06-spacing [design/standards/stackshift-ui/06-spacing.md] ---
# StackShift UI — Spacing

## Section rhythm
Wrap every top-level section in `<Section>`…
// … truncated — full standard: design/standards/stackshift-ui/06-spacing.md
```

### Truncation for long standards

Standards with **40 or fewer lines** are inlined in full. Standards over 40 lines are trimmed to the most important block:

1. **Preamble** — the `# title` line and any intro text before the first `## ` heading (usually contains the core rule)
2. **Priority section** — the `## Rule` or `## Rules` section if present; otherwise the first `## ` section
3. **Greedy fill** — additional `## ` sections are added in order until the 35-line block limit is reached
4. A `// … truncated — full standard: <path>` notice is appended when content was cut

This ensures the AI always sees the most actionable content immediately, without needing to load the file separately.

### When to use `--full`

| Mode | Use case |
|------|----------|
| Default | Most generations — the AI loads standards as needed via `[REF]` pointers |
| `--full` | When you want all constraints visible upfront in the context window, or when the AI assistant can't load files from `[REF]` pointers |
| `--lite` | Token efficiency — the shortest possible context |

`--full` and `--lite` can be combined: `--lite` still truncates the arch context and uses a condensed addendum, while `--full` inlines standards content.

### Built-in standards: no changes required

The extraction algorithm works with the existing standard file structure. No changes were made to built-in standards in `references/standards/`.

---

## Files Changed

| File | Change |
|------|--------|
| `scripts/invoke.js` | `extractImportantBlock()`: new helper for truncation logic; `appendStandards()`: new `isFull` param with inline branch; `buildSectionContext`, `buildVariantContext`, `buildPageStage2Context`: accept and pass `isFull`; `main()`: parse `--full`, attach `signals.isFull`, pass to all context builders; help text updated |
| `SKILL.md` | `--full` flag documented in forge flags table |
| `README.md` | `--full` flag added to Forge Script Flags table and changelog |
