# Prompt Patterns

Composition rules:
- `CONVERT_SECTION` provides the base **addendum** and the **wrapper** for all generation calls.
- `SIGNAL_CONFIG` and `SIGNAL_IMAGE` provide **addendum-only** blocks appended after the base.
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

Rules:
  - Do NOT redefine, extend, or modify the props interface. It is owned by the caller.
  - Destructure every prop. Use `?? undefined` for optional props (never `?? null`, never default objects).
  - Render `null` when required props are absent (compatibility with Variant Router protocol).
  - Do NOT write any `export` other than the default component export.
  - Do NOT write or modify index.tsx, section schemas, types files, or query files.

Begin your response with // FORGE NOTES covering:
  - Contract file and interface name
  - Every prop and how it is consumed
  - Token mappings from design-arch applied
  - Any layout decisions inferred from config/image refs

PHASE 1 — CONTRACT ANALYSIS
Read the props interface. Identify every required and optional prop with its type.
Plan the component structure to consume all props.

PHASE 2 — IMPLEMENTATION
Output a single default-export component implementing the interface.
  Use design-arch tokens for all styling.
  Use design-arch library components where applicable.
  Preserve layout proportions from image/config refs if present.
  Every prop must appear in the destructuring or JSX — no unused props.
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