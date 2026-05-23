---
description: Verify a UI Forge–generated component against its contract
argument-hint: <component.tsx> [<contract.ts>] [--playwright <url>]
---

Verify a UI Forge–generated component (static contract check, plus
optional Playwright screenshot).

If $ARGUMENTS contains a component path, run via your bash / terminal
tool:

```
node "$CLAUDE_PLUGIN_ROOT/scripts/verify.js" $ARGUMENTS
```

If no component path was provided, ask the user which component to
verify before running. Single-arg mode auto-detects the contract via
the `// @contract` directive at the top of the component file; the
explicit `<contract.ts>` argument is only required when that directive
is absent.
