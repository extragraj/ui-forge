# 1.6.2 — UX Overhaul and Polish

Released **2026-05-22**.

Phase B (UX overhaul) and Phase C (polish) from the 1.6.x fix plan, building on
the critical plumbing fixes shipped in 1.6.1. Re-running `npx ui-forge init`
picks up every change; existing 1.6.1 lockfiles are auto-migrated to v2.

## Phase B — UX Overhaul

### 1. New prompt order

The interactive prompt sequence is now:

1. Existing-install note
2. Pairing detection note
3. **Features To Install** (multiselect — covers MCP, hook, and CLI shim)
4. **Theme Preset** (includes "No Theme")
5. **Quick Scan** offer
6. **Agentic Platforms** (renamed from "Target platforms")
7. **Install Scope** (Project | Global)

Meaningful product choices come first; infrastructure choices (scope, platforms)
come last.

### 2. "Target Platforms" → "Agentic Platforms"

The platforms prompt is now labelled **Agentic Platforms** to better reflect the
audience (Claude Code, Cursor, Codex, Cline, Gemini Antigravity, GitHub Copilot
— all agent runtimes).

### 3. Title Case everywhere

All prompt `message` fields now use Title Case. `hint` text stays sentence case
for visual contrast. Option labels use Title Case for the name, sentence case for
the description.

### 4. Grouped feature multiselect, MCP on by default

Features are now shown in two visual groups:

```
── Required ──
  Scan               (required)
  Forge              (required)
── Claude Exclusives ──
  Verify             contract + standards validation
  Export Design      bundle for Claude Design
  Fetch Handoff      pull refs from a handoff URL
  MCP Server         expose forge as MCP tools
  Verify After Edit  auto-run verify.js after edits
  Project CLI Shim   ./ui-forge.mjs convenience wrapper
```

Group headers are rendered as separators and filtered out after selection.
**MCP Server** and **Project CLI Shim** are now on by default.

### 5. MCP Server and Project CLI Shim are now Features

Three `confirm` sub-prompts have been removed:
- `Wire UI Forge MCP server into detected clients?`
- `Install PostToolUse hook to auto-run verify.js after edits?`
- `Create ./ui-forge.mjs at project root for easy local invocation?`

These are now **feature toggles** in the main multiselect (`mcp-server`,
`post-tool-verify-hook`, `project-cli`). The `--features` flag accepts them:

```
ui-forge init --features=scan,forge,verify,mcp-server,post-tool-verify-hook,project-cli
```

The legacy `--hooks=on`, `--project-cli=on`, and `--mcp=on` flags still work as
back-compat shortcuts.

### 6. "Which MCP clients?" sub-prompt removed

When `mcp-server` is selected, **all** detected MCP clients are wired
automatically. A confirmation note is shown instead of asking the user to
re-pick. The `--mcp-clients` flag is still available for CI granularity.

### 7. "No Theme" option

Theme Preset now includes a **None** option for projects that supply their own
design tokens. When selected, no theme JSON is copied to the skill dir and no
theme standards are seeded into `design/standards/` (only the sample template is
created).

### 8. Quick Scan prompt after install

After all files are written, the installer asks:

```
Run a quick scan after install? (local-only, no AI synthesis)
```

Default is **Yes** when a theme is selected, **No** for "No Theme". The scan
runs `scan.js --quick` (static pattern fallback, no AI call). Pass
`--quick-scan=on|off` to control from CI without a prompt.

### 9. `ui-forge.mjs` is now a proper CLI

The project-root shim now has a full help page, version flag, and consistent
exit codes:

```
node ui-forge.mjs --help
node ui-forge.mjs --version   → ui-forge 1.6.2 / skill root: ...
node ui-forge.mjs unknown     → exit 2 (usage error)
```

Exit codes: `0` success, `1` runtime error, `2` usage error.

### 10. `--scope=both` removed

The `both` scope value is no longer valid. Any CI scripts passing `--scope=both`
should switch to `--scope=project`. The CLI now exits with a clear error:

```
Unknown scope 'both' — use 'project' or 'global'.
```

Existing lockfiles with `scope: "both"` are auto-migrated to `scope: "project"`
on first load.

---

## Phase C — Polish

### 11. Lockfile restructured (schema v2)

`.ui-forge/installed.json` is now version 2. The flat `written[]` array is
replaced by a feature-grouped `writtenByFeature` object and a human-readable
`summary` block:

