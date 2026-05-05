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

# Priority 2 — Walk known project-local install locations (all supported platforms):
#   Claude Code → Codex/universal (.agents) → GitHub Copilot → Cursor → Codex → Copilot → Gemini → fallbacks
# Then global user installs.
for CANDIDATE in \
  "./.claude/skills/ui-forge" \
  "./.agents/skills/ui-forge" \
  "./.github/skills/ui-forge" \
  "./.cursor/skills/ui-forge" \
  "./.codex/skills/ui-forge" \
  "./.copilot/skills/ui-forge" \
  "./.agentic/skills/ui-forge" \
  "./.gemini/antigravity/skills/ui-forge" \
  "$HOME/.claude/skills/ui-forge" \
  "$HOME/.agents/skills/ui-forge" \
  "$HOME/.copilot/skills/ui-forge" \
  "$HOME/.cursor/skills/ui-forge" \
  "$HOME/.codex/skills/ui-forge" \
  "$HOME/.agentic/skills/ui-forge" \
  "$HOME/.gemini/antigravity/skills/ui-forge" \
  "/etc/codex/skills/ui-forge"; do
  if [ -f "$CANDIDATE/SKILL.md" ]; then
    cd "$CANDIDATE" && echo "$(pwd)" && exit 0
  fi
done

# Priority 3 — Not found. Emit actionable error.
echo "ui-forge: skill directory not found." >&2
echo "" >&2
echo "Install with:" >&2
echo "  Claude Code:   npx skills add extragraj/ui-forge -y -g -a claude-code" >&2
echo "  Codex CLI:     npx skills add extragraj/ui-forge -y -g -a codex" >&2
echo "  All agents:    npx skills add extragraj/ui-forge -y -g" >&2
echo "" >&2
echo "Or set manually:  export CLAUDE_SKILL_DIR=/path/to/ui-forge" >&2
exit 1
