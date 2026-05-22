# 1.6.10 — Legacy Sweep Broadening

## Highlights

Extends the legacy sweep to remove three categories of stale files
left behind by pre-1.6.0 installs (and, in rare cases, by hand-copies
of older source bundles into target skill dirs):

1. **`design/`** anywhere inside a skill dir — the design authority
   lives at the project root, never inside `.claude/skills/ui-forge/`.
2. **`references/*` except `prompt-patterns.md`** — `advanced-usage.md`,
   `migration-guide.md`, `versions.md`, `examples.md`,
   `claude-design-handoff-format.md`, `default-*forgeignore.txt`, and
   the `references/standards/` subtree are source-bundle metadata
   read from the installer's package dir, not runtime assets in the
   target.
3. **`themes/README.md`** — source-bundle documentation; the only
   runtime theme asset is `themes/<selected>.json`.

These were silently kept by previous sweeps because they didn't match
any `LEGACY_PATTERNS` rule and the installer ran in
`prompt-unknown`/non-interactive `delete` modes that only act on
named patterns.

---

## Behavior

The sweep now removes these on every `ui-forge init`, `ui-forge
repair`, and `ui-forge doctor --fix`. `repair` already delegates to
`runInit` with `yes: true`, so the broader patterns apply there
automatically — no separate flag needed.

`NEVER_COPY` (install-time safety net in `cli/src/assets.ts`)
mirrors the same three patterns so accidentally-included files in a
future source bundle would be filtered out before write.

---

## Files changed

| File | Change |
|------|--------|
| `cli/src/legacy-sweep.ts` | Added 3 `LEGACY_PATTERNS` entries: stray `design/`, `references/*` (except `prompt-patterns.md`), `themes/README.md` |
| `cli/src/assets.ts` | Mirrored the same 3 patterns in `NEVER_COPY` |
| `cli/dist/*` | Rebuilt from source |
| `skill.version` / `package.json` / `cli/package.json` / `README.md` / `SKILL.md` | Bumped to 1.6.10 |
