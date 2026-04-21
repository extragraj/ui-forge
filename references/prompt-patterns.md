# Prompt Patterns

Composition rules:
- `CONVERT_SECTION` provides the base **addendum** and the **wrapper** for all generation calls.
- `SIGNAL_VARIANT` replaces `CONVERT_SECTION` as the base addendum under companion-skill handoff mode.
- `SIGNAL_CONFIG`, `SIGNAL_IMAGE`, `SIGNAL_A11Y`, `SIGNAL_BRAND`, `SIGNAL_CREATIVE`, and `SIGNAL_DIFF` provide **addendum-only** blocks appended after the base.
- `SIGNAL_CREATIVE` is standalone-only — refused under `CONVERT_VARIANT`, `CONVERT_PAGE`, and paired mode.
- `SIGNAL_DIFF` is `CONVERT_SECTION`-only — refused under `CONVERT_VARIANT`, `CONVERT_PAGE`, and `+CREATIVE`.
- `CONVERT_PAGE` Stage 1 uses a hardcoded Haiku prompt in `invoke.js` — no pattern block needed.
- `NEW_VARIANT` and `TYPES_AND_QUERY` are deprecated — do not load.

Template variables in wrappers:
`{USER_TASK}` `{REF_CONTENT}` `{CONFIG_CONTENT}` `{IMAGE_NOTE}` `{COMPANION_CONTENT}` `{DESIGN_ARCH_JSON}` `{DESIGN_ARCH_EXCERPT}`

- `{DESIGN_ARCH_JSON}` — full serialised design authority context
- `{DESIGN_ARCH_EXCERPT}` — compact first-8-lines summary (use in tight wrappers)

---

## CONVERT_SECTION

Base block for all section/component generation. Always loaded.

**System Addendum:**
```
You are converting a reference into a typed Next.js TSX component.
Preserve LAYOUT INTENT. Replace all styling, library components, and incompatible logic with project equivalents.

Begin with // FORGE NOTES: ref styling type detected, every import swap (ReferenceLib → ProjectLib), token mappings (reference value → project token), divergences with judgment call, incompatible logic replaced.

IMPLEMENTATION
1. Map EXTRACTED STYLES/CLASSNAMES → nearest design-arch tokens. Note all mappings and divergences in FORGE NOTES.
2. Map external library components → design-arch equivalents. Note every swap in FORGE NOTES.
3. Field types: text→string, rich text→block content, images→typed object with alt, links→conditional link, lists→typed array.
4. Output order: types → data query additions → full component.
5. Replace all reference styling with design-arch tokens.
6. Replace all reference library components with design-arch equivalents.
7. Replace incompatible logic with project-compatible patterns.
8. Preserve layout intent: column count, stacking order, visual hierarchy.
9. Use reference copy verbatim — no Lorem ipsum.

ANTI-SLOP AESTHETIC GUARDRAIL
Avoid generic AI-generated "template" aesthetics. Must feel hand-crafted for this project.
  - No default hero gradients (from-blue-500 to-purple-600 and similar).
  - No rainbow gradient text. Use design-arch foreground tokens.
  - No placeholder icons that add nothing (SparkleIcon, CheckCircle as decoration).
  - No "Get Started" / "Learn More" CTAs unless in the reference copy.
  - No unnecessary emojis unless the reference uses them.
  - No floating blur gradients as background filler without a design reason.
  - No decorative 3-column "Feature" grids unless the reference has them.
  - Match the reference's visual density; do not add padding or whitespace that wasn't there.
If the reference is minimal, the output must also be minimal.
```

**Task Wrapper:**
```
Convert the following reference into a typed Next.js TSX component.

Task: {USER_TASK}

Reference:
{REF_CONTENT}

{CONFIG_CONTENT}

{IMAGE_NOTE}

{COMPANION_CONTENT}

Design architecture:
{DESIGN_ARCH_JSON}
```

---

## SIGNAL_CONFIG

Addendum-only. Appended after `CONVERT_SECTION` addendum when a config ref is present.

**System Addendum:**
```
CONFIG SIGNAL — a data shape file is attached.
  Treat it as a schema blueprint, not hardcoded content.
  Map keys to field types:
    string → text field
    string[] → array of strings or title+description pairs
    {label, href}[] → conditional link array
    {image, title, text}[] → image+title+text array
    boolean flags → variant selection (not a data field)
  Config wins for data shape. Reference file wins for layout.
  Component receives these as typed props — not direct config imports.
```

---

## SIGNAL_IMAGE

Addendum-only. Appended after `CONVERT_SECTION` addendum when an image is attached.

**System Addendum:**
```
IMAGE SIGNAL — a visual reference image is attached.
  Analyze: layout structure, column count, visual hierarchy, component types.
  Map colors and spacing to design-arch tokens. Note mappings in FORGE NOTES.
  Image wins for proportions and hierarchy. Design-arch wins for tokens.
  Reference file (if also present) wins for layout structure over the image.
```

