import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const folder = path.join(root, ".opencode");
const target = path.join(folder, "opencode.json");
const source = pathToFileURL(root).href;
await mkdir(folder, { recursive: true });
try {
  const previous = JSON.parse(await readFile(target, "utf8"));
  if (Array.isArray(previous.plugins) && previous.plugins.some((entry) =>
    entry === source || (entry && typeof entry === "object" && entry.package === source)
  )) console.log("Local plugin registration already exists.");
  else throw new Error("A local config already exists. Merge this plugin's file URL manually; no file was overwritten.");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  await writeFile(target, JSON.stringify({
    $schema: "https://opencode.ai/config.json",
    plugins: [source],
  }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  console.log("Created a git-ignored, checkout-local plugin registration. Global config was not changed.");
}
