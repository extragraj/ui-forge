# StackShift UI — Spacing

## Section rhythm

Wrap every top-level section in `<Section>` and set vertical padding via `className`. Never set padding on `<Container>` — it is for horizontal width-capping only.

| Section type | `className` on `<Section>` |
|-------------|---------------------------|
| Hero / featured / full-bleed | `py-20` |
| Standard content sections | `py-16` |
| Dense / utility / tight CTA | `py-12` |

```tsx
// ✅ Correct — padding on Section
<Section className="py-20 bg-white">
  <Container maxWidth={1280}>
    {content}
  </Container>
</Section>

// ❌ Wrong — padding on Container
<Section>
  <Container maxWidth={1280} className="py-20">
    {content}
  </Container>
</Section>
```

## Container

Use `<Container>` from `@stackshift-ui/container` to constrain content width. The `maxWidth` prop accepts named values or a pixel number:

| Value | Approximate width |
|-------|-------------------|
| `sm` | 640px |
| `md` | 768px |
| `lg` | 1024px |
| `xl` | 1280px |
| `2xl` | 1536px |
| `full` | 100% |
| Number | Exact pixel value |

Standard content width: `maxWidth={1280}` or `maxWidth="xl"`.

## Flex gap

Use `<Flex gap={N}>` with the numeric `gap` prop (Tailwind spacing units). Never pass a raw Tailwind class like `gap-6` as the `gap` prop value — it expects a number.

| `gap` value | Tailwind equivalent | When to use |
|-------------|--------------------|-|
| `gap={2}` | `gap-2` | Tight icon + label pairs |
| `gap={4}` | `gap-4` | Compact card rows, badge groups |
| `gap={6}` | `gap-6` | Standard content rows |
| `gap={8}` | `gap-8` | Loose feature grids |
| `gap={12}` | `gap-12` | Hero split layouts |

```tsx
<Flex wrap justify="between" gap={6}>
  {cards}
</Flex>
```

## Responsive layout

Mobile-first. Use `direction` prop for the base and `className` for responsive overrides:

```tsx
// Column on mobile, row on md+
<Flex direction="col" gap={6} className="md:flex-row md:gap-8">
  {children}
</Flex>

// Flex with responsive margin
<Flex wrap className="mb-0 lg:mb-12">
  {children}
</Flex>
```

## Card inner padding

`<Card>`, `<CardHeader>`, `<CardContent>`, and `<CardFooter>` apply internal padding by default. Only override with `className` when the design spec explicitly requires a deviation from the default.

## Grid

Use `<Grid>` and `<GridItem>` from `@stackshift-ui/grid` for CSS Grid layouts. Apply `gap` and column counts via `className`:

```tsx
<Grid className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <GridItem>{item}</GridItem>
</Grid>
```
