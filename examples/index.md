# UI Forge — Examples Index

Each numbered folder is a self-contained walkthrough: ref input, captured
`forge-stdout.txt` (what `invoke.js` would print to the AI), generated
output, and a stub `design-arch.json` so the example reproduces locally.

## Router

| # | Example | Signal(s) | What it shows |
|---|---------|-----------|---------------|
| 01 | [`01-hero-section/`](./01-hero-section/) | `CONVERT_SECTION` | HTML hero → typed Next.js section. Inline styles + `<style>` block extraction; image swap to `next/image`. |
| 02 | [`02-marketing-page/`](./02-marketing-page/) | `CONVERT_PAGE` | Long landing page → Stage 1 decomposition plan (`forge-page-plan.json`). Stage 2 would emit per-section context. |
| 03 | [`03-config-driven/`](./03-config-driven/) | `CONVERT_SECTION` `+CONFIG` | HTML + JSON data shape → component with typed props derived from the config ref. |
| 04 | [`04-stackshift-variant/`](./04-stackshift-variant/) | `CONVERT_VARIANT` | StackShift props interface only → variant component that imports (not redefines) the props, with contract enforcement. |
| 05 | [`05-brand-tokens/`](./05-brand-tokens/) | `CONVERT_SECTION` `+BRAND` | HTML ref + brand tokens JSON → component respecting brand color/type palette, with brand-aware decisions logged in FORGE NOTES. |
| 06 | [`06-a11y-form/`](./06-a11y-form/) | `CONVERT_SECTION` `+A11Y` | Form HTML → accessible form: label/aria binding, error semantics, focus management documented in FORGE NOTES. |
| 07 | [`07-image-reference/`](./07-image-reference/) | `CONVERT_SECTION` `+IMAGE` | Screenshot (PNG) ref → features grid with image card. AI reads the image via vision; FORGE NOTES record layout and token decisions. |

## Reproducing an example locally

Each folder contains:

```
NN-name/
├── input/             # the refs you would point --refs at
├── output/            # what the AI wrote after reading forge-stdout
├── design-arch.json   # stub authority (drop into design/design-arch.json)
└── forge-stdout.txt   # the printed context block captured at example time
```

The `design-arch.json` is a stub — minimal but valid v4 arch that makes
the example reproducible without scanning a real project. Drop it at
`<project>/design/design-arch.json`, point `invoke.js --refs` at the
files under `input/`, and you should produce output similar to what's in
`output/`.

`forge-stdout.txt` is the **literal stdout** from `invoke.js` for that
example — useful for diffing when changing prompt patterns or signal
composition.

## Adding a new example

1. Create `examples/NN-short-name/` (next sequential number).
2. Drop ref inputs into `input/`.
3. Write a minimal `design-arch.json` (componentLib, tailwind theme,
   patterns, any `designStandards` slots the example needs).
4. Run `node scripts/invoke.js --task "..." --refs input/... --output output/...`
   and capture stdout → `forge-stdout.txt`.
5. Save the generated component under `output/`.
6. Add a row to the router table above.

See [`../references/docs/advanced-usage.md`](../references/docs/advanced-usage.md)
for the full flag matrix and signal composition rules.
