# 0.2.3 — Windows Synthesis Fix and StackShift Install Improvements

## Bug Fixes

### Windows: AI synthesis hung or timed out on every scan

On Windows, `spawnSync` with `shell: true` passes arguments through `CMD.exe`. The old
synthesis call passed the full prompt as a `-p <prompt>` shell argument — CMD.exe mangled
special characters (`& % @ " { } ( )`) present in any CSS or JavaScript content embedded
in the prompt, causing Claude to receive a broken or empty input and hang until the 45s
timeout.

**Root cause:** `SYNTHESIS_PROMPT` embedded the full `tailwind.themeSection` and
`globalCss` content inline (~5,500 chars of raw CSS/JS), making the shell argument
impossible to pass safely on Windows.

**Fixes applied:**

1. **Version check: add `shell: true`** — without it, Node cannot resolve `claude.cmd`
   on Windows (npm installs the CLI as `claude.cmd`, not a bare executable).

2. **Synthesis call: stdin instead of `-p <prompt>` arg** — prompt is now passed via the
   `input` option (stdin). `-p` without an inline value reads from stdin per `claude --help`:
   "useful for pipes". `shell: true` is retained to resolve `claude.cmd`.
   Timeout raised from 45s to 120s to accommodate file-reading during synthesis.

3. **`SYNTHESIS_PROMPT` redesigned: file paths instead of file content** — the prompt now
   lists file paths for Claude to read with its Read tool (tailwind config, global CSS, and
   up to 12 component `.tsx`/`.jsx` files), rather than embedding raw file content inline.
   This eliminates the special-character mangling problem entirely and produces *better*
   synthesis results: Claude reads actual usage patterns from component files rather than
   only config definitions. Prompt size reduced ~69% (5,484 → ~1,675 chars in testing).

4. **`readGlobalCss` return shape: `{ content, path }`** — returns both the file content
   (for `arch.globalCss`) and the relative path (for the synthesis prompt payload) from
   a single read, without re-reading the file.

5. **`readTailwindConfig` return shape: add `path` field** — same reason; path is needed
   in the synthesis prompt payload.

6. **`arch.globalCss` field updated** — reads `globalCss?.content` to match the new return
   shape.

### Verified results (Windows 11, Claude Code)

- Prompt size: 5,484 chars → ~1,675 chars (69% reduction)
- `patterns.*` fully AI-synthesized from actual component files
- Specific values detected: `py-20`/`py-24`, `px-8`/`sm:px-5`, `tracking-[0.18em]`,
  `leading-[0.95]`, 1240–1280px containers — not possible from CSS config alone

## Improvements

### StackShift: `.forgeignore` auto-created on install

When `node cli.js install` runs in a StackShift project (detected via
`.stackshift/installed.json`), the `.forgeignore` file is now created automatically from
the bundled StackShift template (`references/default-stackshift-forgeignore.txt`) if one
does not already exist. This immediately excludes StackShift-specific directories (studio,
schemas, e-commerce sections, theme settings, etc.) from scans without any manual
configuration.

### SKILL.md: synthesis model documented

Added a note to the Prerequisites section explicitly stating that `scan.js` uses
`claude-haiku-4-5-20251001` for synthesis when the `claude` CLI is available, and falls
back to static analysis automatically when it is not.
