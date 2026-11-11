import test from "node:test";
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

test("local setup preserves existing string/object registrations and refuses unrelated config", async () => {
  const parent = process.env.TMPDIR ?? "/tmp/opencode";
  await mkdir(parent, { recursive: true });
  const root = await mkdtemp(path.join(parent, "penpot-setup-"));
  try {
    await mkdir(path.join(root, "scripts"));
    const script = path.join(root, "scripts", "setup-local.mjs");
    await copyFile(new URL("../scripts/setup-local.mjs", import.meta.url), script);
    const config = path.join(root, ".opencode", "opencode.json");
    const run = () => execFileSync(process.execPath, [script], { encoding: "utf8" });
    assert.match(run(), /Created/);
    const original = await readFile(config, "utf8");
    assert.match(run(), /already exists/);
    assert.equal(await readFile(config, "utf8"), original);

    const source = pathToFileURL(root + path.sep).href;
    const objectConfig = JSON.stringify({ plugins: [{ package: source, options: { server: "custom" } }], other: true });
    await writeFile(config, objectConfig);
    assert.match(run(), /already exists/);
    assert.equal(await readFile(config, "utf8"), objectConfig);

    const unrelated = JSON.stringify({ plugins: ["other-plugin"] });
    await writeFile(config, unrelated);
    assert.notEqual(spawnSync(process.execPath, [script]).status, 0);
    assert.equal(await readFile(config, "utf8"), unrelated);
  } finally {
    // Only remove the synthetic directory created by this test.
    await rm(root, { recursive: true, force: true });
  }
});
