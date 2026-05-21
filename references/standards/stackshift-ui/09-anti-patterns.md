# StackShift UI — Anti-Patterns

> **Rule:** These approaches are wrong even when they appear to work. Each row gives a correct alternative.

## Imports

| Wrong | Why | Right |
|-------|-----|-------|
| `import * as Pkg from "@stackshift-ui/call-to-action"` | Barrel import bypasses `next/dynamic` — variants are not lazy-loaded; breaks code splitting | Import each component from its own package: `import { CallToAction } from "@stackshift-ui/call-to-action"` |
| `import React from "react"` | Next.js 17+ does not require the React import | Omit it entirely |
| `import { Image } from "next/image"` in a variant file | `StackShiftUIProvider` already wires `@stackshift-ui/image` to Next.js `<Image>` site-wide; direct import bypasses that wiring | Use `<Image>` from `@stackshift-ui/image` |
| `import { Link } from "next/link"` in a variant file | Same — `<Button as="link">` and `@stackshift-ui/link` are wired to Next.js Link by the provider | Use `<Button as="link" link={field}>` for conditionalLink fields |
| `import { StackShiftUIProvider } from "@stackshift-ui/system"` in a variant file | `@stackshift-ui/system` is for `pages/_app.tsx` setup only | Never import it in variant files |

## JSX

| Wrong | Why | Right |
|-------|-----|-------|
| `<h1>{title}</h1>` (raw HTML heading) | Skips the `@stackshift-ui/heading` API (`type`, `fontSize`, `weight`, `muted`) | `<Heading type="h1" fontSize="5xl" weight="bold">{title}</Heading>` |
| `<button>...</button>` (raw HTML button) | Skips variant/size API and provider wiring | `<Button variant="default">...</Button>` |
| `<img src={...} alt={...} />` (raw HTML image) | Misses the provider-injected Next.js `<Image>` optimization | `<Image src={...} alt={...} width={...} height={...} />` from `@stackshift-ui/image` |
| `<a href={...}>` for a `conditionalLink` field | Breaks `linkType` routing (internal vs external) | `<Button as="link" link={field}>` |
| `<section>...</section>` (raw HTML section) | Skips `<Section>` props and the landmark a11y wiring | `<Section className="py-20">...</Section>` |
| Conditional render branching on `linkType` | The `<Button as="link">` component reads `linkType` internally | Just pass `link={field}` and let the component route |

## Styling

| Wrong | Why | Right |
|-------|-----|-------|
| `<Button className="!font-bold">` | `!important` breaks the intentional override order managed by `tailwind-merge` | Pass the class normally — `tailwind-merge` ensures your `className` wins |
| `<Container className="py-20">` | `<Container>` is horizontal-only; padding belongs on `<Section>` | `<Section className="py-20"><Container>...</Container></Section>` |
| `<Flex gap="gap-6">` (string Tailwind class as the `gap` prop) | The `gap` prop is a number, not a class string | `<Flex gap={6}>` |
| Editing `styles/globals.css` to override `@stackshift-ui` component styles | Relies on internal class names that change with package updates; bypasses `tailwind-merge` | `StackShiftUIProvider` wrapper with `className` prop |
| Targeting `@stackshift-ui` internals from `tailwind.config.ts` | Same fragility | `StackShiftUIProvider` wrapper |
| `<Component style={{ ... }}>` inline style | Bypasses the theming system and `cn()` merge logic | Use `className` directly on the component |
| `bg-[#0045d8]` raw hex in JSX | Bypasses the CMS-controlled CSS variable theme | `bg-primary` (or another token-backed class) |
| `dark:bg-foreground` in variant files | CMS theme system handles light/dark mode switching globally; `dark:` in source belongs to non-paired projects | Use the CSS-variable-backed tokens (`bg-background`, `text-foreground`) — they switch automatically |

## Data

| Wrong | Why | Right |
|-------|-----|-------|
| `<Heading>{title ?? "Welcome"}</Heading>` | Content must come from Sanity; `??` fallback strings make missing data invisible | `{title && <Heading>{title}</Heading>}` — conditional render so missing data is honestly missing |
| `<Heading>Welcome to our site</Heading>` (hardcoded literal) | Same — bypasses the CMS | All visible copy comes from props |
| `<Section><h2>Section title</h2></Section>` with no `aria-labelledby` | The section landmark has no accessible name | `<Section aria-labelledby="title-id"><Heading id="title-id" ...>{title}</Heading></Section>` |

## Naming (cross-link)

Variant key sequence is owned by StackShift, not UI Forge. But when a task references a variant key sequence:

| Wrong | Why | Right |
|-------|-----|-------|
| `variant_ac` after `variant_h` | Two-letter suffixes are reserved for **after** `variant_z` is exhausted | `variant_i` (the next single letter) |
| `variant_aa` after `variant_h` | Same | `variant_i` |

If you see a two-letter variant key in the input while single letters before `z` are still available, flag it in FORGE NOTES — it's almost certainly a mistake.
