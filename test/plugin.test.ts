import test from "node:test";
import assert from "node:assert/strict";
import type { Plugin } from "@opencode/plugin";
import plugin from "../src/index.ts";
import { parseSelection } from "../src/model.ts";
import { snapshot, time } from "./fixtures.ts";

test("registered prompt hook appends pinned/cleared metadata without changing existing offsets", async () => {
  type Hook = Parameters<Plugin.Context["session"]["hook"]>[1];
  let hook: Hook | undefined;
  let state: unknown;
  let disposals = 0;
  const mock = {
    options: {}, location: { directory: "/project" },
    storage: { get: async () => state },
    rpc: { register: async () => ({ events: { emit: async () => {} }, dispose: async () => { disposals++; } }) },
    session: {
      get: async () => ({ location: { directory: "/project" } }),
      hook: async (_name: string, callback: Hook) => { hook = callback; return { dispose: async () => { disposals++; } }; },
    },
  };
  const cleanup = await plugin.setup(mock as unknown as Plugin.Context);
  assert.ok(hook);
  // The SDK overload covers several hook kinds; this fixture exercises only "prompt".
  const promptHook = hook as unknown as (event: { sessionID: string; prompt: { text: string; mentions: unknown[] } }) => Promise<void>;
  const event = () => ({ sessionID: "ses_existing", prompt: { text: "Review @file", mentions: [{ start: 7, end: 12 }] } });
  const untouched = event();
  await promptHook(untouched);
  assert.equal(untouched.prompt.text, "Review @file");

  state = { revision: 1, references: parseSelection(snapshot, time) };
  const attached = event();
  await promptHook(attached);
  assert.ok(attached.prompt.text.startsWith("Review @file\n\n"));
  assert.ok(attached.prompt.text.includes('"layerID": "layer-one"'));
  assert.deepEqual(attached.prompt.mentions, [{ start: 7, end: 12 }]);

  state = { revision: 2, references: [] };
  const cleared = event();
  await promptHook(cleared);
  assert.ok(cleared.prompt.text.includes('"references": []'));
  assert.ok(!cleared.prompt.text.includes("layer-one"));
  if (cleanup) await cleanup();
  assert.equal(disposals, 2);
});
