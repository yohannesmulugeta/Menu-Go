import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function filesUnder(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

const sourceFiles = filesUnder(join(root, "src")).filter((path) => /\.(ts|tsx)$/.test(path));
const source = sourceFiles.map((path) => readFileSync(path, "utf8")).join("\n");
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const workflow = readFileSync(join(root, ".github/workflows/pages.yml"), "utf8");
const viteConfig = readFileSync(join(root, "vite.config.ts"), "utf8");
const migrations = readdirSync(join(root, "supabase/migrations")).filter((name) => name.endsWith(".sql"));

assert(!/bootstrap_(platform_admin|abol_manager)/.test(source), "Temporary account bootstrap code remains in src.");
assert(!/yohannesmulugeta084/.test(source), "A personal bootstrap email remains in src.");
assert(!/service[_-]?role/i.test(source), "A service-role reference exists in browser source.");
assert(source.includes('/r/abol-coffee'), "Abol Coffee is not the production default route.");
assert(viteConfig.includes('base: "/Menu-Go/"'), "GitHub Pages base path is incorrect.");
assert(workflow.includes("npm ci"), "Deployment does not use reproducible npm ci installs.");
assert(workflow.includes("npm run check"), "Deployment does not run the production checks.");
assert(migrations.length >= 15, "Supabase migration history is incomplete.");
assert(migrations.some((name) => name.endsWith("_production_hardening.sql")), "Production migration is missing.");

for (const group of ["dependencies", "devDependencies"]) {
  for (const [name, version] of Object.entries(packageJson[group] ?? {})) {
    assert(!/^[~^*]|\bx\b/i.test(version), `${group}.${name} is not pinned: ${version}`);
  }
}

if (failures.length) {
  console.error("Production checks failed:\n" + failures.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log(`Production checks passed (${sourceFiles.length} source files, ${migrations.length} migrations).`);
console.log(`Checked from ${relative(process.cwd(), root) || "."}.`);
