import { identifier, mergeReferences, parseSelection, parseState, referenceKey, SelectionError } from "./model.ts";
import type { ReferenceState } from "./model.ts";

export interface SelectionHost {
  checkSession(sessionID: string): Promise<void>;
  readSelection(sessionID: string, signal: AbortSignal): Promise<unknown>;
  load(key: string): Promise<unknown>;
  save(key: string, state: ReferenceState): Promise<void>;
  changed(sessionID: string, state: ReferenceState): Promise<void>;
}

export interface CaptureInput { sessionID: string; mode: "append" | "replace"; expectedRevision: number }
export interface RemoveInput { sessionID: string; key: string; expectedRevision: number }
export interface ClearInput { sessionID: string; expectedRevision: number }

export function createSelectionService(host: SelectionHost) {
  const locks = new Map<string, Promise<unknown>>();
  const key = (sessionID: string) => `selection/${identifier(sessionID)}`;

  async function get(sessionID: string): Promise<ReferenceState> {
    await host.checkSession(sessionID);
    return parseState(await host.load(key(sessionID)));
  }

  async function update(sessionID: string, expectedRevision: number, change: (state: ReferenceState) => ReferenceState): Promise<ReferenceState> {
    const previous = locks.get(sessionID) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(async () => {
      const current = await get(sessionID);
      if (!Number.isSafeInteger(expectedRevision) || current.revision !== expectedRevision) {
        throw new SelectionError("conflict", "References changed in another action. Review the refreshed list and try again.");
      }
      const state = change(current);
      if (state.revision > Number.MAX_SAFE_INTEGER) throw new SelectionError("conflict", "Reference revision limit reached.");
      await host.save(key(sessionID), state);
      // An event delivery failure must not turn a committed edit into a misleading failure.
      await host.changed(sessionID, state).catch(() => {});
      return state;
    });
    locks.set(sessionID, next);
    try { return await next; }
    finally { if (locks.get(sessionID) === next) locks.delete(sessionID); }
  }

  return {
    get,
    async capture(input: CaptureInput, signal: AbortSignal): Promise<ReferenceState> {
      if (input.mode !== "append" && input.mode !== "replace") throw new SelectionError("invalid_selection", "Choose append or replace.");
      const before = await get(input.sessionID);
      if (before.revision !== input.expectedRevision) throw new SelectionError("conflict", "Refresh the reference list and try again.");
      const references = parseSelection(await host.readSelection(input.sessionID, signal));
      signal.throwIfAborted();
      return update(input.sessionID, before.revision, (state) => {
        // Capture may have waited for another mutation or a storage read.
        signal.throwIfAborted();
        return {
          revision: state.revision + 1,
          references: mergeReferences(state.references, references, input.mode),
        };
      });
    },
    remove(input: RemoveInput): Promise<ReferenceState> {
      return update(input.sessionID, input.expectedRevision, (state) => ({
        revision: state.revision + 1,
        references: state.references.filter((ref) => referenceKey(ref) !== input.key),
      }));
    },
    clear(input: ClearInput): Promise<ReferenceState> {
      return update(input.sessionID, input.expectedRevision, (state) => ({ revision: state.revision + 1, references: [] }));
    },
  };
}
