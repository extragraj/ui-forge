# StackShift UI — Import Rule

All UI primitives, layout components, and section-level building blocks MUST come from `@stackshift-ui/*` scoped packages. Do NOT use raw HTML elements (`<h1>`, `<button>`, `<img>`, `<a>`, `<p>`, `<span>`, `<div>` for layout) or third-party component libraries when an equivalent `@stackshift-ui` component exists.

## Standard import pattern

```tsx
import { Button } from "@stackshift-ui/button";
import { Container } from "@stackshift-ui/container";
import { Flex } from "@stackshift-ui/flex";
import { Grid, GridItem } from "@stackshift-ui/grid";
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
