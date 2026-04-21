# UI Forge — Reference Index

Use this file before reading a full reference doc. For targeted access use:
  Read("references/advanced-usage.md", offset=N, limit=50)
If line numbers feel stale, run: Grep("## SectionName", "references/advanced-usage.md")

## advanced-usage.md (750 lines)

| Topic | Heading | Approx. line |
|---|---|---|
| JSON config shapes, TS config files | `## Config File Usage` | 5 |
| Multiple refs (HTML + JSON + image) | `## Multiple Reference Files Composition` | 79 |
| Tailwind token overrides, spacing, global CSS | `## Custom Styling Token Mapping` | 133 |
| design-arch not found, ref not found, type errors | `## Troubleshooting Common Errors` | 187 |
| StackShift / skill chaining / CI integration | `## Integration with Workflow Skills` | 251 |
| `.forgeignore` syntax, `--ignore`, precedence | `## Ignore files and scan filtering (0.1.4+)` | 317 |
| Standards resolution, project slots, opt-out | `## Built-in design standards (0.1.4+)` | 390 |
| `+BRAND` authority, `+CREATIVE` refusal rules | `## Brand and Creative signals (0.1.5+)` | 463 |
| `--diff` behaviour, what is preserved | `## Iterative regeneration (+DIFF, 0.1.6+)` | 545 |
| `--theme` merge rules, available presets | `## Theme starters (scan.js --theme, 0.1.6+)` | 577 |
| Adding `SIGNAL_NAME`, detection logic | `## Advanced Signal Patterns` | 603 |
| Token budget, parallel generation | `## Performance Optimization` | 655 |
| `extractBlock()` format, custom blocks | `## Custom Prompt Patterns` | 695 |

## prompt-patterns.md (signal blocks)

Blocks are parsed by `extractBlock()`. Search for `## BLOCK_NAME` to find exact offset.

| Block | Role | Approx. line |
|---|---|---|
| `CONVERT_SECTION` | Base addendum for all section/component generation | 20 |
| `SIGNAL_CONFIG` | Addendum when JSON/config ref present | 82 |
| `SIGNAL_IMAGE` | Addendum when image ref present | 98 |
| `SIGNAL_VARIANT` | Base addendum for companion-skill (StackShift) handoff | 113 |
| `SIGNAL_A11Y` | WCAG 2.1 AA rules | 178 |
| `SIGNAL_BRAND` | Brand/voice authority split | 198 |
| `SIGNAL_CREATIVE` | Greenfield mode + `// FORGE PHILOSOPHY` | 213 |
| `SIGNAL_DIFF` | Surgical iteration rules | 243 |
