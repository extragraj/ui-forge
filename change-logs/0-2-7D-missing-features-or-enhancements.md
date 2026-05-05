# 0.2.7D — Missing Features / Enhancements

**Date:** 2026-05-05
**Scope:** Documentation, standards, and workflow spec updates for four missing features identified in the compiled issues report.

## Documented modification/fix mode for rebuild use cases

**Issue:** UI Forge was skipped entirely on fix/rebuild tasks because the workflow spec did not document when to use `--mode body-only` vs. full generation. This caused the AI to write components manually, requiring 5 correction passes instead of 1.

**Fix:** Added a **"Modification / Fix Mode"** section to `references/prompt-patterns.md` under the `CONVERT_SECTION` block, including:
- A prose description of when to use `--mode body-only` (fix, rebuild, or modification of an existing component)
- A comparison table covering all 9 aspects: use case, `--output`, imports, exports, FORGE NOTES placement, `+CONFIG` modifier, anti-slop checks, postcondition validation, and `--refs` requirements
- Explicit note that postcondition validation and FORGE NOTES are required in both modes

## Added mechanical anti-slop fidelity checklist against reference HTML

**Issue:** The anti-slop guardrail was instruction-based (telling the AI to compare) but did not require a traceable checklist. Padding, background color, and icon container divergences from the reference HTML were not caught until user review.

**Fix:** Added an **`ANTI-SLOP FIDELITY CHECK`** section to the `CONVERT_SECTION` system addendum in `references/prompt-patterns.md` with a 5-item checklist:
- Extract padding/margin values from ref CSS → exact Tailwind equivalents
- Confirm background: dark vs light
- Confirm decorative elements: patterns, watermarks, gradient overlays
- Confirm icon container: size, background, border-radius
- Confirm button/CTA style: underline, filled, outlined

Each finding must be reported in FORGE NOTES before writing TSX.

## Documented `+IMAGE` fallback requirement for vision-provided screenshots

**Issue:** When a screenshot is provided to the AI via system context (not as a `--refs` path), `+IMAGE` is never added because the modifier only fires on explicit `--refs` image paths.

**Fix:** Added a documentation note to the `SIGNAL_IMAGE` block in `references/prompt-patterns.md` explaining:
- `+IMAGE` is only triggered when an image is passed via `--refs path/to/screenshot.png`
- Screenshots provided via system context (pasted into chat) will NOT trigger the modifier
- Workaround: re-invoke with `--refs path/to/screenshot.png` to activate the full `+IMAGE` signal addendum

## Created built-in Next.js + Sanity image rendering standard

**Issue:** No built-in standard covered how to render images in Next.js + Sanity + TypeScript projects. This resulted in the AI either using `<img>` directly instead of Next.js `<Image>`, missing the `fill` prop + relative-positioned container pattern, omitting `sizes` attribute, or not knowing the Sanity `urlFor()` helper pattern.

**Fix:** Created `references/standards/nextjs-image.md` covering:
- `fill` prop pattern for responsive images in containers
- Type-safe `urlFor()` usage with object vs string type checking
- Container pattern with `relative w-full aspect-[4/3] overflow-hidden`
- `sizes` attribute requirements (required when using `fill`)
- Mutual exclusivity of `fill` vs `width`/`height`
- Sanity GROQ projection shapes for image queries
- FORGE NOTES recording guidance

The standard is auto-loaded by `invoke.js` Step 3 for all projects (not gated by `isStackShift`), so every Next.js + Sanity project benefits.

## Files changed

| File | Change |
|------|--------|
| `references/prompt-patterns.md` | Added Modification/Fix Mode section (F-1), ANTI-SLOP FIDELITY CHECK (F-2), +IMAGE fallback note (F-3) |
| `references/standards/nextjs-image.md` | **New file** — Next.js + Sanity image rendering standard (F-4) |
| `references/standards/README.md` | Added `nextjs-image.md` to built-in standards table |
| `README.md` | Updated Built-in Design Standards section to mention `nextjs-image.md` |