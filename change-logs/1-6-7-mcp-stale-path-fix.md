# 1.6.7 — MCP Stale Path Fix

## Highlights

Fixes a bug where MCP client configs (`~/.claude.json`, Cline's
`cline_mcp_settings.json`) could be written with a path inside a system
temp directory, producing a permanently broken MCP entry once the temp
dir was cleaned up. The installer now skips MCP wiring — and emits a
warning — when the resolved skill dir falls inside `os.tmpdir()`.

---

## Root cause

`writeMcp` in `cli/src/wiring/mcp.ts` constructs the MCP server path as
`join(skillDir, 'scripts', 'mcp-server.js')`, where `skillDir` is
`platformPaths(cwd, ...).skillDir` — a path relative to the working
directory from which `ui-forge init` was run.

When a prior operation (e.g. a platform-prune test run or an install
invoked from a temporary directory) set `cwd` to a path under the
system temp dir, `skillDir` resolved to something like:

```
C:\Users\...\AppData\Local\Temp\ui-forge-platform-prune-5Ki8wS\.claude\skills\ui-forge
```

That path was written verbatim into the global MCP configs for both
Claude Code and Cline. Once the temp directory was swept by the OS the
MCP server entry became unresolvable, causing a `✘ failed` status on
every startup.

---

## Fix

### Installer guard (`cli/src/install.ts`)

Before calling `writeMcp`, the installer now resolves both `skillDir`
and `os.tmpdir()` to their real paths and skips MCP wiring — with a
console warning — when `skillDir` is a child of the temp directory:

```ts
const resolvedSkillDir = resolve(paths.skillDir);
const resolvedTmp = resolve(tmpdir());
if (resolvedSkillDir.startsWith(resolvedTmp + '/') ||
    resolvedSkillDir.startsWith(resolvedTmp + '\\')) {
  console.warn('Warning: skill dir is inside temp directory — skipping MCP wiring ...');
} else {
  writeMcp({ ... });
}
```

This is a no-op for all normal installs (where `cwd` is a real project
directory) and silently prevents the class of stale-path corruption.

---

## Files changed

| File | Change |
|------|--------|
| `cli/src/install.ts` | Added temp-dir guard before `writeMcp`; added `tmpdir` + `resolve` imports |
| `cli/dist/install.js` | Rebuilt from source |
| `skill.version` / `package.json` / `cli/package.json` / `README.md` / `SKILL.md` | Bumped to 1.6.7 |
