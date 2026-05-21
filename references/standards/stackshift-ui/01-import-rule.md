# StackShift UI — Import Rule

All UI primitives, layout components, and section-level building blocks MUST come from `@stackshift-ui/*` scoped packages. Do NOT use raw HTML elements (`<h1>`, `<button>`, `<img>`, `<a>`, `<p>`, `<span>`, `<div>` for layout) or third-party component libraries when an equivalent `@stackshift-ui` component exists.

## Standard import pattern

```tsx
import { Button } from "@stackshift-ui/button";
import { Container } from "@stackshift-ui/container";
import { Flex } from "@stackshift-ui/flex";
import { Grid } from "@stackshift-ui/grid";
import { GridItem } from "@stackshift-ui/grid-item";
import { Heading } from "@stackshift-ui/heading";
import { Image } from "@stackshift-ui/image";
import { Section } from "@stackshift-ui/section";
import { Text } from "@stackshift-ui/text";
```

Import each component from its own individual package. Never barrel-import multiple components from a single `@stackshift-ui/*` path.

## Full component library

| Category | Packages |
|----------|----------|
| Layout | `section`, `container`, `flex`, `grid`, `grid-item` |
| Typography | `heading`, `text` |
| Buttons & Links | `button`, `link` |
| Media | `image`, `youtube-video` |
| Data Display | `card`, `badge`, `avatar`, `social-icons`, `stats-card`, `skeleton` |
| Forms | `input`, `textarea`, `select`, `checkbox`, `checkbox-group`, `radio`, `radio-group`, `switch`, `label`, `form-field`, `form`, `webriq-form`, `input-file`, `date-picker`, `calendar` |
| Overlay & Interactive | `dialog`, `sheet`, `popover`, `tooltip`, `dropdown-menu`, `menu`, `accordion`, `toast` |
| Navigation & Data | `pagination`, `data-table`, `table`, `scroll-area`, `toggle`, `toggle-group` |
| Carousel | `swiper-button`, `swiper-pagination` |
| Utilities | `blockstyle` |

All are scoped under `@stackshift-ui/`. Example: `import { Badge } from "@stackshift-ui/badge"`.

## Card sub-components

`@stackshift-ui/card` exports: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`. All accept `className`.

```tsx
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@stackshift-ui/card";
```

## Provider — do not import in variant files

`@stackshift-ui/system` exports `StackShiftUIProvider` and `useStackShiftUIComponents`. These are for `pages/_app.tsx` setup only. Never import from `@stackshift-ui/system` in variant files.

## Provider awareness — do not import next/image or next/link

`StackShiftUIProvider` (configured in `pages/_app.tsx`) replaces `<Image>` from `@stackshift-ui/image` with Next.js `<Image>` and `<Link>`/`<Button as="link">` with Next.js `<Link>` **site-wide**. Variant files should use the `@stackshift-ui` components — they will automatically render through Next.js primitives:

```tsx
// ✅ Correct — the provider wires this to next/image
import { Image } from "@stackshift-ui/image"

// ✅ Correct — the provider wires the anchor to next/link
import { Button } from "@stackshift-ui/button"
<Button as="link" link={primaryButton}>Click here</Button>

// ❌ Wrong — bypasses the provider; image is no longer swappable site-wide
import Image from "next/image"

// ❌ Wrong — same problem; loses the conditionalLink routing
import Link from "next/link"
```

See `07-setup.md` for the full provider configuration. To customize the Next.js Image/Link wrapper site-wide, edit `components/ui/image.tsx` / `components/ui/link.tsx` — not the variant file.
