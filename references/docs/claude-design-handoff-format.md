# Claude Design Handoff Format

Reference notes on the Claude Design handoff API shape.
Update this file after running Step 1 discovery against a real handoff URL.

## Discovery status

**Not yet completed.** A real Claude Design handoff URL is required to confirm:
- Auth requirement (expected: none — capability token in URL path)
- Response content-type (HTML, JSON manifest, or ZIP)
- JSON manifest field names if applicable
- Whether handoff URLs expire
- Whether embedded asset `<img>` URLs need separate fetching

## How to run discovery

```bash
# 1. Anonymous fetch — expected to work (capability token in URL)
curl -i "https://claude.ai/design/h/<id>"

# 2. If that 401s, try with a browser session cookie
# 3. Record content-type and body shape below
```

## Expected shape (hypothesis)

Claude Design handoff URLs likely carry a long random ID that acts as a capability
token (similar to Google Drive share links or S3 presigned URLs). Based on the
claude.ai/design product description:

| Field | Hypothesis | Confirmed? |
|-------|-----------|------------|
| Auth | None required (token in URL) | — |
| Content-type | `text/html` or `application/json` | — |
| Expiry | Unknown — may be permanent | — |
| Assets | May be inlined or referenced | — |

## `fetch-handoff.js` branching

`scripts/fetch-handoff.js` handles three branches based on content-type:

| Content-type | Branch | Files written |
|---|---|---|
| `application/json` | A — manifest | `manifest.json`, `design.html` (if `manifest.html`), `README.md` (if `manifest.readme`), `tokens.json` (if `manifest.tokens`) |
| `text/html` | B — raw HTML | `design.html` |
| `application/zip` | C — unsupported | Fails with instructions to download manually |

Once discovery is done, update branch A field names to match the real manifest schema
and remove unused branches if the format is confirmed.

## Update instructions

After running discovery against a real URL, fill in:

```
Confirmed content-type: <fill in>
Auth required: yes / no
Manifest fields (if JSON): <fill in>
URL lifetime: permanent / <N> days
Asset handling: inlined / separate fetch needed
```

Then update `scripts/fetch-handoff.js` Branch A field names accordingly.
