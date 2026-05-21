---
description: Scan the project and create design/design-arch.json
argument-hint: [--theme shadcn|mantine|plain-tailwind|stackshift] [--schema-v4] [--quick] [--patch] [--theme-override]
---

Run the UI Forge project scanner. This is a two-phase process.

## Phase 1 — Static scan

Run the scanner now:

!`node "$CLAUDE_PLUGIN_ROOT/scripts/scan.js" $ARGUMENTS`

## Phase 2 — Session AI synthesis

Skip this phase if `--quick` was passed as an argument.

Otherwise, check whether `design/.synthesis-request.json` exists in the project root.

If it exists:

1. Read `design/.synthesis-request.json` — it contains a `prompt` field with synthesis instructions and a list of files to read.

2. Follow the prompt: use your file-read capability to read each file listed under `componentFiles`, `tailwindPath`, and `globalCssPath` in the request.

3. Synthesize and produce **only** this JSON shape (no markdown, no explanation):
   ```
   {"spacing":"<1-2 sentences>","typography":"<1-2 sentences>","colorTokens":"<comma-separated tokens>","conventions":["<convention 1>","<convention 2>"],"isStackShift":<true|false>}
   ```

4. Pass the result to apply-synthesis:
   !`node "$CLAUDE_PLUGIN_ROOT/scripts/apply-synthesis.js" '<your-json-here>'`

   Replace `<your-json-here>` with the exact JSON you synthesized (no line breaks inside the single-quoted string).

Phase 2 is AI-agnostic — this synthesis step is performed by whichever AI is active in the current session (Claude, GPT-4o, Gemini, Codex, etc.). No subprocess, no API key, no external calls.

When complete, `design/design-arch.json` will contain synthesized `patterns.spacing`, `patterns.typography`, `patterns.conventions`, and `tailwind.colorTokens`.
