import assert from "node:assert/strict";
import { readFileSync,readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";
import generateModule from "@babel/generator";
import { createHash } from "node:crypto";
const traverse=traverseModule.default??traverseModule;
const generate=generateModule.default??generateModule;
const root=fileURLToPath(new URL("../",import.meta.url));
const built=join(root,"dist-cloudflare/frontend/assets");
const frozen=join(root,"cloudflare/baseline/core/assets/assets");
function normalized(code){
  const ast=parse(code,{sourceType:"module"});
  const bindings=new Set();
  traverse(ast,{Scopable(path){for(const binding of Object.values(path.scope.bindings))bindings.add(binding);}});
  const names=new Map([...bindings].sort((a,b)=>a.identifier.start-b.identifier.start).map((binding,i)=>[binding,"__v"+i]));
  traverse(ast,{Identifier(path){if(path.isReferencedIdentifier()||path.isBindingIdentifier()){const name=names.get(path.scope.getBinding(path.node.name));if(name)path.node.name=name;}}});
  return generate(ast,{compact:true,comments:false}).code;
}
const js=readdirSync(built).find(n=>n.endsWith(".js"));
const css=readdirSync(built).find(n=>n.endsWith(".css"));
const generated=normalized(readFileSync(join(built,js),"utf8"));
const production=normalized(readFileSync(join(frozen,"index-DXCKocGm.js"),"utf8"));
if(generated!==production){let i=0;while(generated[i]===production[i]&&i<Math.min(generated.length,production.length))i++;throw Error("Frontend mismatch at "+i+"; built="+generated.slice(Math.max(0,i-100),i+350)+"; frozen="+production.slice(Math.max(0,i-100),i+350));}
assert.deepEqual(readFileSync(join(built,css)),readFileSync(join(frozen,"index-C3rCf-kA.css")),"Stylesheet differs.");
console.log("Editable frontend verified: binding-normalized JS equivalence and byte-exact stylesheet.");
console.log("Canonical JS SHA-256: "+createHash("sha256").update(generated).digest("hex"));
