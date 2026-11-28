import { cpSync,mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
const root=fileURLToPath(new URL("../",import.meta.url));
const source=join(root,"cloudflare/baseline/core/assets");
const target=join(root,"cloudflare/frontend/public");
mkdirSync(target,{recursive:true});
for(const item of ["fonts","brand","migrated-media","favicon.svg"])cpSync(join(source,item),join(target,item),{recursive:true});
cpSync(join(root,"cloudflare/frontend/static/fonts/fonts.css"),join(target,"fonts/fonts.css"));
