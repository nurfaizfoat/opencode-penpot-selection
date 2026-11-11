# Verification and release gates

## Deterministic checks

Run `npm ci --ignore-scripts` and `npm run check`. The checks typecheck against `@opencode/plugin` 2.1.3 and use Node's test runner. Fixtures are synthetic; no model, Penpot, or credential access is required.

Coverage includes response envelopes, invalid/empty/oversized selection, ID-based deduplication, escaped labels, persisted state, append/replace/remove/clear, session ownership, revision conflicts, concurrent mutations, cancellation before commit, permission denial, authentic host context, fixed read-only code, actual prompt-hook registration, explicit cleared prompts, mention-offset preservation, cleanup, setup idempotence/config preservation, and global install/uninstall idempotence with preservation of unrelated keys and refusal to rewrite non-plain-JSON config.

The TUI tests compile the actual TSX into a synthetic JSX tree with mocked host/Solid APIs. They check the rounded frame, captured file title and pinned count (including empty, multi-file, and long Unicode names), action spacing, wrapping configuration, empty/busy states, and session/ID-based action wiring. Wrapped reference and action rows retain their horizontal gaps without extra vertical gutters. Each reference button is checked for a full rounded border, padding, width cap, shrinking/word-wrapping label, and a single identity-scoped remove action on its enclosing box. They also check that the full-width footer uses underlined, bracket-free labels (including the busy state), the normal host theme without forced background colors, and a matching top-border separator, under light/dark mock themes. They do **not** render terminal cells, verify reactive updates, or establish real mouse behavior. Narrow-terminal wrapping still needs live verification.

These tests mock the host adapter and Penpot objects. They do **not** establish real Penpot API compatibility, host permission-dialog behavior, or successful message delivery to a model.

## Isolated terminal-layout smoke check

For the wrapped-spacing fix, an in-memory OpenTUI **0.6.8** renderer on Node **26.13.0** was exercised with synthetic reference buttons and actions using the same layout properties as the panel. Resizing from 80 to 32 to 24 and back to 80 columns confirmed zero blank rows between stacked buttons/actions, a one-column gap between side-by-side buttons, and reference buttons contained within the frame. This checks real terminal-cell layout in isolation, not the mounted OpenCode/Solid plugin, hot reload, or mouse interaction. The user's narrow-window appearance still needs confirmation.

## Actual integration results

Checked with installed OpenCode **2.1.3** on Linux:

- Host plugin listing reports `opencode-penpot-selection` active with `server`, `tui`, and `rpc` features.
- Real, location-scoped RPC `get` returns an initial empty state.
- Real offline RPC `capture` returns declared `failure` / `not_connected`, without upstream endpoint details.
- After reconnecting the existing registered Penpot MCP server through the host API, real single-layer RPC capture succeeds. A subsequent `get` exactly matches the saved state and includes file/page/layer IDs. The existing credential was unchanged; no private names/IDs were copied into test artifacts. The captured reference was left pinned for user inspection.
- A subsequent two-layer selection captured through RPC append adds two new references while retaining the original: three total at revision 2. Verified both new capture timestamps, identity uniqueness, preservation of the original reference, and exact persisted readback. This verifies live multi-selection/append via RPC, not button or slash-command interaction.
- The user's next normal message delivered the same pinned reference block into model-visible context, confirming live prompt-hook attachment. This used the user's own follow-up, not an extra generated test prompt; no personal reference metadata was copied into this document. Cleared-state delivery remains unverified in a real message.
- A controlled PTY and ANSI screen decoder confirm that the actual session screen renders the pinned-count label and attach button together. No raw transcript was saved and no model prompt was submitted.
- At the user's request, direct screenshots of the actual OpenCode window confirmed the current three-reference rounded panel and inverted action bar. Screenshot review exposed an extra pale border row; replacing it with a dark gap produced a single bright control band. A second screenshot confirmed that the update appeared live, with dark labels and the upper references intact. Captures stayed outside the repository; broader captures were removed after producing a tightly cropped temporary panel preview. This checks appearance at the current window size, not narrow layouts or mouse behavior.
- A later screenshot confirms that all three pinned references now render as individually padded, rounded-outline buttons without square brackets. The outer frame and negative action row remain intact. No real reference-removal click was performed for this visual check.
- The user subsequently requested normal (non-inverted) footer colors and a line separator. A fresh screenshot confirms theme-colored controls on the normal background with a full-width separator above them, while all three bordered reference buttons remain intact. The inverted-footer screenshots above describe earlier iterations, not the current styling.
- A further screenshot confirms the current footer labels are underlined and bracket-free, with the normal theme, separator, and bordered reference buttons preserved. The busy label's underline is covered by synthetic tests rather than a live capture.
- Screenshot review also confirms that the captured Penpot file title appears between the Penpot label and pinned count, with the rest of the panel unchanged. This display uses existing attached metadata rather than a new design query.
- Mouse/slash input was attempted, but the expected action toast was not confirmed. Treat TUI interactions as **unverified**, not passing.

