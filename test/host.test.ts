import test from "node:test";
import assert from "node:assert/strict";
import type { Plugin } from "@opencode/plugin";
import { createHostAdapter, serverName } from "../src/host.ts";
import { SELECTION_CODE } from "../src/selection-code.ts";
import { snapshot } from "./fixtures.ts";

function fixture() {
  const calls: { input: unknown; context: Record<string, unknown> }[] = [];
  const permissions: unknown[] = [];
  const mock = {
    location: { directory: "/project" },
    session: {
      get: async () => ({ id: "ses_real", agent: "build", location: { directory: "/project" } }),
      context: async () => [{ id: "msg_real" }],
    },
    permission: { assert: async (value: unknown) => { permissions.push(value); } },
    tool: {
      list: async () => [{
        id: "penpot_execute_code", options: {},
        execute: async (input: unknown, context: Record<string, unknown>) => { calls.push({ input, context }); return { output: snapshot }; },
      }],
    },
  };
  return { mock, calls, permissions, adapter: () => createHostAdapter(mock as unknown as Plugin.Context, "penpot") };
}

test("executes only the fixed read-only code with authentic context and permission check", async () => {
  const { adapter, calls, permissions } = fixture();
  await adapter().readSelection("ses_real", new AbortController().signal);
  assert.equal(permissions.length, 1);
  assert.deepEqual(calls[0].input, { code: SELECTION_CODE });
  assert.equal(calls[0].context.sessionID, "ses_real");
  assert.equal(calls[0].context.messageID, "msg_real");
});

test("does not execute when permission is denied and never leaks upstream error text", async () => {
  const { mock, adapter, calls } = fixture();
  mock.permission.assert = async () => { throw Error("secret URL userToken=do-not-display"); };
  await assert.rejects(adapter().readSelection("ses_real", new AbortController().signal), (e) => {
    assert.ok(e instanceof Error && !e.message.includes("do-not-display"));
    return true;
  });
  assert.equal(calls.length, 0);
});

test("rejects other project locations and sessions without real messages", async () => {
  const { mock, adapter } = fixture();
  mock.session.get = async () => ({ id: "ses_real", agent: "build", location: { directory: "/other" } });
  await assert.rejects(adapter().checkSession("ses_real"), /different/);
  const next = fixture();
  next.mock.session.context = async () => [];
  await assert.rejects(next.adapter().readSelection("ses_real", new AbortController().signal), /initial message/);
});

test("does not read credentials or invent an endpoint when MCP is unavailable", async () => {
  const { mock, adapter, calls } = fixture();
  mock.tool.list = async () => [];
  await assert.rejects(adapter().readSelection("ses_real", new AbortController().signal), /MCP/);
  assert.equal(calls.length, 0);
  assert.equal(serverName({}), "penpot");
  assert.equal(serverName({ server: "penpot-local" }), "penpot-local");
  assert.throws(() => serverName({ server: "https://secret?userToken=token" }), /simple server name/);
});
