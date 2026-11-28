// Offline preparation only. Reads a private live snapshot; emits a private plan.
// Never deploys, writes remote data, logs passwords or changes staging migrations.
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {migrationFiles} from '../cloudflare/platform/migrations.mjs';
import {DEFAULT_CONTENT,DEFAULT_THEME,DEFAULT_FEATURES} from '../cloudflare/platform/config/registry.mjs';
import {validateConfig,safeURL} from '../cloudflare/platform/config/validation.mjs';
import {hashPassword,temporaryPassword} from '../cloudflare/platform/auth/passwords.mjs';
import {ownerPlan} from '../cloudflare/platform/auth/operator.mjs';
import {draftStateSQL,draftConfig,snapshotData} from '../cloudflare/platform/publications/snapshot.mjs';
import {capabilityManifest,resolveFeatures} from '../cloudflare/platform/config/resolution.mjs';
import {policyFromRows} from '../cloudflare/platform/config/service.mjs';
const [snapshotPath,planPath,secretPath]=process.argv.slice(2);assert(snapshotPath&&planPath&&secretPath);
const source=JSON.parse(readFileSync(snapshotPath,'utf8'));assert.equal(source.database_id,'75d00eeb-0348-4b97-a4e0-d51116466d00');
const db=new DatabaseSync(':memory:'),queries=[];db.exec('PRAGMA foreign_keys=ON');
function sql(text,params=[]){queries.push({sql:text,params});if(params.length)return db.prepare(text).run(...params);db.exec(text);}
for(const t of source.schema.filter(t=>t.type==='table'))sql(t.sql);
const pending=new Set(Object.keys(source.tables)),ordered=[];
while(pending.size){let moved=false;for(const name of pending){const refs=db.prepare('PRAGMA foreign_key_list('+name+')').all().map(v=>v.table).filter(n=>n!==name);if(refs.every(n=>!pending.has(n))){ordered.push(name);pending.delete(name);moved=true;}}assert(moved,'Cyclic source schema requires an explicit import strategy.');}
for(const name of ordered)for(const row of source.tables[name]){const keys=Object.keys(row);sql('INSERT INTO '+name+'('+keys.join(',')+') VALUES('+keys.map(()=>'?').join(',')+')',keys.map(k=>row[k]));}
for(const t of source.schema.filter(t=>t.type!=='table'))sql(t.sql);
sql('CREATE TABLE schema_migrations(name TEXT PRIMARY KEY,sha256 TEXT NOT NULL,applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
const sha=t=>createHash('sha256').update(t).digest('hex');
sql('INSERT INTO schema_migrations(name,sha256) VALUES(?,?)',['production_0000_legacy_snapshot',sha(JSON.stringify(source))]);
for(const m of migrationFiles().filter(m=>!['0001_recovered_baseline.sql','0003_staging_fixtures.sql'].includes(m.name))){const text=m.name==='0002_shared_platform.sql'?m.sql.replaceAll('admaki-menu-platform-staging','admaki-menu-platform-production'):m.sql;sql(text);sql('INSERT INTO schema_migrations(name,sha256) VALUES(?,?)',[m.name,sha(text)]);}
assert.equal(db.prepare('SELECT name FROM platform_environment').get().name,'admaki-menu-platform-production');
const origin='https://app.admakidigital.com',absolute=value=>value?new URL(value,origin).href:'';
const settings={
 'abol-coffee':{template:'abol',theme:{font:'serif'},pricing:{mode:'custom',text:'All prices include VAT & service charge.'}},
 'mokodo-pizza':{template:'mokodo',theme:{},pricing:{mode:'custom',text:'15% VAT and 5% service charge are added to the listed prices. Takeaway box: 130 ETB each. Mixed toppings: 50 ETB extra, added to the price of the higher-priced dish.'}},
 'occasion':{template:'occasion',theme:{background:'#ffffff',surface:'#ffffff'},pricing:{mode:'custom',text:'Prices exclude 15% VAT and 3% service charge.'}},
 'sheba-coffee':{template:'sheba',theme:{font:'serif'},pricing:{mode:'custom',text:''}}
};
const imported=[];
for(const r of source.tables.restaurants){
 const layout=settings[r.slug],content=structuredClone(DEFAULT_CONTENT);
 for(const key of Object.keys(content).filter(k=>k.endsWith('_url'))){const raw=key==='cover_url'?r.cover_image_url:r[key];content[key]=raw?absolute(raw):'';if(content[key]&&!safeURL(content[key],key==='google_maps_url'?'directions':key==='google_review_url'?'review':key.replace('_url','')))throw Error('Review unsupported existing link for '+r.slug+': '+key);}
 content.phone=r.phone||'';content.story=r.slug==='mokodo-pizza'?r.description||'':'';content.pricing={...content.pricing,...layout?.pricing};
 const config=validateConfig({schema_version:2,template_id:layout?.template||'classic',template_version:layout?1:2,features:{...DEFAULT_FEATURES,'guest.hours':false,'menu.item_images':r.slug!=='occasion','analytics.collection':false},theme:{...DEFAULT_THEME,...layout?.theme},content_settings:content});
 sql('UPDATE restaurant_configs SET schema_version=2,template_id=?,template_version=?,features_json=?,theme_json=?,content_settings_json=? WHERE restaurant_id=?',[config.template_id,config.template_version,JSON.stringify(config.features),JSON.stringify(config.theme),JSON.stringify(config.content_settings),r.id]);
 for(const item of source.tables.menu_items.filter(i=>i.restaurant_id===r.id&&i.image_url))sql('UPDATE menu_items SET image_url=? WHERE id=?',[absolute(item.image_url),item.id]);
 const counts={slug:r.slug,categories:db.prepare('SELECT count(*) n FROM categories WHERE restaurant_id=? AND deleted_at IS NULL').get(r.id).n,items:db.prepare('SELECT count(*) n FROM menu_items WHERE restaurant_id=? AND deleted_at IS NULL').get(r.id).n};
 if(r.status==='active'&&counts.items){const state=JSON.parse(db.prepare('SELECT '+draftStateSQL+' state FROM restaurants r WHERE r.id=?').get(r.id).state),cfg=draftConfig(state.config),data=snapshotData(state),pol=policyFromRows(db.prepare('SELECT f.*,s.revision policy_revision FROM feature_policies f CROSS JOIN platform_policy_state s WHERE s.singleton=1').all()),supported=JSON.parse(db.prepare('SELECT supported_features_json FROM template_releases WHERE template_id=? AND version=?').get(cfg.template_id,cfg.template_version).supported_features_json);const snapshot={version:1,restaurant:state.restaurant,config:cfg,data,capabilities:capabilityManifest(cfg,resolveFeatures(cfg,pol.byKey,supported,data))};sql('INSERT INTO restaurant_publications(restaurant_id,revision,config_revision,snapshot_json) VALUES(?,1,?,?)',[r.id,state.config.revision,JSON.stringify(snapshot)]);sql('INSERT INTO restaurant_publication_heads(restaurant_id,revision) VALUES(?,1)',[r.id]);}
 imported.push(counts);
}
const credentials=[];const expiresAt=Math.floor(Date.now()/1000)+86400;
const owner=source.tables.platform_admins[0];assert.equal(source.tables.platform_admins.length,1);const ownerPass=temporaryPassword();for(const q of ownerPlan({mode:'recover',userId:owner.user_id,username:'admin',credential:hashPassword(ownerPass),requestId:randomUUID(),expiresAt,environment:'admaki-menu-platform-production'}))sql(q.sql,q.params);credentials.push({role:'super_admin',username:'admin',temporary_password:ownerPass,user_id:owner.user_id});
for(const [slug,username]of [['abol-coffee','abol'],['mokodo-pizza','mokodo'],['occasion','occasion'],['sheba-coffee','sheba']]){const r=source.tables.restaurants.find(r=>r.slug===slug);assert(r);const member=source.tables.restaurant_members.find(m=>m.restaurant_id===r.id);const userId=member?.user_id||randomUUID();if(!member){sql('INSERT INTO users(id,email) VALUES(?,?)',[userId,userId+'@login.admaki.invalid']);sql("INSERT INTO restaurant_members(id,restaurant_id,user_id,role) VALUES(?,?,?,'manager')",[randomUUID(),r.id,userId]);}const password=temporaryPassword(),h=hashPassword(password);sql('INSERT INTO login_credentials(user_id,username,hash_format,password_hash,parameters_json,must_change_password,temporary_expires_at) VALUES(?,?,?,?,?,1,?)',[userId,username,h.hash_format,h.password_hash,h.parameters_json,expiresAt]);sql('DELETE FROM manager_sessions WHERE user_id=?',[userId]);credentials.push({role:'manager',slug,restaurant_id:r.id,user_id:userId,username,temporary_password:password});}
sql('INSERT INTO schema_migrations(name,sha256) VALUES(?,?)',['production_0007_initial_configuration',sha(JSON.stringify(imported))]);
assert.equal(db.prepare('SELECT count(*) n FROM restaurants').get().n,source.tables.restaurants.length);assert.equal(db.prepare('SELECT count(*) n FROM menu_items').get().n,source.tables.menu_items.length);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal(db.prepare('SELECT count(*) n FROM auth_sessions').get().n,0);
for(const item of source.tables.menu_items){const current=db.prepare('SELECT price,name FROM menu_items WHERE id=?').get(item.id);assert.equal(current.price,item.price);assert.equal(current.name,item.name);}
writeFileSync(planPath,JSON.stringify({database_id:'7da5fc86-a792-4410-9773-6dfa72e1b8e3',environment:'admaki-menu-platform-production',captured_utc:source.captured_utc,queries,summary:imported},null,2)+'\n',{mode:0o600});writeFileSync(secretPath,JSON.stringify({expires_at:expiresAt,credentials},null,2)+'\n',{mode:0o600});console.log(JSON.stringify({prepared:true,statements:queries.length,menus:imported,owner_id_preserved:true,prices_names_preserved:source.tables.menu_items.length,foreign_keys_valid:true}));