Local-directory loading required root entrypoint shims and an explicit file URL registration in this host. RPC schema regex patterns were rejected by the host, so session identity validation runs in code. Requests specify the location explicitly.

A `npm run install:global` path now writes the same file URL into the global `opencode.json(c)`, so the plugin no longer depends on a project-local registration. It backs up the file, preserves unrelated keys, and is reversible with `npm run uninstall:global`. Live confirmation that the strip appears in a project that has **no** local registration is still pending; automated tests only cover the configuration edit.

The user earlier clarified that the chips were **not visible** in their existing terminal. That client was started outside this checkout before its registration existed, and the plugin listing at its startup location did not include this plugin. The checkout's plugin remained active and message metadata continued to work; reopening the session from the registered project was recommended. Earlier successful rendering in a controlled fresh PTY was not proof of visibility in that preexisting client. The later direct screenshot review above now confirms visibility in the actual OpenCode window.

## Outstanding manual checks

Use a disposable design with synthetic names, an existing session, and a separately configured Penpot MCP connection. Never put credentials in test artifacts.

- [x] Verify Penpot exposes the expected execute-code tool and accepts the fixed query.
- [ ] OpenCode permission approval permits capture; denial makes no tool call and changes no references.
- [ ] Attach one layer, then a multi-selection. Confirm displayed names and exact file/page/layer IDs.
- [x] Capture one real selected layer through plugin RPC and verify persisted metadata readback. This does not establish chip interaction or multi-selection behavior.
- [x] Capture two newly selected layers through RPC append, retain the original reference, and verify all three identities persist without duplication.
- [ ] Reattach the same layer: no duplicate. Rename then reattach: refreshed metadata.
- [ ] Append a new selection; replace the entire set; remove a chip; remove through the chooser; clear.
- [ ] Empty selection, disconnected Penpot, and selection above the limit preserve the previous set and show useful errors.
- [ ] Change Penpot's selection/file after capture: pinned targets remain unchanged.
- [ ] Switch sessions/locations and reopen the TUI: isolation and persistence are correct.
- [ ] Two TUIs changing the same session reject a stale revision and refresh correctly.
- [ ] Verify buttons, slash commands, palette actions, default/custom/disabled shortcut, and narrow-terminal wrapping.
- [x] Observe pinned metadata arriving in the user's next normal message. Normal messages **do invoke a model** and are not part of `npm run check`.
- [ ] After clearing, inspect a subsequent explicitly authorized normal message and ensure its empty active set supersedes earlier references.
- [ ] Confirm no design object changed during attach/replace/remove/clear.
- [ ] Confirm the strip appears in a project that does **not** register the plugin locally, after a global install, and that removing the local registration does not break an existing session.
- [ ] Test the packaged installation, not only the checkout.

## Before publication

- [ ] Review `SECURITY.md` and current `npm audit` findings; document compatibility/security decisions.
- [ ] Finish outstanding interaction and live Penpot tests above.
- [ ] Run `npm pack --dry-run` and inspect every included file. Exclude local config, tokens, real designs, transcripts, and machine-specific home paths.
- [ ] Add the actual hosting metadata and a private vulnerability reporting channel when available.
- [ ] Obtain the repository owner's approval before pushing or publishing. No automated publish step exists.
