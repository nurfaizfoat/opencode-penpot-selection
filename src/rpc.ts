import { Rpc } from "@opencode/plugin/rpc";

const text = { type: "string", maxLength: 256 } as const;
// OpenCode's RPC JSON Schema validator disables regex patterns. Validate in code.
const sessionID = { type: "string", maxLength: 160 } as const;
const revision = { type: "integer", minimum: 0 } as const;
const reference = {
  type: "object",
  properties: {
    fileID: text, fileName: text, pageID: text, pageName: text,
    layerID: text, name: text, type: text, capturedAt: text,
  },
  required: ["fileID", "fileName", "pageID", "pageName", "layerID", "name", "type", "capturedAt"],
  additionalProperties: false,
} as const;
const state = {
  type: "object",
  properties: { revision, references: { type: "array", maxItems: 50, items: reference } },
  required: ["revision", "references"], additionalProperties: false,
} as const;
const errors = {
  failure: {
    type: "object", properties: { code: text, message: text },
    required: ["code", "message"], additionalProperties: false,
  },
} as const;

export const PenpotSelection = Rpc.define({
  id: "penpot-selection",
  methods: {
    get: {
      input: { type: "object", properties: { sessionID }, required: ["sessionID"], additionalProperties: false },
      output: state, errors,
    },
    capture: {
      input: {
        type: "object", properties: { sessionID, expectedRevision: revision, mode: { type: "string", enum: ["append", "replace"] } },
        required: ["sessionID", "expectedRevision", "mode"], additionalProperties: false,
      },
      output: state, errors,
    },
    remove: {
      input: {
        type: "object", properties: { sessionID, expectedRevision: revision, key: { type: "string", maxLength: 1024 } },
        required: ["sessionID", "expectedRevision", "key"], additionalProperties: false,
      },
      output: state, errors,
    },
    clear: {
      input: {
        type: "object", properties: { sessionID, expectedRevision: revision },
        required: ["sessionID", "expectedRevision"], additionalProperties: false,
      },
      output: state, errors,
    },
  },
  events: {
    changed: {
      schema: {
        type: "object", properties: { sessionID, state }, required: ["sessionID", "state"], additionalProperties: false,
      },
    },
  },
});
