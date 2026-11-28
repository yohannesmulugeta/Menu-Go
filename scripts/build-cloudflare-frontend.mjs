import "./prepare-cloudflare-frontend.mjs";
import { build } from "vite";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
const root=fileURLToPath(new URL("../",import.meta.url));
const check=spawnSync(process.execPath,[join(root,"node_modules/typescript/bin/tsc"),"--project",join(root,"cloudflare/frontend/tsconfig.app.json")],{stdio:"inherit"});
if(check.status!==0)process.exit(check.status??1);
await build({root:join(root,"cloudflare/frontend"),configFile:join(root,"cloudflare/frontend/vite.config.ts"),build:{outDir:join(root,"dist-cloudflare/frontend"),emptyOutDir:true}});
