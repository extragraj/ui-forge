#!/bin/sh
# UI Forge — cross-agent skill root detection
# Outputs the absolute path to the ui-forge skill root on stdout.
# Exit 0 on success. Exit 1 with error on stderr if not found.
#
# Usage:
#   SKILL_ROOT=$(sh "$SKILL_ROOT/scripts/detect.sh")
#   SKILL_ROOT=$(sh .claude/skills/ui-forge/scripts/detect.sh)

# Priority 1 — Env vars set by agentic platforms. Use immediately if valid.
for _ENV_VAR in "$CLAUDE_SKILL_DIR" "$CLAUDE_PLUGIN_ROOT" "$SKILL_ROOT"; do
  if [ -n "$_ENV_VAR" ] && [ -f "$_ENV_VAR/SKILL.md" ]; then
    echo "$_ENV_VAR"
    exit 0
  fi
done

# Priority 2 — Return the skill root of this script (not a searched path)
_SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
_SKILL_ROOT="$(dirname "$_SCRIPT_DIR")"

if [ -f "$_SKILL_ROOT/SKILL.md" ]; then
  echo "$_SKILL_ROOT"
  exit 0
fi

# Priority 3 — Search local project paths (relative to cwd)
for _d in .claude .agents .github .cursor .codex .copilot .agentic; do
  if [ -f "$_d/skills/ui-forge/SKILL.md" ]; then
    echo "$(cd "$_d/skills/ui-forge" && pwd)"
    exit 0
  fi
done

# .gemini has a different subpath
if [ -f ".gemini/antigravity/skills/ui-forge/SKILL.md" ]; then
  echo "$(cd ".gemini/antigravity/skills/ui-forge" && pwd)"
  exit 0
fi

# Priority 4 — Search global install paths
_H="$HOME"
for _g in \
  "$_H/.claude/skills/ui-forge" \
  "$_H/.agents/skills/ui-forge" \
  "$_H/.copilot/skills/ui-forge" \
  "$_H/.cursor/skills/ui-forge" \
  "$_H/.codex/skills/ui-forge" \
  "$_H/.agentic/skills/ui-forge" \
  "$_H/.gemini/antigravity/skills/ui-forge" \
  "/etc/codex/skills/ui-forge"
do
  if [ -f "$_g/SKILL.md" ]; then
    echo "$_g"
    exit 0
  fi
done

# Priority 5 — Not found. Emit actionable error.
echo "ui-forge: skill directory not found." >&2
echo "" >&2
echo "Install with:" >&2
echo "  Claude Code:   npx skills add extragraj/ui-forge -y -g -a claude-code" >&2
echo "  Codex CLI:     npx skills add extragraj/ui-forge -y -g -a codex" >&2
echo "  All agents:    npx skills add extragraj/ui-forge -y -g" >&2
echo "" >&2
echo "Or set manually:  export CLAUDE_SKILL_DIR=/path/to/ui-forge" >&2
exit 1
