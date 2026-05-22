# 1.7.0 — Windows Hook Fix and Standards Crash Fix

## Highlights

Two runtime bug fixes that affected every installed instance.

---

## Bug 1 — `invoke.js` crashes with ENOENT on every forge invocation

### Symptom

```
Error: ENOENT: no such file or directory, scandir
'<skill-dir>/references/standards'
    at readdirSync (node:fs:...)
    at loadDesignStandards (invoke.js:...)
```

### Root cause

`loadDesignStandards` Step 3 (built-in fallback) called `readdirSync(BUILTIN_STANDARDS_DIR)`
unconditionally, where `BUILTIN_STANDARDS_DIR` resolves to `references/standards/` inside the
installed skill dir. That directory is intentionally absent from installed instances: the
`NEVER_COPY` rule in `assets.ts` blocks it, and `bootstrapDesignStandards` seeds the content
into the project's `design/standards/` at install time (where Step 2 already loads it). Step 3
was only ever useful for dev-tree runs from the source checkout.

### Fix

Added `existsSync(BUILTIN_STANDARDS_DIR)` guard around the `readdirSync` call in Step 3.
Dev-tree runs (source checkout, where `references/standards/` exists) still use the fallback.
Installed instances skip Step 3 silently — their standards are already in `design/standards/`.

---

## Bug 2 — PostToolUse hook fires "blocking error" on every edit (Windows)

### Symptom

```
PostToolUse:Edit hook returned blocking error
[node "...verify.js" "$CLAUDE_TOOL_INPUT_file_path"]:
Usage: verify.js <output-file> <contract-file> [--playwright <url>]
```

Appeared on every file edit, even unrelated files.

### Root cause

On Windows, Claude Code runs hook commands through PowerShell. PowerShell expands
`"$CLAUDE_TOOL_INPUT_file_path"` in double-quoted strings as a PS variable (which is
`$null`/empty — PowerShell env vars use `$env:VAR`, not `$VAR`). So `verify.js` received
an empty string as `argv[2]`, hit the `!outputArg` usage guard, wrote the usage text to
stderr, and exited with code 2 — which Claude Code surfaces as a blocking PostToolUse error.

The hook was designed to fast-exit on non-forge files, but that logic was never reached
because the empty-arg guard fired first.

### Fix

`verify.js` now falls back to `process.env['CLAUDE_TOOL_INPUT_file_path']` when `argv[2]`
is falsy. Claude Code sets this env var in the hook environment regardless of shell, so the
correct file path is always available even when PowerShell expands the command-line reference
to empty.

---

## Documentation updates

- **"Built-in Design Standards" section** (README.md): reworded to accurately describe the
  install-time seeding model. Previously implied `references/standards/` was a runtime lookup
  directory; it is actually the source in the installer package that gets copied to the
  project's `design/standards/` at install time.
- **Stale link removed**: `references/standards/README.md` link removed (file not present in
  installed skill dirs).
- **Hook table entry** (README.md): updated to mention fast-exit behavior for non-forge files.

---

## Files changed

| File | Change |
|------|--------|
| `scripts/invoke.js` | Guard `loadDesignStandards` Step 3 with `existsSync(BUILTIN_STANDARDS_DIR)` |
| `scripts/verify.js` | Fallback `outputArg` to `process.env['CLAUDE_TOOL_INPUT_file_path']` when argv[2] is empty |
| `README.md` | Fix "Built-in Design Standards" section, remove stale link, update hook table entry |
| `skill.version` / `package.json` / `cli/package.json` / `README.md` / `SKILL.md` | Bumped to 1.7.0 |
