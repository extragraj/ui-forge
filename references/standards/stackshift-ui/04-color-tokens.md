# StackShift UI — Color Tokens

## Rule

Only use CMS-backed Tailwind tokens in variant JSX. Never use raw hex values (`#0045d8`), arbitrary Tailwind color scales (`blue-500`, `gray-200`), or inline styles for brand colors. Never add `dark:` Tailwind prefix modifiers in variant files — the CMS theme system controls light and dark mode values globally.

## Available tokens

| Tailwind class | CSS variable | Light default | Dark default |
|----------------|-------------|---------------|--------------|
| `bg-primary` / `text-primary` | `--color-primary` | `#0045d8` | `#0045d8` |
| `bg-secondary` / `text-secondary` | `--color-secondary` | `#3576ff` | `#3576ff` |
| `bg-background` | `--color-background` | `#F9FAFB` | `#1F2937` |
| `text-primary-foreground` | `--color-primary-foreground` | `#FFFFFF` | `#FFFFFF` |
| `text-secondary-foreground` | `--color-secondary-foreground` | `#FFFFFF` | `#FFFFFF` |
| `rounded-global` | `--border-radius` | `0.25rem` | — |
| `font-global` | `font-family` | `Open Sans` | — |

## Theming chain

```
Sanity CMS (themeSettings)
    ↓
pages/_app.tsx → setProjectTheme() → <style>:root{ ... }</style>
    ↓
CSS custom properties on :root
    ↓
tailwind.config.ts → maps CSS vars to Tailwind tokens
    ↓
Use in className: bg-primary, text-secondary, rounded-global, font-global
```

## Usage examples

```tsx
// ✅ Correct — using CMS-backed tokens
<Section className="bg-background">
  <Heading type="h2" className="text-primary">Heading</Heading>
  <Text className="text-secondary">Secondary text</Text>
  <Button className="rounded-global">Themed border radius</Button>
</Section>

// ❌ Wrong — raw hex in JSX
<Section className="bg-[#F9FAFB]">
<Text style={{ color: "#0045d8" }}>

// ❌ Wrong — arbitrary Tailwind color scale
<Section className="bg-blue-700">
```

## Neutral surfaces

Standard Tailwind neutral scales (`text-gray-700`, `bg-white`, `bg-gray-50`) are permitted for neutral surfaces and body text where no semantic CMS token applies.

## Contrast

`text-primary-foreground` on `bg-primary` and `text-secondary-foreground` on `bg-secondary` are pre-verified WCAG AA (white on `#0045d8`). For body copy on `bg-background`, use `text-primary` or Tailwind gray (`text-gray-700` or darker).

## Gradients

Avoid unless explicitly present in the reference design. When required, use only `from-primary to-secondary` and verify contrast at the midpoint. Never use decorative multi-stop or rainbow gradients.
