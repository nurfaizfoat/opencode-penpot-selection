import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { parseSelection, parseState, referenceKey } from "../src/model.ts";
import type { ReferenceState } from "../src/model.ts";
import { snapshot, time } from "./fixtures.ts";

// A deterministic JSX tree, not a terminal renderer or a live host interaction test.
interface Element {
  type: string;
  props: Record<string, unknown>;
  children: unknown[];
}
function jsx(type: string | ((props: Record<string, unknown>) => unknown), props: Record<string, unknown> | null, ...children: unknown[]): unknown {
  return typeof type === "function" ? type({ ...props, children: children.length === 1 ? children[0] : children }) : { type, props: props ?? {}, children };
}
function elements(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== "object" || !("type" in tree)) return [];
  const node = tree as Element;
  return [node, ...node.children.flatMap(elements)];
}
function text(tree: unknown): string {
  if (Array.isArray(tree)) return tree.map(text).join("");
  if (tree && typeof tree === "object" && "children" in tree) return text((tree as Element).children);
  return tree == null || typeof tree === "boolean" ? "" : String(tree);
}

const source = ts.transpileModule(readFileSync(new URL("../src/tui.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, jsxFactory: "jsx", target: ts.ScriptTarget.ES2023 },
}).outputText;

function fixture(state: ReferenceState, busy = false, themeText = "#FFFFFF") {
  const calls: { method: string; input: Record<string, unknown>; request: unknown }[] = [];
  const memory = { bySession: { ses_panel: state }, busy: { ses_panel: busy } };
  const rpc = {
    ...Object.fromEntries(["get", "capture", "clear", "remove"].map((method) => [method,
      async (input: Record<string, unknown>, request: unknown) => { calls.push({ method, input, request }); return state; },
    ])),
    events: { on: () => () => {} },
  };
  let slot: { append: string; render: (props: { sessionID: string }) => unknown } | undefined;
  const ctx = {
    client: { rpc: () => rpc }, options: {}, location: { directory: "/project" },
    storage: { memory: () => [memory, (update: (value: typeof memory) => void) => update(memory)] },
    theme: { text: { base: themeText } }, keymap: { layer: () => {} },
    ui: {
      router: { current: () => ({ type: "session", sessionID: "ses_other" }) },
      toast: { show: () => {} },
      slot: (value: typeof slot) => { slot = value; return () => {}; },
    },
  };
  const exports = {} as { default: { setup: (context: unknown) => void } };
  runInNewContext(source, {
    exports, jsx,
    require: (id: string) => {
      if (id === "@opencode/plugin/tui") return { Plugin: { define: (value: unknown) => value } };
      if (id === "solid-js") return {
        createEffect: (effect: () => void) => effect(),
        Show: (props: { when: unknown; children: unknown; fallback?: unknown }) => props.when ? props.children : props.fallback,
        For: (props: { each: unknown[]; children: (value: unknown) => unknown }) => props.each.map(props.children),
      };
      if (id === "./model.ts") return { parseState, referenceKey };
      if (id === "./rpc.ts") return { PenpotSelection: {} };
      throw Error(`Unexpected import: ${id}`);
    },
  });
  exports.default.setup(ctx);
  assert.equal(slot?.append, "session.composer.top");
  const tree = slot!.render({ sessionID: "ses_panel" }) as Element;
  return { tree, calls, nodes: elements(tree) };
}
const pinned = (): ReferenceState => ({ revision: 2, references: parseSelection(snapshot, time) });
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

test("reference panel has a rounded frame, separated actions, and wrapping content", () => {
  const { tree, nodes, calls } = fixture(pinned());
  assert.equal(tree.props.border, true);
  assert.equal(tree.props.borderStyle, "rounded");
  assert.equal(tree.props.width, "100%");
  assert.equal(tree.props.flexShrink, 0);
  assert.equal(tree.props.title, " Penpot · Sample design · 2 pinned ");
  assert.equal(tree.props.borderColor, "#FFFFFF");
  assert.ok(nodes.some((node) => node.type === "box" && JSON.stringify(node.props.border) === '["top"]'));
  assert.equal(nodes.filter((node) => node.props.flexWrap === "wrap").length, 2);
  assert.ok(text(tree).includes(`${pinned().references[0].name} ×`));
  assert.ok(!text(tree).includes("No references attached"));
  assert.deepEqual(calls.map((call) => call.method), ["get"]);
});

test("wrapped reference and action rows retain horizontal spacing without vertical gutters", () => {
  for (const state of [pinned(), { revision: 0, references: [] }]) {
    const { nodes } = fixture(state);
    const rows = nodes.filter((node) => node.type === "box" && node.props.flexWrap === "wrap");
    assert.equal(rows.length, 2);
    for (const [index, row] of rows.entries()) {
      assert.equal(row.props.columnGap, index === 0 ? 1 : 2);
      assert.equal(row.props.rowGap, 0);
      assert.equal(row.props.gap, undefined);
      assert.equal(row.props.paddingLeft, 1);
      assert.equal(row.props.paddingRight, 1);
      assert.equal(row.props.paddingTop, undefined);
      assert.equal(row.props.paddingBottom, undefined);
    }
  }
});

test("empty and busy panels keep an informative frame without inactive clear controls", () => {
  const { tree } = fixture({ revision: 0, references: [] }, true);
  assert.equal(tree.props.title, " Penpot · 0 pinned ");
  assert.ok(text(tree).includes("No references attached. Select layers in Penpot to attach."));
  assert.ok(text(tree).includes("Reading…"));
  assert.ok(!text(tree).includes("Clear"));
});

test("title uses one captured file name across multiple pages without extra capture calls", () => {
  const state = pinned();
  state.references[1].pageID = "page-other";
  const { tree, calls } = fixture(state);
  assert.equal(tree.props.title, " Penpot · Sample design · 2 pinned ");
  assert.deepEqual(calls.map((call) => call.method), ["get"]);
});

test("title summarizes multiple file identities even when their names match", () => {
  const state = pinned();
  state.references[1].fileID = "file-other";
  const { tree } = fixture(state);
  assert.equal(tree.props.title, " Penpot · 2 files · 2 pinned ");
});

test("title shortens long file names without splitting Unicode characters or dropping the count", () => {
  const state = pinned();
  for (const ref of state.references) ref.fileName = "🧩".repeat(50);
  const { tree } = fixture(state);
  assert.equal(tree.props.title, ` Penpot · ${"🧩".repeat(39)}… · 2 pinned `);
  assert.ok(state.references.every((ref) => ref.fileName === "🧩".repeat(50)));
});

test("each pinned layer is a padded rounded button with a width cap instead of bracketed text", async () => {
  const state = pinned();
  const { nodes } = fixture(state);
  const buttons = nodes.filter((node) => node.type === "box" && typeof node.props.onMouseDown === "function");
  assert.equal(buttons.length, state.references.length);
  for (const [index, button] of buttons.entries()) {
    const ref = state.references[index];
    assert.equal(button.props.border, true);
    assert.equal(button.props.borderStyle, "rounded");
    assert.equal(button.props.borderColor, "#FFFFFF");
    assert.equal(button.props.paddingLeft, 1);
    assert.equal(button.props.paddingRight, 1);
    assert.equal(button.props.maxWidth, "100%");
    assert.equal(button.props.flexShrink, 0);
    assert.equal(text(button), `${ref.name} ×`);
    const label = elements(button).find((node) => node.type === "text");
    assert.ok(label);
    assert.equal(label.props.minWidth, 0);
    assert.equal(label.props.flexShrink, 1);
    assert.equal(label.props.wrapMode, "word");
    assert.equal(label.props.onMouseDown, undefined);

    const isolated = fixture(state);
    const target = isolated.nodes.find((node) => node.type === "box" && text(node) === `${ref.name} ×`);
    assert.ok(target);
    (target.props.onMouseDown as () => void)();
    await settle();
    const removals = isolated.calls.filter((call) => call.method === "remove");
    assert.equal(removals.length, 1);
    assert.equal(removals[0].input.key, referenceKey(ref));
    assert.equal(removals[0].input.sessionID, "ses_panel");
  }
});

test("bottom actions are underlined without brackets, follow the theme, and retain the top separator", () => {
  const cases: [ReferenceState, boolean][] = [
    [pinned(), false], [pinned(), true],
    [{ revision: 0, references: [] }, false], [{ revision: 0, references: [] }, true],
  ];
  for (const themeText of ["#FFFFFF", "#222222"]) {
    for (const [state, busy] of cases) {
      const { tree, nodes } = fixture(state, busy, themeText);
      const footer = nodes.find((node) => node.type === "box" && JSON.stringify(node.props.border) === '["top"]');
      assert.ok(footer);
      assert.equal(footer.props.width, "100%");
      assert.equal(footer.props.flexShrink, 0);
      assert.equal(footer.props.flexWrap, "wrap");
      assert.equal(footer.props.borderColor, themeText);
      assert.equal(footer.props.backgroundColor, undefined);
      assert.equal(footer.props.marginTop, undefined);
      const actions = elements(footer).filter((node) => node.type === "text");
      assert.equal(actions.length, state.references.length ? 3 : 2);
      for (const action of actions) {
        assert.equal(action.props.fg, themeText);
        assert.equal(action.props.bg, undefined);
        const underlines = elements(action).filter((node) => node.type === "u");
        assert.equal(underlines.length, 1);
        assert.equal(text(underlines[0]), text(action));
        assert.ok(!/[\[\]]/.test(text(action)));
      }
      assert.equal(text(actions[0]), busy ? "Reading…" : "+ Attach selection");
      assert.equal(text(actions[1]), "Replace");
      if (state.references.length) assert.equal(text(actions[2]), "Clear");
      // The frame, reference labels, and controls share the normal host theme.
      assert.equal(tree.props.borderColor, themeText);
      assert.equal(tree.props.backgroundColor, undefined);
      const content = nodes.find((node) => node.type === "text" && !actions.includes(node));
      assert.ok(content);
      assert.equal(content.props.fg, themeText);
      assert.equal(content.props.bg, undefined);
    }
  }
});

test("panel controls retain session-scoped capture, replace, remove and clear actions", async () => {
  for (const [label, method, mode] of [
    ["+ Attach selection", "capture", "append"],
    ["Replace", "capture", "replace"],
    [`${pinned().references[0].name} ×`, "remove", undefined],
    ["Clear", "clear", undefined],
  ] as const) {
    const { nodes, calls } = fixture(pinned());
    const control = nodes.find((node) => typeof node.props.onMouseDown === "function" && text(node).trim() === label);
    assert.ok(control, label);
    (control.props.onMouseDown as () => void)();
    await settle();
    const mutation = calls.find((call) => call.method !== "get");
    assert.equal(mutation?.method, method);
    assert.equal(mutation?.input.sessionID, "ses_panel");
    assert.equal(mutation?.input.expectedRevision, 2);
    assert.equal(mutation?.input.mode, mode);
    assert.equal(JSON.stringify(mutation?.request), JSON.stringify({ location: { directory: "/project" } }));
    if (method === "remove") assert.equal(mutation?.input.key, referenceKey(pinned().references[0]));
  }
});

test("busy panel controls cannot issue mutations", async () => {
  const { nodes, calls } = fixture(pinned(), true);
  for (const node of nodes) if (typeof node.props.onMouseDown === "function") node.props.onMouseDown();
  await settle();
  assert.deepEqual(calls.map((call) => call.method), ["get"]);
});
