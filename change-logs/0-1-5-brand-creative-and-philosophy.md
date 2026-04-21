# 0.1.5 — `+BRAND`, `+CREATIVE`, and the `// FORGE PHILOSOPHY` directive

Released: 2026-04-21.

All additions are modifier-level — no schema changes, no new dependencies, byte-identical stdout for invocations that don't use the new flags or brand-named refs.

## What's new

### `+BRAND` modifier — both modes

Brand discipline is now a first-class signal.

**Activation** (either is sufficient):

- A ref file whose basename matches `/\b(brand|voice|tone)\b/i` — reclassified
  from `config`/`companion` to a new `brand` role by `loadRefs()`
- `arch.designStandards.brand` set — the standards pipeline still injects the
  file; `SIGNAL_BRAND` addendum composes via the `brandStandard` opt in
  `detectSignals()`

**Behavior** — added by the `SIGNAL_BRAND` block in `prompt-patterns.md`:

- Brand doc wins for UI copy voice/tone, brand colors, brand-mandated
  typography, imagery tone, accent usage
- `design-arch.json` still wins for implementation tokens (tailwind
  utilities, shadcn variants, spacing scale); brand values are *mapped* onto
  them, never replace them
- FORGE NOTES must include a `BRAND` sub-block: voice adjustments, brand →
  design-arch token mappings (including divergences), typography decisions

**Composes with:** `CONVERT_SECTION`, `CONVERT_PAGE`, `CONVERT_VARIANT`, and
every other modifier.

### `+CREATIVE` modifier — standalone only

Greenfield generation without a layout reference.

**Activation:** `--creative` flag on `invoke.js`, or `creative: true` in a
`--config` JSON.

**Refusal (exit 1):**

- Primary signal is `CONVERT_VARIANT` — contract compliance always wins
- Primary signal is `CONVERT_PAGE` — decomposition requires a layout ref
- Paired mode detected (`.stackshift/installed.json` present) — StackShift
  always supplies a contract, so creative latitude is not available in pair

**Behavior** — added by the `SIGNAL_CREATIVE` block in `prompt-patterns.md`:

- No layout ref required; the AI proposes composition itself
- design-arch tokens remain authoritative (colors, spacing, typography)
- Library swap rules remain binding (`design-arch.usedComponents` /
  `usedLibraries`)
- Anti-slop guardrail from `CONVERT_SECTION` applies in full
- FORGE NOTES must include a `CREATIVE` sub-block: composition rationale,
  token judgment calls, and any section the AI declined to add

### `// FORGE PHILOSOPHY` directive

Ships inside the `SIGNAL_CREATIVE` addendum as a sub-block rather than a
separate file — single-source, token-economical. Guides creative judgment:

- Restraint > ornament. Between "more" and "less", default to less.
- Hierarchy is earned — do not bold every heading nor gradient every CTA.
- Whitespace is a design element, not wasted canvas.
- Every section must justify its own existence on the page.
- One memorable visual choice beats three safe ones.
- Production components are read more often than designed — clarity first.

## Flags added

| Flag | Behavior |
|---|---|
| `--creative` | Adds `+CREATIVE` modifier. Loads `SIGNAL_CREATIVE` addendum (which includes `// FORGE PHILOSOPHY`). |

## Files changed

- `scripts/invoke.js` — `BRAND_NAME_RE` constant; `.json`/`.md` brand-role
  classification in `loadRefs()`; `BRAND` / `CREATIVE` modifiers in
  `detectSignals()` (gated by `opts.brandStandard` and `opts.creative`);
  `BRAND [path]` injection in `buildSectionContext` and `buildVariantContext`;
  `--creative` flag parsing + refusal block in `main()`
- `references/prompt-patterns.md` — new `SIGNAL_BRAND` and `SIGNAL_CREATIVE`
  blocks (the latter embeds the `// FORGE PHILOSOPHY` directive); composition
  rules updated in header
- `SKILL.md` — signal matrix, flag table, new "Brand" / "Creative" sections
- `README.md` — features signal table, flag table, changelog row
- `CLAUDE.md` — architecture notes, new commands, signal detection summary
- `references/advanced-usage.md` — new "Brand and Creative signals" section
- `skill.version` → `0.1.5`; `package.json`, `README.md`, `SKILL.md` synced
  via `scripts/sync-version.mjs`
- `change-logs/0-1-5-brand-creative-and-philosophy.md` — this file

## Backwards compatibility

- **Byte-identical stdout** for invocations that: don't pass `--creative`,
  don't pass brand-named refs, and don't set `designStandards.brand`.
- No API changes to any existing flag.
- No schema changes — `design-arch.json` stays at `_v: 3`.
- Refusal errors for `+CREATIVE` fire on stderr with non-zero exit. No silent
  downgrade.