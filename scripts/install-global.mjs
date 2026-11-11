// Register this checkout in the user's global OpenCode configuration so the
// Penpot pane is available in every project, not only inside this directory.
//
//   node scripts/install-global.mjs                  # install
//   node scripts/install-global.mjs uninstall        # remove
//   node scripts/install-global.mjs --config <path>  # alternate config file
//
// Writes only the resolved global config file, backs it up first, and refuses
// to rewrite a file it cannot parse as plain JSON.
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = pathToFileURL(root).href;
const schema = "https://opencode.ai/config.json";

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function targetConfig() {
  const explicit = option("--config");
  if (explicit) return path.resolve(explicit);
  const base = process.env.XDG_CONFIG_HOME || path.join(homedir(), ".config");
  const directory = path.join(base, "opencode");
  const json = path.join(directory, "opencode.json");
  const jsonc = path.join(directory, "opencode.jsonc");
  if (existsSync(json)) return json;
  if (existsSync(jsonc)) return jsonc;
  return json;
}

const normalize = (value) => String(value).replace(/\/+$/, "");

function isOurs(entry) {
  if (typeof entry === "string") return normalize(entry) === normalize(source);
  return Boolean(
    entry &&
      typeof entry === "object" &&
      typeof entry.package === "string" &&
      normalize(entry.package) === normalize(source),
  );
}

function entryFor(plugins) {
  const existing = plugins.find(isOurs);
  const options =
    existing && typeof existing === "object" && existing.options && typeof existing.options === "object"
      ? existing.options
      : {};
  return { package: source, options: { server: "penpot", ...options } };
}

function refuse(reason, current) {
  console.error(`Refusing to change the global config: ${reason}`);
  if (current) console.error(`File left unchanged: ${current}`);
  console.error("Merge this entry into your global opencode.json(c) manually:");
  console.error(JSON.stringify({ plugins: [{ package: source, options: { server: "penpot" } }] }, null, 2));
  process.exit(1);
}

const mode = process.argv[2] === "uninstall" ? "uninstall" : "install";
const target = targetConfig();

let config = { $schema: schema };
let previous = null;
if (existsSync(target)) {
  previous = await readFile(target, "utf8");
  try {
    config = JSON.parse(previous);
  } catch {
    refuse("it is not plain JSON (it may contain comments or a syntax error).", target);
  }
}

if (!config || typeof config !== "object" || Array.isArray(config)) refuse("the file is not a JSON object.", target);
if (config.plugins !== undefined && !Array.isArray(config.plugins)) refuse("`plugins` is not an array.", target);

const plugins = config.plugins ?? [];
const next = mode === "install" ? (
  plugins.some(isOurs)
    ? plugins.map((entry) => (isOurs(entry) ? entryFor(plugins) : entry))
    : [...plugins, entryFor(plugins)]
) : plugins.filter((entry) => !isOurs(entry));

if (JSON.stringify(next) === JSON.stringify(plugins)) {
  console.log(
    mode === "install"
      ? `Already registered globally: ${source}`
      : `Not registered globally: ${source}`,
  );
  process.exit(0);
}

config.plugins = next;
await mkdir(path.dirname(target), { recursive: true });
if (previous !== null) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  await copyFile(target, `${target}.bak-${stamp}`);
}
await writeFile(target, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });

console.log(
  mode === "install"
    ? `Registered ${source}\n  in ${target}`
    : `Removed ${source}\n  from ${target}`,
);
console.log("Reload OpenCode with /reload. If the pane does not appear, run: opencode service restart");
console.log(`Other projects need the Penpot MCP server registered globally too (normally named "penpot").`);
