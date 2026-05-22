# 1.6.9 — `@clack/prompts` Dependency Fix

## Highlights

Fixes `ERR_MODULE_NOT_FOUND` thrown at `ui-forge init` startup when the
package is installed via `npx` or a clean `npm install`:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@clack/prompts'
imported from .../@extragraj/ui-forge/cli/dist/prompts.js
```

---

## Root cause

`@clack/prompts` was only declared in `cli/package.json`, which is
marked `"private": true` and is **not published** — only `cli/dist`
ships via the `files` array in the root manifest. The root
`@extragraj/ui-forge` package therefore had no runtime dependencies at
all, so `npm`/`npx` never installed `@clack/prompts` for end users, and
the first `import` from `cli/dist/prompts.js` (and `uninstall.js`) blew
up.

This shipped unnoticed in 1.6.0–1.6.8 because local installs from the
monorepo workspace had `@clack/prompts` available transitively.

---

## Fix

Added `@clack/prompts` to the runtime `dependencies` of the root
`package.json` so it is resolved alongside `@extragraj/ui-forge` on
install:

```json
"dependencies": {
  "@clack/prompts": "^0.7.0"
}
```

No source changes; no API changes; no behavior change beyond `init`
actually starting.

---

## Files changed

| File | Change |
|------|--------|
| `package.json` | Added `dependencies."@clack/prompts": "^0.7.0"` |
| `skill.version` / `package.json` / `cli/package.json` / `README.md` / `SKILL.md` | Bumped to 1.6.9 |
