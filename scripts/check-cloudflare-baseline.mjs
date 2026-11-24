import { readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(readFileSync(join(root, "cloudflare/inventory/production.json"), "utf8"));
let checked = 0;
function verify(path, expected) {
  const bytes = readFileSync(path);
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== expected.sha256 || bytes.length !== expected.bytes) throw Error("Recovered bytes changed: " + path);
  checked++;
}
for (const worker of manifest.workers) {
  const folder = worker.name === "admaki-menu" ? "core" : "router";
  for (const module of worker.modules) {
    const path = join(root, "cloudflare/baseline", folder, module.name);
    verify(path, module);
    const result = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
    if (result.status !== 0) throw Error(result.stderr);
  }
}
for (const asset of manifest.assets) {
  if (!asset.path.startsWith("/") || asset.path.includes("..")) throw Error("Unsafe asset path");
  verify(join(root, "cloudflare/baseline/core/assets", asset.path), asset);
}
const html = readFileSync(join(root, "cloudflare/baseline/core/assets/index.html"), "utf8");
for (const match of html.matchAll(/(?:src|href)="(\/[^"#?]+)(?:[^"]*)"/g)) {
  if (!statSync(join(root, "cloudflare/baseline/core/assets", match[1])).isFile()) throw Error("Missing entrypoint dependency");
}
const css = readFileSync(join(root, "cloudflare/baseline/core/assets/assets/index-C3rCf-kA.css"), "utf8");
for (const match of css.matchAll(/url\((\/[^)]+)\)/g)) {
  if (!statSync(join(root, "cloudflare/baseline/core/assets", match[1])).isFile()) throw Error("Missing font dependency");
}
function sourcesUnder(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourcesUnder(path) : /\.(?:js|json|sql)$/.test(path) ? [path] : [];
  });
}
for (const path of sourcesUnder(join(root, "cloudflare"))) {
  const content = readFileSync(path, "utf8");
  if (content.includes("--- TRUNCATED ---")) throw Error("Truncated source: " + path);
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|Occasion-667ea/.test(content)) throw Error("Credential material detected: " + path);
}
console.log("Verified " + checked + " exact live modules/assets; syntax, dependencies, truncation and credential checks passed.");
if (process.argv.includes("--test")) {
  const directory = resolve(root, "cloudflare/baseline/router/test");
  const tests = readdirSync(directory).filter(n => n.endsWith(".test.js")).map(n => join(directory, n));
  const result = spawnSync(process.execPath, ["--test", ...tests], { stdio: "inherit" });
  process.exit(result.status ?? 1);
}
