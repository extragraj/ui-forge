---
description: Generate a component using UI Forge
argument-hint: --task "<task>" --refs <path[,path]> --output <path>
---

Run UI Forge context preparation, then generate the component(s) from
the printed context block.

If $ARGUMENTS includes `--task`, `--refs`, and `--output`, run the
following via your bash / terminal tool:

```
node "$CLAUDE_PLUGIN_ROOT/scripts/invoke.js" $ARGUMENTS
```

If required flags are missing, ask the user for the task description,
ref paths, and output target before invoking — do not run with empty
arguments.

After the command prints the context block, read it carefully and
write the generated component(s) to the output path requested.
