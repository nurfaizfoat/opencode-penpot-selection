import { Plugin } from "@opencode/plugin";
import { createHostAdapter, serverName } from "./host.ts";
import { formatReferences, record, SelectionError } from "./model.ts";
import { PenpotSelection } from "./rpc.ts";
import { createSelectionService } from "./service.ts";
import type { CaptureInput, ClearInput, RemoveInput } from "./service.ts";
import type { ReferenceState } from "./model.ts";

export default Plugin.define({
  id: "opencode-penpot-selection",
  async setup(ctx) {
    const adapter = createHostAdapter(ctx, serverName(ctx.options));
    let emit: (sessionID: string, state: ReferenceState) => Promise<void> = async () => {};
    const service = createSelectionService({
      ...adapter,
      load: (key) => ctx.storage.get(key),
      save: (key, state) => ctx.storage.set(key, JSON.parse(JSON.stringify(state))),
      changed: (sessionID, state) => emit(sessionID, state),
    });

    const registration = await ctx.rpc.register(PenpotSelection, {
      get: async (input, rpc) => {
        try { return await service.get(record(input).sessionID as string); }
        catch (error) { return failure(error, rpc.error); }
      },
      capture: async (input, rpc) => {
        try { return await service.capture(input as CaptureInput, rpc.signal); }
        catch (error) { return failure(error, rpc.error); }
      },
      remove: async (input, rpc) => {
        try { return await service.remove(input as RemoveInput); }
        catch (error) { return failure(error, rpc.error); }
      },
      clear: async (input, rpc) => {
        try { return await service.clear(input as ClearInput); }
        catch (error) { return failure(error, rpc.error); }
      },
    });
    emit = (sessionID, state) => registration.events.emit("changed", { sessionID, state });

    const prompt = await ctx.session.hook("prompt", async (event) => {
      const state = await service.get(event.sessionID);
      if (state.revision === 0) return;
      // Append, never prepend: existing file/agent mention offsets remain valid.
      event.prompt.text += `\n\n${formatReferences(state)}`;
    });

    return async () => {
      await prompt.dispose();
      await registration.dispose();
    };
  },
});

/** Errors are deliberately generic unless they were created by our validated code. */
function failure(error: unknown, makeError: (name: "failure", message: string, data: { code: string; message: string }) => unknown): never {
  const safe = error instanceof SelectionError
    ? error
    : new SelectionError("capture_failed", "The selection action failed. Retry or reconnect the plugin.");
  throw makeError("failure", safe.message, { code: safe.code, message: safe.message });
}
