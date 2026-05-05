# 0.2.7C — UTF-8 Stdout Encoding Fix

**Date:** 2026-05-05
**Type:** Bug fix
**Scope:** `scripts/invoke.js`

## Summary

Fixes: On Windows, when forge output is redirected to a file via `>` or `Out-File`, PowerShell writes UTF-16 LE by default, producing garbled text when the file is read as UTF-8 (every character separated by a space).

## What changed

**`scripts/invoke.js`** — Added a UTF-8 stdout encoding guard at startup:

```js
if (process.platform === 'win32' && !process.stdout.isTTY) {
  process.stdout.setDefaultEncoding('utf8')
}
```

This forces `process.stdout.write()` to use UTF-8 encoding even when the shell's default encoding is UTF-16 LE. The guard only activates on Windows (`process.platform === 'win32'`) and only when stdout is piped/redirected (`!process.stdout.isTTY`), so it has no effect on interactive terminal sessions or non-Windows platforms.

## User impact

- `node "$SKILL_ROOT/scripts/cli.js" forge ... > output.md` now produces a clean UTF-8 file on Windows CMD and PowerShell.
- No more garbled "every character spaced out" output in redirected forge context files.
- Output files can be safely used as `--refs` inputs for subsequent forge runs.

## Related
- **Root cause:** PowerShell's `>` redirection writes UTF-16 LE by default; `invoke.js` did not set stdout encoding explicitly.