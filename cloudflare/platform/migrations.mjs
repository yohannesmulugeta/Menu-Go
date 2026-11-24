import { createHash } from "node:crypto";
import { readFileSync,readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
export const STAGING_NAME="admaki-menu-platform-staging";
export function migrationFiles(){
  const dir=fileURLToPath(new URL("./migrations/",import.meta.url));
  return readdirSync(dir).filter(n=>/^\d{4}_[a-z_]+\.sql$/.test(n)).sort().map(name=>{
    const sql=readFileSync(join(dir,name),"utf8");return {name,sql,sha256:createHash("sha256").update(sql).digest("hex")};
  });
}
export function applyLocalMigrations(db,files=migrationFiles()){
  const marker=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='platform_environment'").get();
  if(marker&&db.prepare("SELECT name FROM platform_environment WHERE singleton=1").get()?.name!==STAGING_NAME)
    throw Error("Refusing another environment.");
  const tracked=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'").get();
  if(!tracked&&db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get().n)
    throw Error("Refusing an untracked non-empty database.");
  db.exec("PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS schema_migrations(name TEXT PRIMARY KEY,sha256 TEXT NOT NULL,applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  let applied=0;
  for(const file of files){
    const prior=db.prepare("SELECT sha256 FROM schema_migrations WHERE name=?").get(file.name);
    if(prior){if(prior.sha256!==file.sha256)throw Error("Applied migration checksum changed: "+file.name);continue;}
    db.exec("BEGIN IMMEDIATE");
    try{db.exec(file.sql);db.prepare("INSERT INTO schema_migrations(name,sha256) VALUES(?,?)").run(file.name,file.sha256);db.exec("COMMIT");applied++;}
    catch(error){db.exec("ROLLBACK");throw error;}
  }
  return {applied,total:files.length};
}
