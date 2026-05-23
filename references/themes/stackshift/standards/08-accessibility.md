# StackShift UI — Accessibility

Supplements `SIGNAL_A11Y` — does not duplicate WCAG 2.1 AA rules enforced there. These rules are StackShift-specific additions for components from `@stackshift-ui/*`.

## Section landmarks

`<Section>` renders as a `<section>` element. Every `<Section>` must have an accessible name so assistive technologies can identify the landmark:

```tsx
// ✅ Preferred — aria-labelledby pointing to the visible heading
<Section aria-labelledby="features-heading" className="py-16">
  <Container maxWidth={1280}>
    <Heading type="h2" id="features-heading" fontSize="3xl">Features</Heading>
    {content}
  </Container>
</Section>

// ✅ Acceptable — aria-label when no visible heading exists
<Section aria-label="Customer testimonials" className="py-16">
```

## Component accessibility guarantees

`@stackshift-ui` components implement WAI-ARIA patterns internally. Do not add redundant `role=` or `aria-*` props unless overriding provider behavior:

| Component | Built-in guarantee |
|-----------|-------------------|
| `dialog` | Focus trap, aria-modal, escape-to-dismiss via Radix |
| `sheet` | Focus trap, aria-modal via Radix |
| `dropdown-menu` | Roving tabindex, keyboard navigation via Radix |
| `accordion` | aria-expanded, keyboard navigation |
| `toast` | aria-live region managed internally |
| `tooltip` | aria-describedby wiring |

## Image alt text

`<Image>` from `@stackshift-ui/image` requires a non-empty `alt` prop. Never omit it.

```tsx
// ✅ Descriptive alt
<Image src={src} alt="Team photo at company offsite 2025" width={600} height={400} />

// ✅ Decorative — explicitly empty
<Image src={decorativeBlob} alt="" width={200} height={200} />

// ❌ Missing alt — will not render correctly and fails accessibility audit
<Image src={src} width={600} height={400} />
```

## Form labeling

Use `@stackshift-ui/form-field` for all form inputs. It auto-associates the label with the input via `htmlFor`/`id` internally — prefer it over manually wiring `htmlFor` and `id`:

```tsx
import { FormField } from "@stackshift-ui/form-field";
import { Input } from "@stackshift-ui/input";
import { Label } from "@stackshift-ui/label";

<FormField>
  <Label>Email address</Label>
  <Input type="email" placeholder="you@example.com" />
</FormField>
```

## Focus management

`@stackshift-ui/dialog` and `@stackshift-ui/sheet` trap and restore focus automatically via Radix primitives. Do not implement custom focus traps for these components.

## Motion reduction

Add `className="motion-reduce:transition-none"` on any element with a CSS transition or animation. Carousel autoplay must pause when `prefers-reduced-motion` is set — use the SwiperButton/SwiperPagination components which handle this internally.

## Live regions

Use `@stackshift-ui/toast` for async status messages — it manages its `aria-live` region internally. Do not add raw `aria-live` attributes unless the toast component cannot fulfill the use case.
