# 0.2.2A — Token Efficiency and LITE Optimization

**Date:** 2026-04-30

## What changed

### `scripts/invoke.js` — Introduced `--lite` mode for token optimization

Added a new `--lite` flag to significantly reduce the token footprint when using UI Forge with agentic models (Gemini, Claude Code, etc.). 

- **Referential Standards**: In `--lite` mode, stable design standards and instructions are referenced by file path instead of being inlined in the prompt. This reduces initial context size by **~90%** (e.g., from 60KB to 4KB).
- **Meta-Standard Filtering**: Automatically excludes documentation files like `README.md` and `sample-standard.md` from the generation context to reduce noise.
- **Library-Aware Standards**: `stackshift-ui` standards are now only injected if `isStackShift` is true in `design-arch.json`.
- **Condensed Arch Context**: The `DESIGN AUTHORITY` serialization is now much more compact in lite mode, omitting empty fields and truncation-heavy details.

### `scripts/invoke.js` — Core Fixes and Mode Defaults

- **Standardized `CONVERT_VARIANT` Default**: Changed the default `--mode` for the `CONVERT_VARIANT` signal from `body-only` to `full`. This prevents "missing file" errors when generating a new variant from a props interface and aligns with the help text.
- **CLI vs Config Precedence**: Fixed a bug where CLI flags were being overwritten by settings in a `--config` JSON file. CLI flags now correctly take precedence, allowing ad-hoc overrides (e.g., passing `--lite` alongside a config).
- **State Propagation**: Fixed an issue where the `isLite` state was not being passed to `loadComposedAddendum` during variant generation.

## Breaking changes

None. The `--lite` flag is opt-in and does not change default behavior.

## Files changed

- `scripts/invoke.js` — Added `--lite` flag, optimized context builders, fixed CLI precedence and mode defaults.
