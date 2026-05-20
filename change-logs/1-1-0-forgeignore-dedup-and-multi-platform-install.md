# 1.1.0 — `.forgeignore` heading deduplication and multi-platform install

**Date:** 2026-05-20

Two bug fixes reported via issues.txt.

---

## Fix 1: `.forgeignore` heading deduplication on StackShift rescan (`scan.js`)

### Problem

Running `scan --theme stackshift` more than once on a project that already had a
`.forgeignore` with StackShift exclusions caused section headings to be appended
again on every rescan:

```
#StackShift Workflow Skill   ← already present
# Tests                      ← already present
# Studio                     ← already present
...
#StackShift Workflow Skill   ← duplicated after second scan
# Tests                      ← duplicated
# Studio                     ← duplicated
...
```

### Root cause

`mergeForgeignoreLines` built the deduplication set by filtering out all lines
that start with `#`, so comment/heading lines were always carried through to the
merged output unconditionally:

```js
// before — headings skipped from the dedup set, always re-added
const existingLines = new Set(
  existingContent.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
)
for (const line of stackshiftLines) {
  if (!trimmed || trimmed.startsWith('#')) newLines.push(line)  // always added
  else if (!existingLines.has(trimmed)) newLines.push(line)
}
```

### Fix

Include ALL non-blank lines (headings, comments, and patterns) in the dedup set.
A line from the StackShift template is only appended if it is not already present
anywhere in the existing file:

```js
// after — headings included in the dedup set
const existingLines = new Set(
  existingContent.split('\n').map(l => l.trim()).filter(Boolean)
)
for (const line of stackshiftLines) {
  if (!trimmed || !existingLines.has(trimmed)) newLines.push(line)
}
```

Also updated the caller in `handleStackshiftForgeignore` to:
- Trim the merged result before appending so no trailing blank lines appear.
- Skip the file write entirely when merged is empty, printing
  `already up-to-date, no new StackShift exclusions.` instead. This makes
  repeated rescans fully idempotent with no disk writes.

---

## Fix 2: `install` wires slash commands and permissions to all detected platforms (`cli.js`)

### Problem

`install()` resolved a **single** agentic platform (the one the skill was
installed into) and wrote slash commands and the Bash permission only to that
platform's directories. If the project had both `.claude/` and `.agents/` (or
any other combination), only the detected platform received the commands and
settings — the others were silently skipped.

Additionally, for **global installs** (skill at `~/.claude/skills/ui-forge` or
similar), the generated command bodies and permission string used a relative path
(`.claude/skills/ui-forge/scripts/...`) that does not resolve from the project
root, making the commands non-functional.

### Fix — multi-platform loop

`install()` now collects a `Set` of target platform directories:

1. The **primary** platform (detected or fallback `.claude`).
2. Every other known agentic platform directory that **already exists** in the
   current working directory (`.claude`, `.agents`, `.cursor`, `.codex`, etc.).

Commands and `settings.json` are written to each collected directory. The slash
command content is identical across all platforms (it always points to the one
place the skill is installed), so agents can call the skill regardless of which
platform they operate under.

### Fix — global install path

`resolvePlatform` now checks whether `SKILL_ROOT` is inside the project
directory (`cwd`). For **local installs** the existing relative path is used
(e.g., `.agents/skills/ui-forge/scripts/...`). For **global installs** the
absolute `SKILL_ROOT` path is used, so the generated `node` invocation is
always resolvable:

```
# local install (.agents/skills/ui-forge)
Bash(node .agents/skills/ui-forge/scripts/*)

# global install (~/.agents/skills/ui-forge)
Bash(node /home/user/.agents/skills/ui-forge/scripts/*)
```

---

## Files Changed

| File | Change |
|------|--------|
| `scripts/scan.js` | `mergeForgeignoreLines`: include `#` lines in dedup set; caller trims merged output, skips write when nothing new |
| `scripts/cli.js` | `resolvePlatform`: detect local vs global install, use absolute path for global; `install`: loop over all detected platform dirs |
| `tests/test-1-1-0-fixes.mjs` | 33 tests across 4 groups covering both fixes (dedup idempotency, multi-platform commands, single-platform no-create, command body consistency) |
