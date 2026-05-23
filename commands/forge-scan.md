---
description: Scan the project and create design/design-arch.json
argument-hint: [--theme shadcn|mantine|plain-tailwind|stackshift] [--schema-v4] [--quick] [--patch] [--theme-override]
---

Run the UI Forge project scanner. Two-phase process.

## Phase 1 — Static scan

Run this command via your bash / terminal tool, passing any flags from
$ARGUMENTS through verbatim:

```
node "$CLAUDE_PLUGIN_ROOT/scripts/scan.js" $ARGUMENTS
```

## Phase 2 — Session AI synthesis

Skip this phase if `--quick` was passed in $ARGUMENTS.

Otherwise:

1. Check whether `design/.synthesis-request.json` exists at the project
   root. If it does not exist, stop — Phase 1 did not request
   synthesis.

2. Read `design/.synthesis-request.json`. Follow its `prompt` field and
   read every file listed under `componentFiles`, `tailwindPath`, and
   `globalCssPath`.

3. Produce ONLY this JSON shape (no markdown, no commentary, no line
   breaks inside the value):

   ```
   {"spacing":"<1-2 sentences>","typography":"<1-2 sentences>","colorTokens":"<comma-separated tokens>","conventions":["<convention 1>","<convention 2>"],"isStackShift":<true|false>}
   ```

4. Invoke apply-synthesis via your bash / terminal tool, passing the
   actual JSON from step 3 as a single-quoted positional argument.
   Substitute the placeholder with real JSON before running — do not
   send the literal text `<your-json-here>`:

   ```
   node "$CLAUDE_PLUGIN_ROOT/scripts/apply-synthesis.js" '<your-json-here>'
   ```

Phase 2 is host-agnostic — this synthesis step runs in whichever AI is
active (Claude, Cline, Cursor, Codex, Gemini, etc.). No subprocess, no
API key, no external calls.

When complete, `design/design-arch.json` will contain synthesized
`patterns.spacing`, `patterns.typography`, `patterns.conventions`, and
`tailwind.colorTokens`.