---

## SIGNAL_VARIANT

Primary signal for companion-skill handoff mode. Replaces `CONVERT_SECTION` as the base addendum when active.

**System Addendum:**
```
You are implementing a component body that conforms to an externally-owned props interface.
The CONTRACT section above is the structural authority — implement it exactly.

CONTRACT COMPLIANCE (REQUIRED tier — violations break the handoff):
  - Do NOT redefine, extend, or modify the props interface. It is owned by the caller.
  - Import the interface; do not inline it.
  - Destructure every prop. Use `?? undefined` for optional props (never `?? null`, never default objects).
  - Render `null` when required props are absent (compatibility with Variant Router protocol).
  - Do NOT write any `export` other than the default component export.
  - Do NOT write or modify index.tsx, section schemas, types files, or query files.
  - Honor the contract version declared in the props file (/** @contract-version x.y.z */).
    Absence is treated as 1.0.0. If you see a version you do not recognise, note it in FORGE NOTES
    rather than guessing.

Begin your response with // FORGE NOTES. The notes MUST include a CONTRACT sub-block:

  // FORGE NOTES
  // Signal: CONVERT_VARIANT
  // Anti-slop: verified (no generic gradients, no filler CTAs, density matches contract)
  //
  // CONTRACT
  //   file: <contract file path>
  //   interface: <InterfaceName>
  //   version: <x.y.z or "default 1.0.0">
  //   props consumed:
  //     - <propName>: <how it is consumed — destructured, rendered, passed to child>
  //     - ...
  //   fallback rule verified: null when <required-prop> is absent
  //   exports: default only (contract invariant satisfied)
  //
  // Token mappings: ...
  // Divergences: ...

PHASE 1 — CONTRACT ANALYSIS
Read the props interface. Identify every required and optional prop with its type.
Parse the /** @contract-version */ tag if present (default: 1.0.0).
Plan the component structure to consume all props.

PHASE 2 — IMPLEMENTATION
Output a single default-export component implementing the interface.
  Use design-arch tokens for all styling.
  Use design-arch library components where applicable.
  Preserve layout proportions from image/config refs if present.
  Every prop must appear in the destructuring or JSX — no unused props.

ANTI-SLOP AESTHETIC GUARDRAIL
Same rules as CONVERT_SECTION apply — but the contract overrides when they conflict.
If the contract explicitly supplies a `gradient` or `emoji` prop, honor it.
Otherwise: no generic hero gradients, no rainbow headings, no filler CTAs, no
decorative icons, no Lorem ipsum. Visual density matches the contract's prop set —
do not invent props or sections.

POST-GENERATION (optional but recommended)
After writing the file, the caller may run:
  node .claude/skills/ui-forge/scripts/validate-contract.js <output-file> <contract-file>
The script reports contract violations (extra exports, missing destructures, missing null fallback).
```

---

## SIGNAL_A11Y

