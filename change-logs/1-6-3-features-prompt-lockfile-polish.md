# 1.6.3 — Features Prompt, Lockfile, and Scan Polish

Released **2026-05-22**.

Follow-up polish pass on top of the 1.6.2 UX overhaul. No new functionality;
all changes are quality and consistency fixes reported after the first
interactive run of the new prompt flow.

## Feature Prompt Redesign

### Required features are now locked — shown as a note, not a multiselect

Scan, Forge, Verify, and **MCP Server** are always installed. Previously they
appeared as checkboxes in the multiselect where users could accidentally deselect
them (and had them silently re-added). Now they are displayed in a `p.note` block
before the optional-feature selector, clearly communicating that they are
non-negotiable:

```
┌  Required (always included)
│  Scan         — project design scanner
│  Forge        — component generator
│  Verify       — contract + standards validation
│  MCP Server   — MCP tool exposure for agents
└─────────────────────────────────────────────
```

### Optional features use `groupMultiselect` with non-selectable group headers

The optional feature list is now rendered with `@clack/prompts`' native
`groupMultiselect`, which gives group headers that cannot be accidentally
selected. Two named groups:

| Group | Features |
|---|---|
| **Claude Exclusives** | Export Design, Fetch Handoff |
| **Automation** | Verify After Edit (Hook), Project CLI Shim |

### MCP Server promoted to Required

MCP Server was previously an optional feature (on by default). It is now
always installed alongside Scan, Forge, and Verify — removing the
confusion of having a nearly-always-on feature in the optional list.

### Theme options are now Title Case

All theme labels in the `Theme Preset` selector are now properly capitalised:
`Shadcn`, `Mantine`, `Plain Tailwind`, `StackShift`, `None`.

### StackShift pairing question moved before Agentic Platforms

"Is This Project Paired With StackShift?" now appears between the Quick Scan
note and the Agentic Platforms multiselect, so all product-level decisions are
grouped together before the infrastructure choices (platforms, scope).

---

## Quick Scan Behaviour Change

The Quick Scan prompt is no longer shown when a theme is selected:

| Scenario | Behaviour |
|---|---|
| Any theme selected (Shadcn, Mantine, etc.) | Scan runs automatically after install; user is shown a note |
| **Theme = None** | Prompt is shown *only* if a `tailwind.config.*` is detected in the project |
| `--quick-scan=on\|off` | CI override — bypasses the above logic |

If you pick a theme, you always want the scan to capture your design tokens,
so the extra confirmation was just friction. Skipping the prompt (theme = None,
no tailwind config) avoids a confusing scan that would find nothing useful.

---

## Lockfile Cleanup

The `.ui-forge/installed.json` file is now significantly leaner:

### Before (1.6.2)

```json
{
  "lockfileVersion": 2,
  "summary": { "skillVersion": "...", "installedAt": "...", "scope": "...", ... },
  "skillVersion": "1.6.2",
  "installedAt": "...",
  "scope": "project",
  "platforms": ["claude"],
  "paired": true,
  "theme": "stackshift",
  "themeLimited": false,
  "features": ["scan", ...],
  "mcpClients": [...],
  "hooks": { "postToolUseVerify": false, "stackshiftValidate": true },
  "projectCli": true,
  "forgeignoreSource": "references/default-forgeignore.txt",
  "writtenByFeature": { ... },
  "patched": [
    { "path": ".claude/settings.json", "keys": ["permissions.allow"] },
    { "path": ".claude/settings.json", "keys": ["hooks.PostToolUse"] }
  ],
  "pruned": []
}
```

### After (1.6.3)

```json
{
  "lockfileVersion": 2,
  "skillVersion": "1.6.3",
  "installedAt": "...",
  "scope": "project",
  "platforms": ["claude"],
  "paired": true,
  "theme": "stackshift",
  "features": ["scan", "forge", "verify", "mcp-server", "project-cli"],
  "mcpClients": ["claude-code", "codex", "cline"],
  "files": {
    "always":    [".claude/skills/ui-forge/SKILL.md", "..."],
    "scan":      [".claude/skills/ui-forge/scripts/scan.js"],
    "forge":     [".claude/skills/ui-forge/scripts/invoke.js", "..."],
    "verify":    [".claude/skills/ui-forge/scripts/verify.js", "..."],
    "mcp-server":[".claude/skills/ui-forge/scripts/mcp-server.js"],
    "commands":  [".claude/commands/forge.md", "..."],
    "project-cli":["ui-forge.mjs"],
    "forgeignore":[".forgeignore"],
    "standards": ["design/standards/sample-standard.md"]
  },
  "patched": [
    { "path": ".claude/settings.json", "keys": ["hooks.PostToolUse", "permissions.allow"] },
    { "path": "C:/Users/.../.claude.json", "keys": ["mcpServers.ui-forge"] }
  ],
  "_fileCount": 12
}
```

### Changes

| What | Why |
|---|---|
| `summary` block removed | Duplicated `skillVersion`, `installedAt`, `scope`, `platforms` verbatim from root |
| `hooks` removed | Derivable from `features.includes('post-tool-verify-hook')` + `paired` |
| `projectCli` removed | Derivable from `features.includes('project-cli')` |
| `themeLimited` removed | Derivable from `theme` + `paired` |
| `forgeignoreSource` removed | Internal path reference; not useful to readers |
| `writtenByFeature` → `files` | Shorter, clearer name |
| Duplicate `patched` entries merged | `.claude/settings.json` appeared twice; now one entry with both keys |
| `pruned: []` omitted when empty | Avoids empty-array noise |
| `_fileCount` added | Quick human reference at a glance |

Existing v2 lockfiles (1.6.2) are read and migrated transparently on the next
`init` or `repair` run. The new `isHookEnabled(lock)` and `isProjectCli(lock)`
helper functions in `lockfile.ts` let internal code derive these fields from
`features` without reading the removed booleans.

---

## `ui-forge.mjs` Help Banner

The `--help` header line is now Title Case:

```
Before:  ui-forge — local invocation shim
After:   UI Forge — Local Invocation Shim
```

---

## Files Changed

| File | Change |
|---|---|
| `cli/src/assets.ts` | `REQUIRED_FEATURES` extended to include `mcp-server` |
| `cli/src/lockfile.ts` | `Lockfile` interface cleaned; `files` replaces `writtenByFeature`; `saveLockfile` omits derived fields; `mergePatched` deduplicates same-path entries; `isHookEnabled`/`isProjectCli` helpers added |
| `cli/src/prompts.ts` | `groupMultiselect` for optional features (Claude Exclusives / Automation); required shown as `p.note`; theme labels Title Case; pairing question moved before Agentic Platforms; scan auto-triggers on theme selection |
| `cli/src/install.ts` | Uses `files` instead of `writtenByFeature` |
| `cli/src/ls.ts` | Reads `lock.files`; uses `isHookEnabled`/`isProjectCli` |
| `cli/src/repair.ts` | Uses `isHookEnabled`/`isProjectCli` helpers |
| `cli/src/wiring/project-cli.ts` | HELP banner title changed to Title Case |
| `skill.version`, `package.json`, `cli/package.json`, `README.md`, `SKILL.md` | Bumped to 1.6.3 |
