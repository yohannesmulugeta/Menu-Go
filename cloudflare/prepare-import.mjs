import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Run from the repository root. Private source exports never belong in Git.
const sourcePath=resolve('.migration-private/source-snapshot.json');
const source=JSON.parse(readFileSync(sourcePath,'utf8'));
const mapping=JSON.parse(readFileSync(resolve('.migration-private/media-map.json'),'utf8'));
const columns=JSON.parse(readFileSync(resolve('.migration-private/source-columns.json'),'utf8'));
const tables=['users','restaurants','platform_admins','restaurant_members','categories','menu_items','opening_hours','wifi_details','feedback','analytics_events','restaurant_invites','audit_logs'];
const statements=[];
for(const table of tables){
 const keys=table==='users'?['id','email','created_at','email_confirmed_at']:columns[table];
 for(const row of source[table]){
  const values=keys.map(key=>{
   let value=row[key]??null;
   if(key==='email'&&typeof value==='string')value=value.toLowerCase();
   if(typeof value==='string'&&mapping[value])value=mapping[value];
   if(key==='code_hash'&&typeof value==='string')value=value.replace(/^\\x/,'');
   if(typeof value==='boolean')value=Number(value);
   if(value!==null&&typeof value==='object')value=JSON.stringify(value);
   return value;
  });
  statements.push({sql:'INSERT INTO '+table+'('+keys.join(',')+') VALUES('+keys.map(()=>'?').join(',')+')',params:values});
 }
}
writeFileSync(resolve('.migration-private/import-batches.json'),JSON.stringify(statements));
writeFileSync(resolve('.migration-private/migration-counts.json'),JSON.stringify(Object.fromEntries(tables.map(t=>[t,source[t].length])),null,2));
console.log(JSON.stringify({tables:tables.length,statements:statements.length,media: Object.keys(mapping).length}));
