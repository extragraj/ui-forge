# StackShift UI — Typography

## Rule

Use `<Heading>` from `@stackshift-ui/heading` and `<Text>` from `@stackshift-ui/text` for all text content. Never use raw HTML elements (`<h1>`–`<h6>`, `<p>`, `<span>`, `<strong>`, `<em>`) — always reach for the StackShift component equivalent.

## Heading scale

| Level | `type` | `fontSize` | `weight` | Use case |
|-------|--------|-----------|----------|----------|
| Primary page title | `h1` | `5xl` or `4xl` | `bold` | Hero section only |
| Section title | `h2` | `4xl` or `3xl` | `bold` or `semibold` | Top-level section headings |
| Sub-section title | `h3` | `2xl` or `xl` | `semibold` | Card titles, sub-sections |
| Fine-grained | `h4`–`h6` | `lg` or `base` | `medium` | Labels, supporting hierarchy |

```tsx
<Heading type="h1" fontSize="5xl" weight="bold" className="mb-4">
  Hero Headline
</Heading>

<Heading type="h2" fontSize="3xl" weight="semibold" className="mb-6">
  Section Title
</Heading>

<Heading type="h3" fontSize="xl" weight="semibold">
  Card or Sub-section Title
</Heading>
```

## Text scale

| Role | `fontSize` | `muted` | Notes |
|------|-----------|---------|-------|
| Body / primary | `base` | — | Default for paragraphs |
| Supporting / secondary | `sm` | `true` | Descriptions, captions under headings |
| Fine print / metadata | `xs` | `true` | Labels, timestamps, legal text |
| Large call-out | `lg` or `xl` | — | Intro paragraphs, pull quotes |

```tsx
<Text fontSize="base">Primary body copy goes here.</Text>
<Text fontSize="sm" muted>Supporting description or secondary info.</Text>
<Text fontSize="xs" muted>Published April 2026 · 3 min read</Text>
```

For inline emphasis, use the `weight` prop — never wrap in `<strong>`:

```tsx
<Text weight="bold" className="text-secondary mb-2">Bold inline text</Text>
```

## Font family

The global font is controlled by Sanity CMS via the `--font-global` CSS variable (default: `Open Sans`) and surfaced as the `font-global` Tailwind token. Do not hard-code `font-family` anywhere in variant files — CMS controls all font choices at the site level.

## Responsive type

No custom `clamp()` expressions in variant files. Use the component's `fontSize` prop for the base size and apply responsive Tailwind overrides via `className`:

```tsx
<Heading type="h1" fontSize="3xl" className="md:text-5xl lg:text-6xl">
  Responsive Heading
</Heading>
```

## Truncation

Use `className="truncate"` or `className="line-clamp-N"` directly on `<Text>` or `<Heading>` via the `className` prop. Do not wrap in extra elements.