```json
{
  "lockfileVersion": 2,
  "summary": {
    "skillVersion": "1.6.2",
    "installedAt": "2026-05-22T…",
    "scope": "project",
    "platforms": ["claude"],
    "theme": "stackshift (paired)",
    "features": ["Scan", "Forge", "Verify", "MCP Server", "Project CLI Shim"],
    "fileCount": 12
  },
  "writtenByFeature": {
    "always":      ["…/SKILL.md", "…/detect.js", "…"],
    "scan":        ["…/scan.js"],
    "forge":       ["…/invoke.js", "…/apply-synthesis.js"],
    "verify":      ["…/verify.js", "…"],
    "mcp-server":  ["…/mcp-server.js"],
    "theme":       ["…/themes/stackshift.json"],
    "commands":    [".claude/commands/forge.md", "…"],
    "project-cli": ["ui-forge.mjs"],
    "forgeignore": [".forgeignore"]
  },
  …
}
```

v1 lockfiles (no `lockfileVersion`) are automatically migrated in memory; the
file is rewritten to v2 format on the next `init` or `repair`. No data is lost.

### 12. Theme standards bridged into `design/standards/`

At install time, the installer now seeds `design/standards/` from the skill's
`references/standards/` source:

- **Always**: `sample-standard.md` (starter template)
- **stackshift theme**: all files in `references/standards/stackshift-ui/`
  are copied to `design/standards/stackshift-ui/`

Files that carry a provenance header are safe to overwrite on re-install. Files
without the header are user-owned and never touched. `scan.js` already
auto-discovers `design/standards/*.md` into `designStandards`, so these are
immediately available to the AI without any manual step.

### 13. `references/standards/` no longer copied into the skill dir

Standards live exclusively in `design/standards/` (seeded by the installer).
The `references/standards/` directory is the **source template**, not a runtime
asset. The legacy sweep now removes `references/standards/` from existing skill
dirs on re-install.

---

## New flags

| Flag | Purpose |
|---|---|
| `--quick-scan=on\|off` | Run scan after install (`auto` = prompt interactively; `off` = skip; `on` = always). |

## Lockfile migration

v1 lockfiles are migrated automatically on first load. After the next `init` or
`repair`, the file is rewritten to v2. No manual action needed.

## Files changed

| File | Change |
|---|---|
| `cli/src/assets.ts` | Add `FeatureId` values `post-tool-verify-hook`, `project-cli`; add `ThemeId` value `none`; add `FEATURE_DISPLAY`, `STANDARDS_BY_THEME`; remove `references/standards/` from `always`. |
| `cli/src/flags.ts` | Remove `Scope='both'`; add `--quick-scan` flag; add `none` to theme validation. |
| `cli/src/prompts.ts` | Full rewrite: new prompt order, grouped features, Title Case, "No Theme", Quick Scan prompt, auto-wire MCP clients. |
| `cli/src/install.ts` | Derive hooks/projectCli/mcpEnabled from features; call `bootstrapDesignStandards`; build `writtenByFeature`; display feature names; run quick scan. |
| `cli/src/lockfile.ts` | Schema v2: `writtenByFeature`, `summary`, `lockfileVersion`; auto-migrate v1 on load. |
| `cli/src/ls.ts` | Show grouped `writtenByFeature` in `ui-forge ls` output. |
| `cli/src/repair.ts` | Pass `quickScan: 'off'` on repair; keep back-compat flag derivation. |
| `cli/src/wiring/commands.ts` | `expandScope` type: remove `'both'`. |
| `cli/src/wiring/hooks.ts` | `HooksArgs.scope`: remove `'both'`. |
| `cli/src/wiring/permissions.ts` | `PermissionsArgs.scope`: remove `'both'`. |
| `cli/src/wiring/project-cli.ts` | Full template rewrite: help page, `--version` flag, exit codes. |
| `cli/src/wiring/design-bootstrap.ts` | **New**: `bootstrapDesignStandards()` — seeds `design/standards/` from theme source. |
| `cli/src/legacy-sweep.ts` | Add `references/standards/` to LEGACY_PATTERNS; guard `byTheme['none']` access. |
| `skill.version`, `package.json`, `cli/package.json`, `README.md`, `SKILL.md` | Bump to 1.6.2. |
