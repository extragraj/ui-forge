# 1.7.1 — Install Sweep + Cross-Platform Slash Commands

## Highlights

Three bug fixes affecting every installed instance:

- Source-bundle files (`commands/`, `LICENSE`, `package.json`, lockfiles, `README.md`, `skill.version`) no longer leak into the installed skill directory, and prior leftovers are swept on re-install.
- Slash commands are now portable across Claude Code, Cline, Cursor, Codex, Copilot, and Gemini Antigravity. The old templates relied on Claude Code's eager `!`-prefix shell substitution, which is a Claude-only extension.
- `/forge-scan` no longer crashes when Phase 2 (AI synthesis) runs — the literal `<your-json-here>` placeholder is no longer fed to `apply-synthesis.js`.

---

## Bug 1 — Source-bundle files leak into installed skill directory

### Symptom

After install (or upgrade from an older version), the skill directory contained source-bundle metadata that has no business being there:

```
<scope>/skills/ui-forge/
├── commands/        ← belongs in <scope>/commands/, not the skill dir
├── LICENSE          ← source-bundle metadata
├── package.json     ← source-bundle metadata
├── README.md        ← source-bundle docs
└── …
```

### Root cause

Two gaps in the install + sweep machinery:

1. `NEVER_COPY` in `cli/src/assets.ts` had no entries for `commands/`, `LICENSE`, `package.json`, `package-lock.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `README.md`, or `skill.version`. The asset manifest already excluded them by listing only specific runtime files, but the defense-in-depth `NEVER_COPY` filter did not.
2. `LEGACY_PATTERNS` in `cli/src/legacy-sweep.ts` had the same gap, so any pre-existing copies of these files (from earlier installers, manual extraction, or hand-edits) were never reported as legacy and never removed on re-install.

### Fix

Added the missing patterns to both `NEVER_COPY` and `LEGACY_PATTERNS`. On the next install or repair, stale `commands/`, `LICENSE`, `package.json`, lockfiles, `README.md`, and `skill.version` inside any skill directory are reported by the legacy sweep and removed.

---

## Bug 2 — `skill.version` not handled by sweep

### Symptom

If `skill.version` was present in an installed skill dir (left over from a pre-1.6.4 hand-extracted tarball, or accidentally copied), no later install would remove it. The comment in `assets.ts` already declared the intent — "skill.version is NOT copied (1.6.4) — it's source-bundle metadata, not runtime data" — but nothing enforced that intent in `NEVER_COPY` or `LEGACY_PATTERNS`.

### Fix

Folded into Bug 1's diff. `^skill\.version$` is now in both lists with the reason `legacy-pattern: skill.version (source-bundle metadata; lockfile tracks installed version)`.

---

## Bug 3 — Slash commands fail on Cline / Cursor / Codex / Copilot / Gemini, and `/forge-scan` fails on Claude

### Symptom

On Claude Code:

```
/forge-scan
  → apply-synthesis: JSON parse error — Unexpected token '<', "" is not valid JSON
  → "the apply-synthesis.js script received a placeholder <your-json-here>
     instead of real JSON"

/forge-handoff
  → Usage: fetch-handoff.js     (script bailed because no URL was passed)

/forge-verify
  → Usage: verify.js   [--playwright …]
```

On Cline, Cursor, Codex, Copilot, and Gemini Antigravity:

The slash commands produced no script invocation at all. The `!`-prefix shell lines in the templates were rendered as inert markdown text, so the AI never ran `scan.js`, `invoke.js`, `verify.js`, `fetch-handoff.js`, or `export-design.js` unless it independently decided to.

### Root cause

The old templates (e.g. `commands/forge-scan.md`) used Claude Code's `!`-prefix eager shell substitution:

```md
!`node "$CLAUDE_PLUGIN_ROOT/scripts/scan.js" $ARGUMENTS`
```

That syntax is a Claude Code extension, not part of the slash-command markdown contract supported by other agentic hosts. It also has eager-at-load-time semantics on Claude — every `!` line runs unconditionally before the AI gets a turn. `forge-scan.md` exploited this for Phase 1, then included a second `!` line for Phase 2:

```md
!`node ".../apply-synthesis.js" '<your-json-here>'`
```

Phase 2 was supposed to be performed by the session AI after synthesizing JSON, but the eager-exec contract meant the literal placeholder `<your-json-here>` was passed straight to the shell every time the command loaded — causing the JSON parse error.

### Fix

Rewrote every `commands/*.md` template to be platform-agnostic AI instructions. No `!`-prefix lines anywhere. Every script invocation is now a fenced code block the host AI runs through its own bash / terminal tool:

```md
Run via your bash / terminal tool:

\`\`\`
node "$CLAUDE_PLUGIN_ROOT/scripts/scan.js" $ARGUMENTS
\`\`\`
```

`wiring/commands.ts` substitutes `$CLAUDE_PLUGIN_ROOT` with the absolute skill directory at install time, so the rendered command contains a real path that runs on any shell on any platform.

For commands with required arguments (`/forge-handoff`, `/forge-verify`, `/forge`), the AI is now instructed to ask the user for missing inputs before running — eliminating the empty-`$ARGUMENTS` usage-error surface.

For `/forge-scan`, Phase 2 is now a conversational instruction: the AI reads `design/.synthesis-request.json`, produces the JSON, and only then invokes `apply-synthesis.js` with the real JSON substituted in — never with the placeholder.

---

## Verification

`tests/run-cli-tests.mjs` extended with:

- New assertions in the legacy-sweep group covering `commands/`, `LICENSE`, `package.json`, `package-lock.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `README.md`, and `skill.version` removal.
- New group `1.7.1 — slash commands are platform-agnostic` that asserts every installed slash command:
  - Has no eager `` !` `` shell substitution.
  - Contains a fenced ``` ```\nnode … ``` ``` block.
  - Has its `$CLAUDE_PLUGIN_ROOT` token fully substituted at install time.
- A specific assertion that `forge-scan.md` does not eagerly invoke `apply-synthesis.js` with the placeholder.

All 123 tests pass (113 prior + 10 new).

End-to-end smoke test against a sandboxed install confirms:

- `init` produces a clean skill dir (no `commands/`, `LICENSE`, `package.json`, lockfiles, `README.md`).
- A re-install over a dirty skill dir pre-seeded with 8 stale files sweeps all of them and leaves the skill dir clean.
- The rendered slash command files contain resolved absolute paths and no `$CLAUDE_PLUGIN_ROOT` literals.

---

## Files changed

| File | Change |
|------|--------|
| `cli/src/assets.ts` | Added `commands/`, `LICENSE`, `package.json`, `package-lock.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `README.md`, `skill.version` to `NEVER_COPY` |
| `cli/src/legacy-sweep.ts` | Added the same patterns to `LEGACY_PATTERNS` with reason strings |
| `commands/forge-scan.md` | Rewritten as platform-agnostic AI instructions; Phase 2 no longer eager-executes |
| `commands/forge.md` | Rewritten as platform-agnostic AI instructions; prompts for missing flags |
| `commands/forge-handoff.md` | Rewritten as platform-agnostic AI instructions; prompts for missing URL |
| `commands/forge-verify.md` | Rewritten as platform-agnostic AI instructions; prompts for missing path |
| `commands/forge-export-design.md` | Rewritten as platform-agnostic AI instructions |
| `tests/run-cli-tests.mjs` | Added legacy-sweep assertions for new patterns + new platform-agnostic slash-command group |
| `skill.version` / `package.json` / `cli/package.json` / `README.md` / `SKILL.md` | Bumped to 1.7.1 |
