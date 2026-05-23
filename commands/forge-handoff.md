---
description: Fetch a Claude Design handoff URL and materialize refs locally
argument-hint: <handoff-url> [<out-dir>]
---

Fetch a Claude Design handoff URL and materialize the refs into the
local cache directory.

If $ARGUMENTS contains a URL, run via your bash / terminal tool:

```
node "$CLAUDE_PLUGIN_ROOT/scripts/fetch-handoff.js" $ARGUMENTS
```

If no URL was provided, ask the user for the Claude Design handoff URL
before running. The script requires the URL as the first positional
argument; the out-dir is optional and defaults to
`design/.handoff-cache`.
