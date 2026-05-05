# 0.2.6 — `--validate-input` Standalone Fix

Fix the issue where: `--validate-input` without `--task` triggered the full help block instead of running the pre-flight contract validation. The mode now works correctly as a standalone gate.

## Changes

### `--validate-input` no longer requires `--task` (A-1)

Three targeted changes to `scripts/invoke.js`:

**1. Help-block guard bypass**

The `!params.task` guard that prints the full help text and exits 1 now skips when
`--validate-input` is present. Previously any invocation without `--task` hit the guard first,
making standalone pre-flight use (`--validate-input --signal CONVERT_VARIANT --refs types.ts`)
impossible.

**2. Targeted error for missing `--refs`**

When `--validate-input` is present without `--task` and without `--refs`, the script now emits
a specific diagnostic and exits 1 immediately after flag normalization:

```
ui-forge error: --validate-input requires --refs <interface-file> (and optionally --signal CONVERT_VARIANT)
```

**3. Auto-exit 0 after standalone validation**

When validation passes and `--task` is absent (standalone mode), the script exits 0 immediately
after printing the success line rather than continuing into context generation. When `--task` is
also present (combined pre-flight + generate mode), the script continues normally.

**4. `detectSignals()` task guard**

`detectSignals()` called `task.toLowerCase()` unconditionally. With no `--task` in
`--validate-input` standalone mode this would throw. Changed to `(task ?? '').toLowerCase()` —  
minimal, no functional change when task is present.

## Before / After

**Before** — with `--validate-input --signal CONVERT_VARIANT --refs types.ts`:
```
ui-forge — Next.js component generator for Claude Code

  --task     What to build ...
  --refs     Comma-separated ref files ...
  --validate-input  Pre-flight validate...
  ...
[exit 1]
```

**After**:
```
ui-forge: input validation passed — interface: HeroProps (types.ts)
[exit 0]
```

**Before** — with `--validate-input` only (no refs):
```
ui-forge — Next.js component generator for Claude Code
...
[exit 1, same full help dump]
```

**After**:
```
ui-forge error: --validate-input requires --refs <interface-file> (and optionally --signal CONVERT_VARIANT)
[exit 1]
```

## Files Changed

- `scripts/invoke.js` — help-block guard, `detectSignals()` null guard, early refs check,
  standalone exit-0 after successful validation
