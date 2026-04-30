# 0.2.2B — Theme and Preview Fixes

## Bug Fixes

### Missing theme presets: `mantine` and `plain-tailwind`

`scan.js --theme mantine` and `scan.js --theme plain-tailwind` were documented but failed at runtime because the corresponding JSON files did not exist in `themes/`. Added:

- `themes/mantine.json` — Mantine UI v7 (style props, CSS modules, no Tailwind dependency)
- `themes/plain-tailwind.json` — Plain Tailwind CSS with no component library

All three documented themes now work: `shadcn`, `mantine`, `plain-tailwind`.

### `--preview` confirmation invisible in Claude Code slash commands

The `forge-preview.html` file was always written correctly, but the confirmation message (`ui-forge: preview written → <path>`) was sent to `stderr`. Claude Code slash commands surface only `stdout` in the conversation, so users never saw the confirmation. Changed all three signal paths (CONVERT_SECTION, CONVERT_PAGE Stage 2, CONVERT_VARIANT) to write the confirmation to `stdout` so it appears in the output regardless of how the command is invoked.
