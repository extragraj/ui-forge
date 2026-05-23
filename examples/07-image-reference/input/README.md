# Image ref placeholder

`features-section.png` in this folder is a **1×1 transparent placeholder**.
The captured `forge-stdout.txt` and the example `output/FeaturesSection.tsx`
in this example were produced against a real screenshot showing:

- A 2×2 grid of feature blocks on the left
  (Fully integrated · Payments functionality · Prebuilt components · Improved platform)
  — each block has a small violet icon, a heading, and a 3-line muted description
- A card on the right with a rounded photograph of three people working at a desk,
  followed by the heading "Soft UI Design System", a 3-line description, and a
  pink "More about us →" link

To reproduce the example with vision-aware generation, drop your actual
design screenshot in place of `features-section.png` and re-run:

```bash
node scripts/invoke.js \
  --task "Convert features section with right-side image card" \
  --refs ./examples/07-image-reference/input/features-section.png \
  --output ./examples/07-image-reference/output/FeaturesSection.tsx
```

The AI then reads the PNG via its vision capability — UI Forge itself never
parses image bytes; the +IMAGE signal just tells the AI that the ref *is* an
image and to derive layout/tokens from it.
