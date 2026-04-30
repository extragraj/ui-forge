# StackShift UI — Component Props Reference

`className` is supported on every `@stackshift-ui` component. Classes merge via the internal `cn()` utility (clsx + tailwind-merge) — your classes always win over the component's internal defaults. Use built-in props first; reach for `className` only when the built-in API cannot express the required style.

## Button

| Prop | Values |
|------|--------|
| `variant` | `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`, `unstyled` |
| `size` | `default`, `sm`, `lg`, `icon` |
| `as` | `"link"` — renders as anchor/Next.js Link for `conditionalLink` data |
| `link` | `{ label, linkType, internalLink, externalLink, linkTarget }` — used with `as="link"` |
| `icon` | React node — icon element to render alongside label |
| `iconPosition` | `"left"`, `"right"` |

```tsx
<Button variant="outline" size="sm">Small Outline</Button>
<Button variant="unstyled" className="your-custom-styles">Unstyled</Button>
<Button as="link" link={primaryButton} variant="default">CTA</Button>
```

## Heading

| Prop | Values |
|------|--------|
| `type` | `h1`, `h2`, `h3`, `h4`, `h5`, `h6` |
| `fontSize` | `xs`, `sm`, `base`, `lg`, `xl`, `2xl`, `3xl`, `4xl`, `5xl` |
| `weight` | `thin`, `extralight`, `light`, `normal`, `medium`, `semibold`, `bold`, `extrabold`, `black` |
| `muted` | boolean — applies muted text color |

```tsx
<Heading type="h1" fontSize="5xl" weight="bold">Hero Title</Heading>
<Heading type="h2" fontSize="3xl" weight="semibold" className="mb-6">Section Title</Heading>
<Heading type="h3" fontSize="xl" weight="semibold">Card Title</Heading>
```

## Text

| Prop | Values |
|------|--------|
| `fontSize` | `xs`, `sm`, `base`, `lg`, `xl`, `2xl` |
| `weight` | Same as Heading (thin → black) |
| `muted` | boolean — applies muted text color |
| `as` | Any HTML element tag (default `p`) |

```tsx
<Text fontSize="base">Primary body copy</Text>
<Text fontSize="sm" muted>Secondary description or caption</Text>
<Text weight="bold" className="text-secondary mb-2">Styled emphasis</Text>
```

## Flex

| Prop | Values |
|------|--------|
| `align` | `start`, `end`, `baseline`, `stretch`, `center` |
| `direction` | `row`, `col`, `row-reverse`, `col-reverse` |
| `justify` | `normal`, `start`, `end`, `center`, `between`, `around`, `evenly`, `stretch` |
| `wrap` | boolean — enables flex-wrap |
| `gap` | number (Tailwind spacing units, e.g. `4` = `gap-4`) |
| `as` | Any HTML element tag (default `div`) |

```tsx
<Flex wrap justify="between" align="center" gap={6}>
  {items}
</Flex>

<Flex direction="col" gap={4} className="md:flex-row md:gap-8">
  {children}
</Flex>
```

## Container and Section

| Prop | Values |
|------|--------|
| `maxWidth` | `sm`, `md`, `lg`, `xl`, `2xl`, `full`, or a number (pixels) |
| `as` | Any HTML element tag (default `div`) |

```tsx
<Section className="py-20 bg-white">
  <Container maxWidth={1280}>
    {content}
  </Container>
</Section>
```

Always set vertical padding on `<Section>`, never on `<Container>`.
