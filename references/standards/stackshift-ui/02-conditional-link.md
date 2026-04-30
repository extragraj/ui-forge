# StackShift UI — conditionalLink Rule

## What is conditionalLink

`conditionalLink` is a Sanity schema type used for any field that can link to either an internal page or an external URL. The rendered output differs based on `linkType` — the component must read this field to route correctly.

Common field names that are always `conditionalLink` type:
`primaryButton`, `secondaryButton`, `ctaButton`, `button`, and any item inside `routes[]`, `links[]`, `navLinks[]`, `footerLinks[]`, `socialLinks[]`.

## Required pattern

Any field typed `conditionalLink` **must** be rendered using `<Button as="link">` from `@stackshift-ui/button`:

```tsx
import { Button } from "@stackshift-ui/button";

<Button
  as="link"
  aria-label={primaryButton?.label || "Primary action"}
  link={primaryButton}
  variant="unstyled"
>
  {/* Button content / styled children here */}
</Button>
```

## The `link` prop shape

```ts
{
  label: string;
  linkType: "linkInternal" | "linkExternal";
  internalLink: { slug: string; /* ... */ };
  externalLink: string;
  linkTarget: "_blank" | "_self" | undefined;
}
```

The `<Button as="link">` component reads `linkType` internally and renders either a Next.js `<Link>` (for internal routes) or an `<a target>` (for external URLs). This routing logic lives in the component — callers never need to branch on `linkType` themselves.

## Choosing a variant

| Goal | Use |
|------|-----|
| Full custom styling via className or children | `variant="unstyled"` |
| Standard filled button style | `variant="default"` |
| Bordered outline style | `variant="outline"` |
| Muted secondary style | `variant="secondary"` |
| Ghost (no background, no border) | `variant="ghost"` |
| Looks like a hyperlink | `variant="link"` |

## What NOT to do

```tsx
// ❌ Raw anchor — bypasses linkType routing, breaks internal navigation
<a href={primaryButton?.externalLink}>{primaryButton?.label}</a>

// ❌ Next.js Link directly — cannot handle external URLs or linkType branching
<Link href={primaryButton?.internalLink?.slug}>{primaryButton?.label}</Link>

// ❌ Conditional rendering — duplicates logic the component already handles
{primaryButton?.linkType === "linkInternal"
  ? <Link href={...}>{primaryButton.label}</Link>
  : <a href={...}>{primaryButton.label}</a>}
```

## aria-label

Always pass `aria-label` on `<Button as="link">`. Use the link's `label` field with a sensible fallback:

```tsx
aria-label={primaryButton?.label || "Learn more"}
```
