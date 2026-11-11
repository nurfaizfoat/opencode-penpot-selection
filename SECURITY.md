# Security and privacy

## Status

This is an experimental OpenCode V2 plugin, not a reviewed security boundary or a production-ready release. Live single-layer capture and persisted readback have passed; broader Penpot interaction and end-to-end testing remain outstanding.

The current development dependency audit reports **28 upstream findings: 25 moderate and 3 critical**. The critical chain involves `@opentui/solid`, `solid-js`, and `seroval`; npm reports no available fix for that chain in the installed dependency graph. These are not asserted to be exploitable through this plugin, but mocked tests and successful loading do not establish safety. Re-run `npm audit` before release, inspect affected upstream versions and host compatibility, and review advisories. Do not hide them with blind overrides or `npm audit fix --force`. This project does not bundle or replace the host's UI runtime.

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
