# Security and privacy

## Status

This is an experimental OpenCode V2 plugin, not a reviewed security boundary or a production-ready release. Live single-layer capture and persisted readback have passed; broader Penpot interaction and end-to-end testing remain outstanding.

The dependency audit on **2026-11-11** reports **28 upstream findings: 25 moderate and 3 critical**. The critical chain involves `@opentui/solid` → `solid-js` → `seroval`; installed versions include `solid-js` 1.9.12 and `seroval` 1.5.6. npm reports no available fix for that critical chain in the installed dependency graph. Some moderate findings have fixes; this does not clear the critical chain. These are not asserted to be exploitable through this plugin, but mocked tests and successful loading do not establish safety. Re-run `npm audit` before release, inspect affected upstream versions and host compatibility, and review advisories. Do not hide them with blind overrides or `npm audit fix --force`. This project does not bundle or replace the host's UI runtime.

This audit covers the plugin's npm dependency graph, **not** Penpot's Docker images, operating system, or the OpenCode host's independently installed runtime. Local hosting does not make either graph vulnerability-free.

## Self-hosted Penpot

Before connecting a local installation:

- **Check your version against [Penpot's security advisories](https://github.com/penpot/penpot/security/advisories).** In particular, [GHSA-pf4p-35w6-gcqc](https://github.com/penpot/penpot/security/advisories/GHSA-pf4p-35w6-gcqc) describes an authenticated arbitrary file read affecting versions **below 2.18.6**, fixed in **2.18.6**. A matching version is a reason to patch, not proof that your installation has been exploited. Recheck newer advisories; 2.18.6 is the minimum for this particular fix, not a permanent safe-version guarantee.
- **Back up before upgrading.** Follow the official [self-hosting guide](https://help.penpot.app/technical-guide/getting-started/). Update the relevant services together, and verify the running backend/image version after restarting; a compose tag or frontend version alone does not establish the running backend's patch state.
- **Keep services private.** Bind published Docker ports to loopback for a single-machine setup. Do not publish the database, cache, internal admin, MCP bridge, or debugging/REPL ports. Older MCP releases have published [REPL exposure](https://github.com/penpot/penpot/security/advisories/GHSA-852x-m8p9-558v) and [WebSocket binding](https://github.com/penpot/penpot/security/advisories/GHSA-ch2q-6x56-qg5r) advisories; check actual listeners, not just the advertised URL.
- **Keep credentials private.** Restrict access to `.env`, backups, and token files. A local HTTP MCP endpoint can still grant powerful design access to anyone who obtains its credential. Don't disable authentication to make setup easier.
- **Avoid untrusted imports and plugins.** Localhost doesn't stop malicious content or an untrusted browser extension from operating in your logged-in browser. Disable open registration if you don't need it. If you expose Penpot beyond loopback, review HTTPS, secure cookies, access controls, and firewall rules first.

The pane only reads selection metadata, but the underlying Penpot execute-code tool can do much more. Keep OpenCode's permission checks in place. Designs remaining local does **not** mean model requests remain local: sending a message forwards its attached metadata to your configured provider.

## Attachment boundary

- Capture reads metadata only for explicitly selected Penpot objects: file/page/layer IDs, names, type, and capture time. It does not traverse unrelated layers or export design contents.
- RPC accepts selection mode, session identity, revision, and removal key—not arbitrary JavaScript, MCP endpoints, or credentials.
- The server uses the existing `<server>_execute_code` tool and calls OpenCode's permission assertion before execution, with real session/message/agent context. No private MCP client or invented session/message identities are used.
- Only the fixed read-only query in `src/selection-code.ts` is executed. The upstream execute-code tool is powerful; trust your OpenCode, Penpot, MCP server, and plugins. This plugin is not a sandbox for them.
- Capturing/removing references invokes no model and does not edit a design. A later user message follows OpenCode's normal model/tool/permission behavior.
- Session ownership is checked against the plugin location. Mutations use expected revisions and serialized updates to avoid lost updates within a host plugin instance.
- Labels are validated, stripped of control/format characters, length-limited, and escaped in prompt metadata. Names remain untrusted; text escaping cannot guarantee a model will ignore prompt injection. References alone are not editing authorization.
- RPC/TUI errors do not expose raw upstream exception messages. OpenCode or upstream MCP logging may still contain sensitive information; inspect and redact before sharing.

## Stored and transmitted data

Validated references persist in OpenCode plugin-local storage for a session. The TUI caches them in memory. Each subsequent normal prompt receives the active reference set, including an explicit empty set after clearing. Consequently, reference names and identifiers may enter session history and the configured model provider's context when a user sends a message.

Clear/remove are not secure deletion: they do not erase historical messages, logs, backups, or previously transmitted provider data. Do not attach confidential metadata to an untrusted provider. Installation and automated tests do not need your designs or tokens.

## Handling credentials and reports

Configure the MCP server separately through OpenCode's supported configuration and authentication. Never include credentials, resolved config dumps, personal home paths, design snapshots, or raw session transcripts in source, fixtures, screenshots, or public issues. `.opencode/` is ignored because local registration contains machine-specific paths.

If a credential-bearing URL has been printed or shared, regenerate/revoke that credential and update it privately. Redaction after the fact is not a substitute for rotation.

For a vulnerability, use the hosting repository's private security reporting channel if one is enabled. If none exists, ask maintainers to establish a private channel without posting exploit details, secrets, or user designs publicly. No private reporting address or response SLA is established yet.
