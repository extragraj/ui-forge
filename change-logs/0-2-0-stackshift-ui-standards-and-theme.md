# 0.2.0 — StackShift UI Built-in Standards & Theme

**Date:** 2026-04-30

## What changed

### Built-in design standard — `stackshift-ui.md`

A single consolidated standards file, `references/standards/stackshift-ui.md`, replaces the former set of empty per-slot templates. It ships as the `stackshift-ui` slot and injects automatically for any project without a project-local override.

The file covers all StackShift UI conventions in one place:

| Section | Content |
|---------|---------|
| Typography | `<Heading>` / `<Text>` prop scale, `fontSize`/`weight` guidance, Sanity CMS font variable rule |
| Spacing | `<Section>` vertical rhythm (`py-12/16/20`), `<Container maxWidth>` rules, `<Flex gap={N}>` scale |
| Color | CMS-backed tokens only, no raw hex, no `dark:` prefix in variants, contrast floor notes |
| Accessibility | `<Section>` `aria-labelledby` rule, `<Image alt>` policy, `<FormField>` labeling, focus trap guarantees, `motion-reduce` |
| Components & conditionalLink | Full import pattern, component library table, `conditionalLink` → `<Button as="link">` enforcement rule |

### `conditionalLink` → `<Button as="link">` rule

Any Sanity field typed as `conditionalLink` — `primaryButton`, `secondaryButton`, `ctaButton`, `routes[]`, `links[]`, `navLinks[]`, `footerLinks[]` — must render with `<Button as="link" link={...}>` from `@stackshift-ui/button`. Raw `<a>` or Next.js `<Link>` bypasses the `linkType` routing logic and is now explicitly prohibited.

### New theme: `stackshift`

`themes/stackshift.json` is a new built-in theme preset for StackShift projects. Use it to seed `design-arch.json` on a fresh install:

```bash
node scripts/scan.js --theme stackshift
# or
/forge-scan --theme stackshift
```

Covers all `@stackshift-ui` scoped packages as `usedComponents`, CMS color tokens (`primary`, `secondary`, `background`, foreground variants), and the full set of StackShift conventions including the `conditionalLink` rule.

### `references/standards/sample-standard.md` added

A copy-paste template for creating custom project-local or built-in standards files. Shows the expected structure, section suggestions, and length limit guidance.

## Breaking changes

None. Existing projects that already have `design/standards/*.md` files are unaffected — project-local overrides always win over built-in fallbacks. Use `--no-default-standards` to opt out entirely.

## Files changed

- `references/standards/stackshift-ui.md` — new (consolidated single-file standard)
- `references/standards/sample-standard.md` — new (copy-paste template for new slots)
- `references/standards/README.md` — updated (reflects single-file approach)
- `themes/stackshift.json` — new
- `themes/README.md` — updated (removed deleted presets, added stackshift)
- `README.md` — updated version, theme list, standards section, changelog table
