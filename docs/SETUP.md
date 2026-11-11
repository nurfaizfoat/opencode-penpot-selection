# Setup and troubleshooting

The [README](../README.md) covers the everyday design workflow. This page covers
the connection and installation details.

## Connect Penpot first

1. Set up the MCP integration supported by your Penpot version. See the official
   [Penpot MCP guide](https://help.penpot.app/mcp/).
   This plugin does not install Penpot, start Docker, or discover endpoints.
2. Register that server in OpenCode as `penpot`. For an all-project installation,
   register the MCP connection globally as well. Follow the current
   [OpenCode MCP documentation](https://opencode.ai/docs/mcp-servers).
3. In OpenCode, open `/mcps` and confirm the server is connected.
4. In Penpot, open a design and connect its MCP integration. Select a canvas layer
   or Layers entry, not a thumbnail in Assets.

Keep credential-bearing connection URLs private. Store credentials separately
from shared project files. The plugin's `server` option accepts a registered
server name, not a URL, password, or token. The expected tool is `<server>_execute_code`.

## Install for every project

From the cloned plugin folder:

```sh
npm ci --ignore-scripts
npm run check
npm run install:global
```

The installer adds this checkout's file URL to `plugins` in your global
`opencode.json(c)`, normally under `~/.config/opencode/` (or `$XDG_CONFIG_HOME/opencode/`).
It preserves unrelated settings, backs up changes, and is safe to run again.
It refuses files it cannot parse as plain JSON, including JSONC with comments;
in that case it prints an entry you can merge manually without losing comments.

Keep the checkout and `node_modules` in place. Moving or deleting the folder breaks
the registration. Undo with `npm run uninstall:global` from that checkout.
Uninstalling does not erase historical attachments or OpenCode's stored session data.

If you previously ran `npm run setup:local`, remove only this plugin's duplicate
entry from `.opencode/opencode.json` after installing globally. If that file contains
only this registration, rename it to `opencode.json.disabled`. Preserve other plugins
and settings. Do not run `setup:local` again if you want the global setup.

### Shortcut

The default shortcut is `Ctrl+Alt+P`. To use only the buttons and slash commands,
add `"shortcut": false` to the installed entry's `options`:

```jsonc
{
  "server": "penpot",
  "shortcut": false
}
```

This is the **options object**, not a replacement for the whole config file.
A supported OpenCode key string can replace `false` to choose a different binding.
See [OpenCode keybindings](https://opencode.ai/docs/cli/keybinds).

## Install for one project instead

Do not also install globally. Merge this into that project's `opencode.jsonc`,
adjusting the path relative to that config file:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "../opencode-penpot-selection",
      "options": { "server": "penpot", "shortcut": false }
    }
  ]
}
```

See [the example](../examples/opencode.jsonc). To test from the plugin checkout
itself, `npm run setup:local` creates a git-ignored local registration without
touching global settings.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| No pane on the welcome screen | Enter a session. The pane belongs above the session composer. |
| Can't capture in a new session | Send one normal message first. Capture needs a real session/message context. |
| Pane absent in another project | Install globally, or register the plugin in that project. Run `/reload`. |
| Missing MCP tool | Check `/mcps`, the `server` option, and the open design's connection. |
| Could not read Penpot | Keep Penpot open, reconnect the file, select layers, and retry. |
| References changed during an action | Another action updated them. Review the refreshed pins and retry. |
| Names look out of date | Pins are capture-time labels. Reattach to refresh them; IDs identify the objects. |
| Several layers have the same name | `/penpot-remove` shows file/page/type context to help distinguish them. |

Config changes normally reload automatically; `/reload` requests a refresh.
Changes to an unwatched local checkout may require reopening OpenCode. A service
restart interrupts other sessions, so don't use it as the first troubleshooting step.

The tested host is **OpenCode 2.1.3**. A global config edit or passing mocked tests
does not prove the pane rendered or every mouse/shortcut action passed on another
host. Check [actual integration results](TESTING.md) before relying on a new version.

## About the hero image

`images/hero.webp` is an AI-generated illustration of the two-window workflow:
OpenCode and the selection pane on the left, Penpot on the right. All design content,
layer names, and conversation text are fictional. It is not an application screenshot,
a visual specification, or evidence of a passed integration test.
