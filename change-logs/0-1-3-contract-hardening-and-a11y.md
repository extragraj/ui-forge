# 0.1.3 — Contract Hardening, Anti-Slop & A11Y

Released: 2026-04-14

Implements Phase 1 + 2 of the UI Forge optimization plan v2 (`ui-forge-optimization-plan`).
All changes are additive and non-breaking — no API changes, no schema bumps, no
behavior changes to existing flags.

## What's new

### Contract hardening (Section 5.2, Section 5.3, Section 5.5)

The handoff between UI Forge and StackShift now has mechanized guards.

- **Contract version tag** — the exported props interface may declare
  `/** @contract-version x.y.z */`. UI Forge parses it, surfaces it in the
  `CONTRACT` header of the generation context, and warns on stderr when the
  version is not in `SUPPORTED_CONTRACT_VERSIONS`. Absence defaults to `1.0.0`.
- **CONTRACT header** — `CONVERT_VARIANT` output now includes interface name
  and contract version at the top of the CONTRACT block. Auditable handoff.
- **FORGE NOTES `// CONTRACT` sub-block** — the AI is now required to document
  the contract file, interface, version, every prop consumed, fallback rule
  verification, and confirmation that only the default export is emitted.
- **`scripts/validate-contract.js`** — new post-generation validator. Parses
  the output and the contract file (heuristic/regex — no TypeScript compiler
  dependency) and reports violations:
    - missing or multiple default exports
    - disallowed named exports
    - contract interface not imported
    - required props not consumed
    - missing `return null` fallback
    - `?? null` used where `?? undefined` is required
  Exit code `1` on violations, `0` on pass. Usable in CI.

### Accessibility — new `+A11Y` modifier (Section 6.3)

- New `SIGNAL_A11Y` addendum block in `prompt-patterns.md`. Enforces WCAG 2.1
  AA rules: semantic HTML, heading outline, accessible names, alt text, label
  association, focus visibility, contrast, tap targets, reduced motion.
- Activated by any of:
    - `--a11y` CLI flag on `invoke.js`
    - `a11y: true` in a `--config` JSON
    - `a11yRequired: true` in `design/design-arch.json`
    - `a11yRequired: true` in `.stackshift/installed.json` (paired mode —
      StackShift-wide accessibility protocol is honored automatically)

### Anti-slop guardrail (Section 4.1)

- `CONVERT_SECTION` and `SIGNAL_VARIANT` addendums now include explicit
  anti-slop rules: no default hero gradients, no rainbow headings, no filler
  CTAs, no decorative icons, no Lorem ipsum, visual density matches the
  reference/contract. Output stays hand-crafted, not template-kit.

### Pushy description (Section 4.2)

- `SKILL.md` frontmatter and `package.json` description now name both modes
  explicitly (standalone + StackShift companion) and the new guardrails. Helps
  hosts route requests to UI Forge.

### Paired-mode detection (Section 4.6, Section 4.10 foundation)

- `invoke.js` reads `.stackshift/installed.json` when present, logs the
  detected StackShift version to stderr, surfaces `PAIRED: stackshift x.y.z`
  in the `CONVERT_VARIANT` context header, and honors the marker's
  `a11yRequired` field.

### Version compatibility matrix (Section 6.6)

- New `references/versions.md` — Node, Next.js, Tailwind, StackShift, component
  library, styling-system compatibility. Documents the breaking-change policy
  and every marker file UI Forge looks for.

## Flags added

| Flag | Behavior |
|---|---|
| `--a11y` | Adds `+A11Y` modifier. Loads `SIGNAL_A11Y` addendum. |

## New scripts

| Script | Purpose |
|---|---|
| `scripts/validate-contract.js` | Post-generation contract assertion. |

## Files changed

- `SKILL.md` — description, frontmatter version
- `package.json` — description, version
- `skill.version` — 0.1.2 → 0.1.3
- `scripts/invoke.js` — `--a11y`, paired-mode detection, contract version parsing, CONTRACT header
- `scripts/validate-contract.js` — new
- `references/prompt-patterns.md` — anti-slop, CONTRACT sub-block, `SIGNAL_A11Y`, expanded `SIGNAL_VARIANT`
- `references/versions.md` — new
- `README.md` — version line, changelog row, new sections
- `CLAUDE.md` — new commands, new files, new signals
- `change-logs/0-1-3-contract-hardening-and-a11y.md` — this file

## Compatibility

- Byte-identical stdout for all pre-existing flag combinations that do not
  activate `+A11Y` or involve a `CONVERT_VARIANT` with a `@contract-version`
  tag (new CONTRACT header lines are opt-in via the tag's presence).
- Design-arch schema unchanged (`_v: 3`).
- No new dependencies — still Node stdlib only.

## Not in this release

Tracked in the plan, deferred to subsequent releases:

- Section 5.1 `@extragraj/variant-contract` npm package (cross-repo coordination)
- Section 5.4 StackShift-side pre-flight validation (StackShift repo)
- Section 6.1 Full tiered protocol restructure (risk of breaking forks)
- Section 6.2 Bootstrap + `/docs/` customization
- Section 6.4 Unified `@extragraj/skills` CLI
- Section 6.5 Shared evals harness
- Section 4.3 `themes/` starters
- Section 4.4 Golden-conversion examples directory
- Section 4.6 `--preview` flag
- Section 4.7 `--verify` Playwright
- Section 4.8 `--diff` iterative mode
- Section 4.9 `+BRAND` signal
- Section 4.10 `+CREATIVE` greenfield signal
- Section 4.14 Dark-mode schema v4
- Section 4.15 `// FORGE PHILOSOPHY` block
