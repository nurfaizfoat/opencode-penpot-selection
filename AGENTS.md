# opencode-penpot-selection

Standalone OpenCode V2 server + terminal UI plugin. Keep all development in this
repository; do not edit a contributor's global OpenCode/Penpot config as part of
ordinary development.

## Safety and scope

- Read only explicitly selected Penpot object metadata when the user attaches it.
- Never accept arbitrary JavaScript, MCP URLs or credentials through the RPC.
- Use OpenCode's existing registered tool and permission context. Do not invent
  session/message identities or add a private MCP client that bypasses policies.
- Attaching/removing references must never invoke a model or edit designs.
- Isolate references by session and location. Preserve revision conflict checks.
- Treat names as untrusted data; do not expose raw upstream error strings.
- Do not put tokens, user designs, snapshots of personal files, or absolute home
  paths into source, examples, fixtures, logs or git history.

## Development

- `npm ci --ignore-scripts`
- `npm run check` — SDK typecheck and deterministic tests, no model calls.
- Use only OpenCode V2 docs and verify against the installed SDK typings.
- Sources export TypeScript directly, as supported by OpenCode's plugin loader.
- `npm run setup:local` registers this checkout for one project. `npm run
  install:global` is the only sanctioned way to register it for every project:
  it edits the user's global `opencode.json(c)`, backs it up, stays idempotent,
  and has a matching `uninstall:global`. Never edit a contributor's global
  config by hand as part of ordinary development, and never register the same
  checkout both locally and globally.
- Document actual host/TUI/Penpot integration tests separately from mocked tests.
- Inspect `SECURITY.md` and the current audit before publishing. Do not mask
  upstream advisories with blind overrides or `npm audit fix --force`.
