# OpenCode Penpot Selection

Attach selected Penpot objects as pinned references above the OpenCode chat input—without asking the model to inspect your live selection each time.

**Experimental, OpenCode V2 terminal UI only.** The plugin loads in OpenCode **2.1.3**, the reference strip renders in the real TUI, and live single/multi-layer capture, append, persisted readback, and normal-message metadata delivery have passed. Full interaction testing is still pending. This repository has not been published to npm. Review [SECURITY.md](SECURITY.md), including the known upstream dependency advisories, before use or release.

```text
╭─ Penpot · Sample design · 2 pinned ─────────────────────╮
│ ╭──────────╮ ╭──────────────────╮                      │
│ │ Header × │ │ Primary button × │                      │
│ ╰──────────╯ ╰──────────────────╯                      │
│────────────────────────────────────────────────────────│
│ + Attach selection   Replace   Clear                    │
╰────────────────────────────────────────────────────────╯

Ask OpenCode about the attached objects…
```

*Illustrative layout, not a screenshot or proof of live capture.*

Each pinned layer has its own rounded border and padding, rather than square-bracket text. The bottom action row uses underlined, bracket-free labels in the normal host theme, with a horizontal separator above it.

The panel title includes the captured Penpot file name before the pinned count. References spanning multiple files show a file-count summary; long names are shortened in the title only.

## What it does

- Attach one or multiple selected objects; append more selections later.
- Replace the pinned set, remove individual references, or clear everything.
- Pin file, page, and layer IDs plus names and object type, not live-selection pointers.
- Keep references per OpenCode session; reject updates using stale revisions.
- Append the active reference set to subsequent normal user prompts until cleared.
- Use your existing registered Penpot MCP tool and OpenCode permission checks.

Attaching and removing references **do not invoke a model or change a design**. This is metadata, not a screenshot, geometry dump, or copy of an entire file. A later user request can still ask the agent to inspect or modify the referenced objects through normal tools and permissions.

## Requirements

- OpenCode V2 **2.1.3** (the tested SDK/host version; newer V2 versions need verification).
- Node.js **22.18+** and npm for checkout setup/tests.
- Penpot with its MCP integration running and an open design connected to it.
- A Penpot MCP server already registered in OpenCode, normally named `penpot`, exposing `penpot_execute_code`. For a global install it must be registered globally too.
- An existing OpenCode session with at least one message. Capture before the first message is not supported yet; the plugin does not fabricate execution identities.

This plugin does not install Penpot, launch Docker, discover endpoints, or copy credentials.

## Try this checkout

From your local clone:

```sh
cd opencode-penpot-selection
npm ci --ignore-scripts
npm run check
npm run setup:local
opencode
```

Setup creates a git-ignored `.opencode/opencode.json` with this checkout's file URL. It does not change global configuration. Repeated setup preserves an existing matching string or object registration; an unrelated local config is left untouched and requires a manual merge.

### Install for every project (recommended)

To have the strip available in **every** OpenCode project instead of only this checkout:

```sh
npm run install:global
```

This adds this checkout's file URL to your global `opencode.json(c)` (`$XDG_CONFIG_HOME/opencode`, normally `~/.config/opencode`). It backs the file up first, refuses to rewrite a file it cannot parse as plain JSON, and is safe to run repeatedly. Undo it with:

```sh
npm run uninstall:global
```

Register in one place, not both. If this checkout already has a local `.opencode/opencode.json`, remove or rename it after the global install so the same package is not loaded twice.

The entry is written as `{ "package": "<checkout>", "options": { "server": "penpot" } }`. Add `"shortcut": false` to those options to skip the global `Ctrl+Alt+P` binding and use `/penpot-pane` instead.

The Penpot MCP server must also be registered globally, otherwise other projects load the pane but cannot reach `penpot_execute_code`. The plugin stores only the server's simple name, never a URL or credential.

