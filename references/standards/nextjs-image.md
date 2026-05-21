# Next.js + Sanity Image Rendering

**Scope:** Applies to any Next.js + Sanity + TypeScript project — not StackShift-specific.
**Auto-loaded by:** `invoke.js` Step 3 for all projects (not gated by `isStackShift`).

> **Paired-mode interaction (`isStackShift: true`):** When this project follows StackShift conventions, use `<Image>` from `@stackshift-ui/image` instead of importing `next/image` directly. `StackShiftUIProvider` already wires `<Image>` to Next.js Image site-wide, so variant files get the optimizations described here without the direct import. The patterns below (fill prop, urlFor type safety, container shape, sizes attribute) still apply — they live inside the provider's `components/ui/image.tsx` wrapper rather than inside each variant. See `stackshift-ui/01-import-rule.md` and `stackshift-ui/07-setup.md`.

## `fill` prop pattern (responsive images in containers)

Use Next.js `<Image fill>` inside a container with `position: relative` and explicit dimensions.
The container controls the size; the image fills it.

## Type-safe `urlFor()` usage

To prevent type issues, the data passed to `urlFor()` should be an object. Implement a type check on the data passed to `src`:

- If `mainImage.image` is an **object** (contains `_ref`), pass `urlFor(mainImage.image)` to `src`.
- If `mainImage.image` is a **string** (already dereferenced by GROQ query), pass `mainImage.image` directly to `src`.

This handles the case where the `mainImage.image` object does not contain the `_ref` property but has been turned into a string after being dereferenced by the GROQ query.

```tsx
// Type-safe image src resolution
const imageSrc = typeof mainImage.image === 'object'
  ? urlFor(mainImage.image)
  : mainImage.image
```

## Container pattern

```tsx
<div className="relative w-full aspect-[4/3] overflow-hidden">
  <Image
    src={urlFor(mainImage.image)}
    alt={mainImage.alt ?? ''}
    fill
    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
    className="object-cover"
  />
</div>
```

## `sizes` attribute (required when using `fill`)

Match the container's responsive widths:

```
sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
```

## Never use `width` + `height` with `fill`

`fill` is mutually exclusive with `width`/`height`. Use one or the other.

- Use `fill` when the container controls the dimensions (responsive).
- Use explicit `width` + `height` when the image has fixed dimensions.

## Sanity GROQ projection shape

When querying images from Sanity, the GROQ projection should include the image asset reference:

```groq
mainImage {
  alt,
  "image": image.asset->url
}
```

Or for the full object with hotspot/crop:

```groq
mainImage {
  alt,
  image {
    asset->
  }
}
```

## FORGE NOTES recording

When applying this standard, record in FORGE NOTES:
- Which pattern was used (`fill` vs explicit `width`/`height`)
- The `sizes` attribute value chosen
- Any type-safe `urlFor()` handling applied