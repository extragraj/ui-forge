# [Standard Name] Standard

<!--
  SAMPLE TEMPLATE — copy, rename, and fill in to create a new standards slot.

  Filename (minus .md) becomes the slot key in generation context.
  Example: "motion.md" → injected as "--- STANDARD: motion ---"

  WHERE TO PUT IT
  ───────────────
  Project-local (auto-detected by scan.js):
    PROJECT_ROOT/design/standards/<key>.md

  Explicit reference from design-arch.json:
    "designStandards": { "motion": "./design/standards/motion.md" }

  Built-in fallback (injected for all projects using this skill):
    SKILL_ROOT/references/standards/<key>.md

  Resolution order (last wins per key): built-in → project → arch
  Opt out: --no-default-standards flag, or "_useBuiltins": false in arch.designStandards

  AUTHORING RULES
  ───────────────
  - Keep the file under ~3,000 characters — the injector truncates past that.
  - Write rules, not tutorials. "Never do X" beats "prefer Y" alone.
  - Include short code examples showing the ✅ correct and ❌ wrong pattern.
  - This file is intentionally non-substantive (only comments + headings) so it
    does not inject into generation context. Once you add real content below the
    headings, it becomes active.
-->

## Rules

## Anti-patterns

## Examples

## Quick reference
