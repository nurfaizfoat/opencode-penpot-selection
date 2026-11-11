import test from "node:test";
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

test("global install registers once, preserves unrelated config, and uninstalls", async () => {
  const parent = process.env.TMPDIR ?? "/tmp/opencode";
  await mkdir(parent, { recursive: true });
  const root = await mkdtemp(path.join(parent, "penpot-global-"));
  try {
    await mkdir(path.join(root, "scripts"));
    const script = path.join(root, "scripts", "install-global.mjs");
    await copyFile(new URL("../scripts/install-global.mjs", import.meta.url), script);
    const source = pathToFileURL(root + path.sep).href;
    const config = path.join(root, "config", "opencode.json");
    const run = (...args: string[]) =>
      execFileSync(process.execPath, [script, ...args, "--config", config], { encoding: "utf8" });

    assert.match(run(), /Registered/);
    const created = JSON.parse(await readFile(config, "utf8"));
    assert.equal(created.$schema, "https://opencode.ai/config.json");
    assert.deepEqual(created.plugins, [{ package: source, options: { server: "penpot" } }]);
    assert.equal((await stat(config)).mode & 0o777, 0o600);

    const original = await readFile(config, "utf8");
    assert.match(run(), /Already registered/);
    assert.equal(await readFile(config, "utf8"), original);

    const seeded = JSON.stringify({ mcp: { servers: {} }, plugins: ["other-plugin"] }, null, 2);
    await writeFile(config, seeded);
    assert.match(run(), /Registered/);
    const merged = JSON.parse(await readFile(config, "utf8"));
    assert.deepEqual(merged.mcp, { servers: {} });
    assert.deepEqual(merged.plugins, ["other-plugin", { package: source, options: { server: "penpot" } }]);

    assert.match(run("uninstall"), /Removed/);
    assert.deepEqual(JSON.parse(await readFile(config, "utf8")).plugins, ["other-plugin"]);
    assert.match(run("uninstall"), /Not registered/);

    const commented = '{\n  // keep this comment\n  "plugins": []\n}\n';
    await writeFile(config, commented);
    assert.notEqual(spawnSync(process.execPath, [script, "--config", config], { encoding: "utf8" }).status, 0);
    assert.equal(await readFile(config, "utf8"), commented);
  } finally {
    // Only remove the synthetic directory created by this test.
    await rm(root, { recursive: true, force: true });
  }
});
