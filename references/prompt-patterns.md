# Prompt Patterns

Composition rules:
- `CONVERT_SECTION` provides the base **addendum** and the **wrapper** for all generation calls.
- `SIGNAL_VARIANT` replaces `CONVERT_SECTION` as the base addendum under companion-skill handoff mode.
- `SIGNAL_CONFIG`, `SIGNAL_IMAGE`, and `SIGNAL_A11Y` provide **addendum-only** blocks appended after the base.
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
The reference may have its own styling, library components, or logic incompatible
with this project. Preserve LAYOUT INTENT. Replace everything else with project equivalents.

Begin your response with // FORGE NOTES covering:
  - Ref type and styling approach detected (Tailwind classes, CSS-in-JS, inline styles, CSS module)
  - Every import swap: ReferenceLib → ProjectLib (search design-arch for equivalents)
  - Token mappings: reference color/spacing value → project token
  - Divergences: values with no close match, with your judgment call noted
  - Incompatible logic replaced (state, handlers, non-project libs)

PHASE 1 — DESIGN EXTRACTION
From EXTRACTED STYLES / EXTRACTED CLASSNAMES in the ref:
  Map each color/spacing value to the nearest design-arch token.
  Map each external library component to its design-arch equivalent.
  Note every mapping and divergence in FORGE NOTES.

PHASE 2 — CONTENT EXTRACTION
Identify: section category, field list, data types.
  text → string field
  rich text → block content
  images → typed image object with alt
  links → conditional link
  lists → typed array

PHASE 3 — IMPLEMENTATION
Output order: types → data query additions → full component.
  Replace all reference styling with design-arch tokens.
  Replace all reference library components with design-arch equivalents.
  Replace incompatible logic with project-compatible patterns.
  Preserve layout intent: column count, stacking order, visual hierarchy.
  Use reference copy as content examples.

ANTI-SLOP AESTHETIC GUARDRAIL
Avoid generic AI-generated "template" aesthetics. The component must feel
hand-crafted for this project, not pasted from a landing-page kit.
  - No default hero gradients (from-blue-500 to-purple-600 and similar).
  - No rainbow gradient text for headings. Use design-arch foreground tokens.
  - No placeholder icons that add nothing (SparkleIcon, CheckCircle as decoration).
  - No "Get Started" / "Learn More" CTAs unless present in the reference copy.
  - No unnecessary emojis, unless the reference explicitly uses them.
  - No floating blur gradients as background filler without a design reason.
  - No decorative 3-column "Feature" grids unless the reference has them.
  - Prefer real content over Lorem ipsum — use reference copy verbatim.
  - Match the reference's visual density; do not add padding or whitespace
    that wasn't there.
If the reference is genuinely minimal, the output should also be minimal.
Do not invent visual complexity to feel "more complete."
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

Required in the generated component:
  - Semantic HTML: use <section>, <header>, <nav>, <main>, <article>, <aside>,
    <footer> where the reference implies them. Never an unlabelled <div>.
  - Headings form a valid outline: exactly one <h1> per page-level component,
    subsequent headings descend without skipping levels.
  - Every interactive element (button, link, input) has an accessible name —
    either visible text, aria-label, or aria-labelledby.
  - Images: <img alt="..."> mandatory. Decorative images use alt="" explicitly.
  - Form inputs: every input has a <label htmlFor="..."> or aria-label.
  - Icon-only buttons: require aria-label.
  - Color is never the only indicator of state (add icon, text, or underline).
  - Focus states visible — do not override :focus-visible with outline-none
    unless a visible alternative (ring, outline, border) is provided.
  - Contrast ratios meet AA (normal text 4.5:1, large text 3:1). If design-arch
    tokens are used and their contrast is unknown, note it in FORGE NOTES.
  - Interactive elements have min 44×44px tap targets (or note exception).
  - Dynamic regions use aria-live where appropriate (toasts, status updates).
  - Respect prefers-reduced-motion when adding transitions or animations.

In FORGE NOTES, add an A11Y sub-block listing:
  - Landmarks used
  - Heading outline
  - Any aria-* attributes added
  - Unresolved a11y concerns and your judgment call
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