import test from "node:test";
import assert from "node:assert/strict";
import { createSelectionService } from "../src/service.ts";
import { referenceKey, SelectionError } from "../src/model.ts";
import { snapshot } from "./fixtures.ts";

function fixture(read: () => Promise<unknown> = async () => structuredClone(snapshot)) {
  const store = new Map<string, unknown>();
  const changes: string[] = [];
  const service = createSelectionService({
    checkSession: async (id) => { if (id === "denied") throw new SelectionError("session_unavailable", "Wrong location"); },
    readSelection: read,
    load: async (key) => structuredClone(store.get(key)),
    save: async (key, value) => { store.set(key, structuredClone(value)); },
    changed: async (id) => { changes.push(id); },
  });
  return { service, store, changes };
}
const signal = () => new AbortController().signal;

test("capture, append, remove, replace and clear are revisioned and session scoped", async () => {
  const { service, changes } = fixture();
  let state = await service.capture({ sessionID: "session-one", mode: "append", expectedRevision: 0 }, signal());
  assert.equal(state.references.length, 2);
  assert.deepEqual(await service.get("session-two"), { revision: 0, references: [] });
  state = await service.remove({ sessionID: "session-one", key: referenceKey(state.references[0]), expectedRevision: 1 });
  assert.equal(state.references[0].name, "Timetable");
  state = await service.capture({ sessionID: "session-one", mode: "replace", expectedRevision: 2 }, signal());
  assert.equal(state.references.length, 2);
  state = await service.clear({ sessionID: "session-one", expectedRevision: 3 });
  assert.deepEqual(state, { revision: 4, references: [] });
  assert.deepEqual(changes, Array(4).fill("session-one"));
});

test("an empty selection leaves the previous references untouched", async () => {
  let empty = false;
  const { service } = fixture(async () => ({ ...snapshot, layers: empty ? [] : snapshot.layers }));
  const before = await service.capture({ sessionID: "one", mode: "append", expectedRevision: 0 }, signal());
  empty = true;
  await assert.rejects(service.capture({ sessionID: "one", mode: "replace", expectedRevision: 1 }, signal()), /Select one/);
  assert.deepEqual(await service.get("one"), before);
});

test("a slow capture cannot resurrect references after a clear", async () => {
  let finish!: (value: unknown) => void;
  let started!: () => void;
  const waiting = new Promise<void>((resolve) => { started = resolve; });
  const { service } = fixture(() => { started(); return new Promise((resolve) => { finish = resolve; }); });
  const pending = service.capture({ sessionID: "one", mode: "append", expectedRevision: 0 }, signal());
  await waiting;
  await service.clear({ sessionID: "one", expectedRevision: 0 });
  finish(snapshot);
  await assert.rejects(pending, (e) => e instanceof SelectionError && e.code === "conflict");
  assert.deepEqual(await service.get("one"), { revision: 1, references: [] });
});

test("simultaneous mutations cannot silently overwrite each other", async () => {
  const { service } = fixture();
  const results = await Promise.allSettled([
    service.capture({ sessionID: "one", mode: "append", expectedRevision: 0 }, signal()),
    service.capture({ sessionID: "one", mode: "append", expectedRevision: 0 }, signal()),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal((await service.get("one")).revision, 1);
});

test("cancelled captures do not commit", async () => {
  const { service } = fixture();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(service.capture({ sessionID: "one", mode: "append", expectedRevision: 0 }, controller.signal));
  assert.equal((await service.get("one")).revision, 0);
});

test("location ownership is checked before reading or updating state", async () => {
  const { service } = fixture();
  await assert.rejects(service.get("denied"), /Wrong location/);
  await assert.rejects(service.clear({ sessionID: "denied", expectedRevision: 0 }), /Wrong location/);
});

test("capture cancelled during its final state read does not commit", async () => {
  let reads = 0;
  let saves = 0;
  let release!: () => void;
  let entered!: () => void;
  const enteredRead = new Promise<void>((resolve) => { entered = resolve; });
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  const service = createSelectionService({
    checkSession: async () => {},
    readSelection: async () => snapshot,
    load: async () => { if (++reads === 2) { entered(); await waiting; } return undefined; },
    save: async () => { saves++; },
    changed: async () => {},
  });
  const controller = new AbortController();
  const capture = service.capture({ sessionID: "one", mode: "append", expectedRevision: 0 }, controller.signal);
  await enteredRead;
  controller.abort();
  release();
  await assert.rejects(capture);
  assert.equal(saves, 0);
});
