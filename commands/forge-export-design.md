---
description: Export project design system as a Claude Design–ingestible bundle
argument-hint: [out-dir]
---

Export the project's design system as a Claude Design–ingestible
bundle (writes `design/claude-design-bundle/` by default).

Run via your bash / terminal tool:

```
node "$CLAUDE_PLUGIN_ROOT/scripts/export-design.js" $ARGUMENTS
```

The out-dir argument is optional; the script supplies a default
internally.
