import type { Plugin } from "@opencode/plugin";
import { SELECTION_CODE } from "./selection-code.ts";
import { SelectionError } from "./model.ts";

export function serverName(options: Readonly<Record<string, unknown>>): string {
  const name = options.server ?? "penpot";
  if (typeof name !== "string" || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(name)) {
    throw new Error("The Penpot MCP server option must be a simple server name, not a URL or credential.");
  }
  return name;
}

export function createHostAdapter(ctx: Plugin.Context, server: string) {
  async function session(sessionID: string) {
    if (!/^ses_[A-Za-z0-9_-]{1,156}$/.test(sessionID)) {
      throw new SelectionError("session_unavailable", "The OpenCode session identifier is invalid.");
    }
    let found;
    try { found = await ctx.session.get({ sessionID }); }
    catch { throw new SelectionError("session_unavailable", "The OpenCode session is not available."); }
    if (found.location.directory !== ctx.location.directory) {
      throw new SelectionError("session_unavailable", "This session belongs to a different OpenCode location.");
    }
    return found;
  }

  return {
    async checkSession(sessionID: string): Promise<void> { await session(sessionID); },
    async readSelection(sessionID: string, signal: AbortSignal): Promise<unknown> {
      const info = await session(sessionID);
      const tool = (await ctx.tool.list()).find((tool) => tool.id === `${server}_execute_code`);
      if (!tool) throw new SelectionError("not_connected", "Connect your Penpot MCP server in /mcps and connect a design file in Penpot.");

      // Use real context identities. Never fabricate a message/session to trigger capture.
      const messages = await ctx.session.context({ sessionID });
      const message = messages.at(-1);
      const agent = info.agent ?? messages.findLast((item) => "agent" in item)?.agent;
      if (!message || !agent) {
        throw new SelectionError("session_unavailable", "Send an initial message in this session, then attach your Penpot selection.");
      }
      try {
        await ctx.permission.assert({
          sessionID, agent, action: tool.options?.permission ?? tool.id, resources: ["*"],
          metadata: { purpose: "Read only the selected Penpot object IDs and names" },
        });
      } catch {
        throw new SelectionError("permission_denied", "Permission to inspect the Penpot selection was not granted.");
      }
      signal.throwIfAborted();
      type ExecutionContext = Parameters<typeof tool.execute>[1];
      try {
        return await tool.execute({ code: SELECTION_CODE }, {
          sessionID: info.id as ExecutionContext["sessionID"],
          agent: agent as ExecutionContext["agent"],
          messageID: message.id as ExecutionContext["messageID"],
          id: crypto.randomUUID() as ExecutionContext["id"], signal,
          progress: async () => {},
        });
      } catch (error) {
        if (signal.aborted) throw error;
        // Do not relay arbitrary upstream errors: they can contain token-bearing URLs.
        throw new SelectionError("not_connected", "Could not read Penpot. Keep the app open, connect File → MCP Server → Connect, then retry.");
      }
    },
  };
}
