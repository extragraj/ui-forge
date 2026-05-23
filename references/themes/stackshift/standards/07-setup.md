# StackShift UI — Project Setup Requirements

## Tailwind content scanning

`tailwind.config.ts` must include the `@stackshift-ui` packages in the `content` array to prevent Tailwind from purging classes used inside the component library:

```ts
content: [
  "./pages/**/*.{js,ts,jsx,tsx}",
  "./components/**/*.{js,ts,jsx,tsx}",
  "./node_modules/@stackshift-ui/**/*.{js,ts,jsx,tsx}",  // required
],
```

Without this, Tailwind will strip classes used internally by `@stackshift-ui` components, causing broken styles in production.

## StackShiftUIProvider

`StackShiftUIProvider` from `@stackshift-ui/system` is configured once in `pages/_app.tsx`. It replaces the default implementations of any `@stackshift-ui` primitive for this site only — changes here do NOT affect other sites or Sanity Studio.

### Current setup

```tsx
import { StackShiftUIProvider } from "@stackshift-ui/system";
import { Image, Link } from "components/ui";

<StackShiftUIProvider components={{ Image, Link }}>
  <Component {...pageProps} />
</StackShiftUIProvider>
```

### Active overrides

**`Image`** — replaces the default `<img>` inside all `@stackshift-ui/image` usages with Next.js `<Image>` for optimization and lazy loading.

**`Link`** — replaces `<a>` tags inside all `@stackshift-ui/link` and `<Button as="link">` usages with Next.js `<Link>` for client-side navigation.

### Implication for variant files

Because Image and Link are replaced site-wide via the provider, variant files should use `@stackshift-ui/image` and `<Button as="link">` normally — they will automatically render with Next.js Image and Next.js Link without any extra wiring.

Do NOT import or re-implement `next/image` or `next/link` directly in variant files.

### Adding a new override

```tsx
import MyCustomButton from "components/ui/MyCustomButton";

<StackShiftUIProvider components={{ Image, Link, Button: MyCustomButton }}>
```

The key must match the component's display name. This applies to this site only.

## Updating @stackshift-ui packages

```bash
yarn update-stackshift        # update all @stackshift-ui packages to @latest
yarn update-stackshift:tag    # update to a specific tag (e.g. next)
```

To change a component across all sites and Sanity Studio, modify the `@stackshift-ui/{package}` source repository and publish a new version — do not use `StackShiftUIProvider` for cross-site changes.
