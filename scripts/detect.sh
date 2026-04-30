#!/bin/sh
# UI Forge — cross-agent skill root detection
# Outputs the absolute path to the ui-forge skill root on stdout.
# Exit 0 on success. Exit 1 with error on stderr if not found.
#
# Usage:
#   SKILL_ROOT=$(sh "$SKILL_ROOT/scripts/detect.sh")

# Priority 1 — Claude Code sets this natively. Use immediately if valid.
if [ -n "$CLAUDE_SKILL_DIR" ] && [ -f "$CLAUDE_SKILL_DIR/SKILL.md" ]; then
  echo "$CLAUDE_SKILL_DIR"
  exit 0
fi

# Priority 2 — Walk known install locations in order:
#   Codex global → Claude Code global → project-local variants
for CANDIDATE in \
  "$HOME/.codex/skills/ui-forge" \
  "$HOME/.agents/skills/ui-forge" \
  "$HOME/.agentic/skills/ui-forge" \
  "$HOME/.claude/skills/ui-forge" \
  "/etc/codex/skills/ui-forge" \
  "./.agents/skills/ui-forge" \
  "./.agentic/skills/ui-forge" \
  "./.claude/skills/ui-forge"; do
  if [ -f "$CANDIDATE/SKILL.md" ]; then
    cd "$CANDIDATE" && echo "$(pwd)" && exit 0
  fi
done

# Priority 3 — Not found. Emit actionable error.
echo "ui-forge: skill directory not found." >&2
echo "" >&2
echo "Install with:" >&2
echo "  Codex CLI:    npx skills add extragraj/ui-forge -y -g -a codex" >&2
echo "  Claude Code:  npx skills add extragraj/ui-forge -y -g -a claude-code" >&2
echo "" >&2
echo "Or set manually:  export CLAUDE_SKILL_DIR=/path/to/ui-forge" >&2
exit 1
