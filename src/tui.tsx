import { Plugin } from "@opencode/plugin/tui";
import { createEffect, For, Show } from "solid-js";
import { PenpotSelection } from "./rpc.ts";
import { parseState, referenceKey } from "./model.ts";
import type { ReferenceState } from "./model.ts";

export default Plugin.define({
  id: "opencode-penpot-selection.tui",
  setup(ctx) {
    const rpc = ctx.client.rpc(PenpotSelection);
    const [memory, update] = ctx.storage.memory("references", {
      initial: { bySession: {} as Record<string, ReferenceState>, busy: {} as Record<string, boolean> },
    });
    let stopped = false;
    const request = () => ({ location: ctx.location ?? ctx.data.location.default() });

    function accept(sessionID: string, value: unknown) {
      if (stopped) return;
      const state = parseState(value);
      update((draft) => {
        if ((draft.bySession[sessionID]?.revision ?? -1) <= state.revision) draft.bySession[sessionID] = state;
      });
    }

    async function load(sessionID: string) {
      try { accept(sessionID, await rpc.get({ sessionID }, request())); }
      catch { /* Initial rendering must not break the prompt if the server part is unavailable. */ }
    }

    function activeSession(): string | undefined {
      const route = ctx.ui.router.current();
      return route.type === "session" ? route.sessionID : undefined;
    }

    async function action(kind: "append" | "replace" | "clear" | "remove", selectedKey?: string, target = activeSession()) {
      if (!target) {
        ctx.ui.toast.show({ title: "Penpot", message: "Open an OpenCode session first.", variant: "warning" });
        return;
      }
      if (memory.busy[target]) return;
      update((draft) => { draft.busy[target] = true; });
      try {
        // Refresh before mutating: another TUI may have changed the same session.
        accept(target, await rpc.get({ sessionID: target }, request()));
        const state = memory.bySession[target] ?? { revision: 0, references: [] };
        const input = { sessionID: target, expectedRevision: state.revision };
        let result: unknown;
        if (kind === "clear") result = await rpc.clear(input, request());
        else if (kind === "remove") {
          const key = selectedKey ?? await ctx.ui.dialog.select({
            title: "Remove a Penpot reference",
            options: state.references.map((ref) => ({
              title: ref.name, value: referenceKey(ref), description: `${ref.fileName} / ${ref.pageName} · ${ref.type}`,
            })),
          });
          if (!key) return;
          result = await rpc.remove({ ...input, key }, request());
        } else result = await rpc.capture({ ...input, mode: kind }, request());
        accept(target, result);
        if (!stopped) ctx.ui.toast.show({
          title: "Penpot references",
          message: kind === "clear" ? "References cleared. No design objects were changed." : `${memory.bySession[target]?.references.length ?? 0} pinned reference(s). Send your message when ready.`,
          variant: "success",
        });
      } catch (error) {
        await load(target);
        if (!stopped) ctx.ui.toast.show({ title: "Penpot", message: errorMessage(error), variant: "error", duration: 7000 });
      } finally {
        if (!stopped) update((draft) => { draft.busy[target] = false; });
      }
    }

    ctx.keymap.layer(() => ({
      commands: [
        {
          id: "penpot-selection.attach", title: "Attach Penpot selection", group: "Penpot",
          palette: true, slash: { name: "penpot-attach", aliases: ["penpot-pane"] },
          bind: typeof ctx.options.shortcut === "string" ? ctx.options.shortcut : ctx.options.shortcut === false ? false : "ctrl+alt+p",
          run: () => action("append"),
        },
        { id: "penpot-selection.replace", title: "Replace Penpot references with selection", group: "Penpot", palette: true, slash: { name: "penpot-replace" }, run: () => action("replace") },
        { id: "penpot-selection.remove", title: "Remove a Penpot reference", group: "Penpot", palette: true, slash: { name: "penpot-remove" }, run: () => action("remove") },
        { id: "penpot-selection.clear", title: "Clear Penpot references", group: "Penpot", palette: true, slash: { name: "penpot-clear" }, run: () => action("clear") },
      ],
      bindings: ["penpot-selection.attach"],
    }));

    const unsubscribe = rpc.events.on("changed", (event) => {
      const location = ctx.location ?? ctx.data.location.default();
      if (event.location.directory !== location.directory) return;
      try {
        const data = event.data as { sessionID: string; state: unknown };
        accept(data.sessionID, data.state);
      } catch { /* Ignore malformed or stale extension events rather than breaking the UI. */ }
    });

    function ReferenceStrip(props: { sessionID: string }) {
      createEffect(() => { void load(props.sessionID); });
      const refs = () => memory.bySession[props.sessionID]?.references ?? [];
      const busy = () => memory.busy[props.sessionID];
      const title = () => {
        const references = refs();
        const files = new Map(references.map((ref) => [ref.fileID, ref.fileName]));
        let project = "";
        if (files.size === 1) {
          const [name] = files.values();
          const characters = Array.from(name);
          project = characters.length > 40 ? `${characters.slice(0, 39).join("")}…` : name;
        } else if (files.size > 1) project = `${files.size} files`;
        return ` Penpot${project ? ` · ${project}` : ""} · ${references.length} pinned `;
      };
      return (
        <box
          flexDirection="column" width="100%" flexShrink={0} marginBottom={1}
          border borderStyle="rounded" borderColor={ctx.theme.text.base}
          title={title()}
        >
          <box flexDirection="row" flexWrap="wrap" columnGap={1} rowGap={0} paddingLeft={1} paddingRight={1}>
            <Show when={refs().length > 0} fallback={<text fg={ctx.theme.text.base}>No references attached. Select layers in Penpot to attach.</text>}>
              <For each={refs()}>{(ref) => (
                <box
                  flexDirection="row" maxWidth="100%" flexShrink={0}
                  border borderStyle="rounded" borderColor={ctx.theme.text.base}
                  paddingLeft={1} paddingRight={1}
                  onMouseDown={() => { void action("remove", referenceKey(ref), props.sessionID); }}
                >
                  <text minWidth={0} flexShrink={1} wrapMode="word" fg={ctx.theme.text.base}>{ref.name} ×</text>
                </box>
              )}</For>
            </Show>
          </box>
          <box
            flexDirection="row" width="100%" flexShrink={0} columnGap={2} rowGap={0} flexWrap="wrap" paddingLeft={1} paddingRight={1}
            border={["top"]} borderColor={ctx.theme.text.base}
          >
            <text fg={ctx.theme.text.base} onMouseDown={() => { void action("append", undefined, props.sessionID); }}>
              <u>{busy() ? "Reading…" : "+ Attach selection"}</u>
            </text>
            <text fg={ctx.theme.text.base} onMouseDown={() => { void action("replace", undefined, props.sessionID); }}><u>Replace</u></text>
            <Show when={refs().length > 0}>
              <text fg={ctx.theme.text.base} onMouseDown={() => { void action("clear", undefined, props.sessionID); }}><u>Clear</u></text>
            </Show>
          </box>
        </box>
      );
    }

    const removeSlot = ctx.ui.slot({
      append: "session.composer.top",
      render: (props) => <ReferenceStrip sessionID={props.sessionID} />,
    });
    return () => { stopped = true; removeSlot(); unsubscribe(); };
  },
});

/** Only surface our declared error codes; SDK exceptions can include endpoint URLs. */
export function errorMessage(error: unknown): string {
  const safe: Record<string, string> = {
    not_connected: "Open Penpot, connect its file to MCP, and check /mcps before retrying.",
    no_selection: "Select one or more Penpot canvas objects or layers first (not an Assets thumbnail).",
    too_many_layers: "A maximum of 50 references is supported. Select fewer objects or remove references.",
    conflict: "The reference list changed. It has been refreshed; please retry the action.",
    session_unavailable: "Open a session here and send an initial message before attaching a selection.",
    permission_denied: "Permission to inspect the selection was not granted.",
    invalid_selection: "Penpot returned invalid selection metadata. Reconnect its MCP plugin and retry.",
    capture_failed: "The selection action failed. Check the plugin connection and retry.",
  };
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: { code?: unknown } }).data;
    if (typeof data?.code === "string" && Object.hasOwn(safe, data.code)) return safe[data.code];
  }
  return "The selection extension could not be reached. Check that its server and TUI parts are loaded, then retry.";
}