The strip appears **inside a session**, not on the home screen. In a new session, send your first normal message before capturing. A global install makes it available everywhere; for a one-off project instead, merge the following into that project's `opencode.jsonc`, adjusting the relative package path:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "../opencode-penpot-selection",
      "options": {
        "server": "penpot",
        "shortcut": "ctrl+alt+p"
      }
    }
  ]
}
```

See also [examples/opencode.jsonc](examples/opencode.jsonc). Merge rather than overwrite existing plugin entries. Keep the checkout installed with its dependencies. The root entrypoint shims support the tested host's local-directory resolver.

## Workflow

1. In OpenCode, check `/mcps`: your Penpot server must be connected.
2. In Penpot, open a design and connect it through **File → MCP Server → Connect** (wording may differ by Penpot version).
3. Select canvas objects or entries in the Layers panel. An Assets thumbnail is not a selected canvas object.
4. Return to your OpenCode session and click **+ Attach selection** or run `/penpot-pane` (`/penpot-attach` is the same command; `Ctrl+Alt+P` is the default shortcut). Approve the normal tool permission request if shown.
5. Review the pinned names. Change selection in Penpot and attach again to append, or choose **Replace**.
6. Send a normal message, for example: “Explain the relationship between these objects. Do not edit anything.”

| Action | Slash command |
| --- | --- |
| Append selection | `/penpot-pane` (alias `/penpot-attach`) |
| Replace references with selection | `/penpot-replace` |
| Choose one reference to remove | `/penpot-remove` |
| Clear references | `/penpot-clear` |

Click a pinned reference button (including its `×`) to remove it. The command palette also exposes all four actions. Set `shortcut` to `false` to disable the default shortcut, or to a supported OpenCode key string to customize it. A global install binds the shortcut in every project, so `"shortcut": false` plus `/penpot-pane` is the least intrusive setup.

References remain pinned when the selection changes or the session is reopened. Attaching the same file/page/layer again updates its metadata instead of duplicating it. A maximum of **50** references is allowed. Empty or failed captures preserve the previous set. Switching design files does not silently retarget already pinned objects.

## Limitations and troubleshooting

- **No strip:** open a session; check that both server and TUI parts loaded. With a global install, any project works; otherwise launch the TUI from a project that registers this plugin. A terminal started elsewhere before installation can lack the UI even when a moved session receives reference metadata from the server. Reopen the existing session; a background-service restart is not the first step. A checkout change that the host does not watch may need `opencode service restart`. OpenCode Desktop/web/Mini are not implemented targets.
- **Cannot reach extension:** make sure the same project/location loads the plugin server part. Remote servers need access to the package and their own registered Penpot MCP tool.
- **Cannot capture:** check `/mcps`, the open Penpot design's MCP connection, selection, and permission approval. A brand-new message-less session cannot capture.
- **Missing tool:** `server` is the existing MCP server's simple name, not a URL. The expected tool ID is `<server>_execute_code`.
- **References changed:** another action/TUI updated the list. Review the refreshed state and retry; stale edits are rejected.
- **Missing/renamed objects:** names are only capture-time labels. The agent is instructed to resolve IDs and re-read targets before editing, not trust current selection. Deleted objects require clarification.
- **Old references still in history:** clearing affects future prompts and the active strip, not historical messages, logs, backups, or metadata already sent to a model provider.
- **Duplicate labels:** different objects can share a name. `/penpot-remove` shows file/page/type context; IDs in the attached metadata are authoritative.
- **Credential safety:** do not paste MCP URLs, config dumps, design data, or raw host logs into public issues. Rotate a key if it was exposed.

## Development and verification

```sh
npm ci --ignore-scripts
npm run check
npm audit
npm pack --dry-run
```

The tests use synthetic objects, an isolated setup directory, and mocked host APIs. They make no model calls and do not connect to your design. [docs/TESTING.md](docs/TESTING.md) separates automated checks from actual host/UI checks and lists the remaining end-to-end release gates.

The server stores validated metadata and exposes `get`, `capture`, `remove`, and `clear` through a shared RPC contract. The TUI calls that contract with an explicit location. Capture executes only the fixed read-only query in `src/selection-code.ts` through the host's existing tool. The prompt hook appends escaped reference data without moving existing mention offsets.

Contributions: follow [AGENTS.md](AGENTS.md); preserve permission checks, location/session isolation, revision checks, safe errors, and the no-model/no-design-edit attachment boundary. Add synthetic regression tests; never commit personal configuration or design snapshots. Do not publish a release until integration and security gates are reviewed.

## License

[MIT](LICENSE).
