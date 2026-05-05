# 0.2.7B — FORGE NOTES placement spec fix (Group D-1)

Resolves a latent spec conflict between the main generation instructions and body-only mode instructions for where to place `// FORGE NOTES` in generated output.

## FORGE NOTES placement conflict resolved

**Issue D-1** — Two contradictory instructions existed for `// FORGE NOTES` placement:

| Source | Instruction |
|--------|-------------|
| `CONVERT_SECTION` addendum in `prompt-patterns.md` | "Begin with `// FORGE NOTES`" (implies absolute top of file) |
| `buildVariantContext()` in `invoke.js` (body-only mode) | "Place `// FORGE NOTES` immediately after the last import statement" |

The runtime behavior in `invoke.js` was already correct — body-only mode placed FORGE NOTES after imports. But the spec in `prompt-patterns.md` never explicitly acknowledged the override, creating a latent bug where a future agent following only the main instruction would produce a syntactically invalid file.

### Changes

| File | Change |
|------|--------|
| `references/prompt-patterns.md` | Added explicit **Body-only mode override** callout at the top of the `CONVERT_SECTION` block, documenting that `--mode body-only` places FORGE NOTES after the last import, overriding the main "Begin with" instruction |
| `SKILL.md` | Added **Body-only mode exception** callout in the Output Format section, documenting the placement rule for body-only mode |
| `plan/ui-forge-issues-compiled.md` | Updated D-1 status from "Open" to "Resolved in 0.2.7B" |

### Scope

Documentation-only fix. No runtime code changes — `invoke.js` `buildVariantContext()` already had the correct behavior.