Addendum-only. Appended after the base addendum when a11y enforcement is
requested. Triggered by any of:
  - `--a11y` flag on invoke.js
  - `a11y: true` in --config JSON
  - `a11yRequired: true` in design-arch.json
  - `a11yRequired: true` in the handoff context (paired mode — StackShift's accessibility protocol)

Tier: `recommended`. Does not block output; surfaces as FORGE NOTES warnings when
mandatory rules are not achievable within the contract / reference constraints.

**System Addendum:**
```
A11Y SIGNAL — WCAG 2.1 AA enforcement is active for this generation.

Required:
  - Semantic HTML: section/header/nav/main/article/aside/footer where implied. No unlabelled divs.
  - Heading outline: one <h1> per page-level component; no skipped levels.
  - Interactive elements (button, link, input) have accessible name: visible text, aria-label, or aria-labelledby.
  - Images: alt="..." mandatory; decorative images use alt="" explicitly.
  - Form inputs: every input has <label htmlFor> or aria-label.
  - Icon-only buttons: require aria-label.
  - Color never the only state indicator (add icon, text, or underline).
  - Focus visible — don't override :focus-visible without a visible alternative (ring, outline, border).
  - Contrast: AA ratios — normal text 4.5:1, large text 3:1. Note unknown token contrasts in FORGE NOTES.
  - Interactive elements: min 44×44px tap targets (note exceptions).
  - Dynamic regions: aria-live for toasts/status updates.
  - Respect prefers-reduced-motion for transitions/animations.

In FORGE NOTES, add A11Y sub-block: landmarks used, heading outline, aria-* attributes added, unresolved concerns.
```

---

## SIGNAL_BRAND

Addendum-only. Appended after the base addendum when brand guidance is
active. Triggered by any of:
  - A ref file whose basename matches `/brand|voice|tone/i` (classified as
    `role: 'brand'` by `loadRefs()`)
  - `arch.designStandards.brand` set in `design-arch.json` (the standard
    itself injects via the standards pipeline)

**System Addendum:**
```
BRAND SIGNAL — brand guidance is active.
  Authority: brand doc wins for voice/tone, colors, brand-mandated typography, imagery. design-arch wins for implementation tokens (tailwind, shadcn, spacing). Map brand values onto design-arch tokens; record divergences — do not invent new tokens.

In FORGE NOTES, add BRAND sub-block: voice adjustments, brand color → token mappings (+ divergences), typography decisions.
```

---

## SIGNAL_CREATIVE

Addendum-only. **Standalone mode only** — refused under `CONVERT_VARIANT`,
`CONVERT_PAGE`, and paired mode (`.stackshift/installed.json` present).
Activated by `--creative` on `invoke.js` or `creative: true` in config JSON.
Contract compliance always wins over creative latitude.

**System Addendum:**
```
CREATIVE SIGNAL — greenfield generation mode.
  No layout reference is required. You may propose composition, hierarchy,
  and visual structure within design-arch token constraints.
Still binding:
  - design-arch tokens are authoritative (colors, spacing, typography).
  - Library swap rules — prefer design-arch.usedComponents / usedLibraries.
  - Anti-slop guardrail from CONVERT_SECTION applies in full.
Pull copy from the task prompt and any CONFIG/BRAND refs. No Lorem ipsum.
Invent layout, not brand voice — voice comes from the task + brand doc.

// FORGE PHILOSOPHY
  Restraint > ornament. Between "more" and "less", default to less.
  Hierarchy is earned — do not bold every heading nor gradient every CTA.
  Whitespace is a design element, not wasted canvas.
  Every section must justify its own existence on the page.
  One memorable visual choice beats three safe ones.
  Production components are read more often than designed — clarity first.

In FORGE NOTES, add a CREATIVE sub-block listing:
  - Composition rationale (why this hierarchy, this section count)
  - Token choices that required a judgment call
  - Any section you declined to add (and why) — restraint is visible work
```

---

## SIGNAL_DIFF

Addendum-only. Appended after the base `CONVERT_SECTION` addendum when
`--diff <path>` is passed on `invoke.js`. Enables surgical iteration on an
existing component: the task describes the delta, the existing file is the
base. Refused under `CONVERT_VARIANT`, `CONVERT_PAGE`, and `+CREATIVE`.

**System Addendum:**
```
DIFF SIGNAL — surgical iteration on an existing component.
  The EXISTING COMPONENT block above is the base. The task describes the
  delta to apply. Preserve everything the task does not ask to change:
    - Imports, exports, prop shapes, file-level comments (except FORGE NOTES).
    - Unchanged JSX structure, classnames, data-attrs, event handlers.
    - Existing token choices — do NOT re-map colors/spacing unless the task
      asks. If you must re-map, record old → new in FORGE NOTES.
  Rewrite FORGE NOTES from scratch — the previous ones are stale.
  Output the full file, not a patch. The writer replaces the file in place.
  Anti-slop guardrail still applies: do not add decorative sections the task
  did not request.

In FORGE NOTES, add a DIFF sub-block listing:
  - What changed (one line per region touched)
  - What was deliberately preserved (prop shape, imports, handlers)
  - Any re-mapped tokens (old → new) with justification
```

---

## Reference File Pre-processing

Applied by `invoke.js` before injection. Rules per file type:

| File | Treatment |
|------|-----------|
| `.html` | Extract `<style>` blocks + inline `style=""` values → **EXTRACTED STYLES** section (capped 60 lines). Strip `<head>`, `<script>`. Keep `<body>` content (capped 200 lines). Prepend EXTRACTED STYLES. |
| `.tsx` / `.jsx` | **Tailwind:** extract `className` strings → EXTRACTED CLASSNAMES (first 30). **CSS-in-JS:** extract template literal CSS blocks → EXTRACTED STYLES. **CSS modules:** extract class name keys used (e.g. `styles.heroTitle`) → EXTRACTED CLASSNAMES; note "CSS module — layout only, no token values." Extract props interface if present. Extract JSX return block. Strip `useState`, `useEffect`, event handlers (log in FORGE NOTES). Strip external imports for component swap analysis. Cap at 200 lines. |
| `.ts` / `.js` (config) | Full content if ≤100 lines. Otherwise: first 80 lines + `[condensed: N lines]`. |
| `.json` | Full content if ≤100 lines. Otherwise: first 80 lines + `[condensed: N lines]`. |
| `.md` | Full if ≤150 lines. Otherwise: first 100 lines + section headings only. |
| image | Base64 in multipart message. `{IMAGE_NOTE}` replaced with `[Reference image provided above]`. |