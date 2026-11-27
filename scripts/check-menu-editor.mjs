import assert from 'node:assert/strict';
import {testEnvironment} from './check-menu-media.mjs';
import worker from '../cloudflare/platform/worker.mjs';
const t=testEnvironment(),{db,env,origin,manager,foreign}=t,base='/api/restaurants/staging-demo/menu';
async function call(path,{body,method=body?'POST':'GET',token=manager,headers={}}={}) {
  return worker.fetch(new Request(origin+path,{method,headers:{...(token?{Cookie:'__Host-admaki_menu='+token}:{}),...(body?{Origin:origin,'Content-Type':'application/json','X-Menu-Request':'1'}:{}),...headers},body:body?JSON.stringify(body):undefined}),env);
}
async function meta(){const r=await call(base+'/categories');assert.equal(r.status,200);const m=await r.json();return {revision:m.revision,policy_revision:m.policy_revision};}
async function save(path,body,method='POST',status=201) {const r=await call(base+path,{method,body:{...await meta(),...body}});assert.equal(r.status,status,await r.clone().text());return r.json();}
assert.equal((await call(base+'/items',{token:null})).status,401);
assert.equal((await call(base+'/items',{token:foreign})).status,404);
const category=await save('/categories',{name:'Synthetic category',sort_order:-2,is_active:true});
const original={name:'Synthetic item',description:'Synthetic description',price:123.45,category_id:category.id,is_available:true,is_popular:false,sort_order:0};
const item=await save('/items',original);
let detail=await(await call(base+'/items/'+item.id)).json();assert.equal(detail.item.version,1);
const stale={revision:detail.revision,policy_revision:detail.policy_revision,...original,version:1};
await save('/items/'+item.id,{...original,price:234.56,version:1},'PATCH',200);
assert.equal((await call(base+'/items/'+item.id,{method:'PATCH',body:stale})).status,409);
await save('/items/'+item.id,{...original,version:1},'PATCH',409);
await save('/items',{...original,price:-1},'POST',400);
await save('/items',{...original,price:1.111},'POST',400);
await save('/items',{...original,image_url:'https://forged.invalid/item.png'},'POST',400);
db.prepare("INSERT INTO categories(id,restaurant_id,name) VALUES('foreign-category','other','Foreign category')").run();
await save('/items',{...original,category_id:'foreign-category'},'POST',400);
assert.equal((await call(base+'/items/other-item')).status,404);
assert.equal((await call(base+'/categories',{body:{...await meta(),name:'x',sort_order:0,is_active:true},headers:{Origin:'https://other.invalid'}})).status,403);
const before=await meta(),count=db.prepare('SELECT count(*) n FROM menu_items').get().n;
db.exec("CREATE TRIGGER synthetic_menu_failure BEFORE INSERT ON menu_items WHEN NEW.name='Atomic failure' BEGIN SELECT RAISE(ABORT,'synthetic'); END;");
await save('/items',{...original,name:'Atomic failure'},'POST',503);assert.deepEqual(await meta(),before);assert.equal(db.prepare('SELECT count(*) n FROM menu_items').get().n,count);db.exec('DROP TRIGGER synthetic_menu_failure');
t.race(()=>db.prepare("DELETE FROM restaurant_members WHERE user_id='manager'").run());await save('/items',{...original,name:'Revoked membership'},'POST',409);
db.prepare("INSERT INTO restaurant_members(id,restaurant_id,user_id,role) VALUES('restored-editor','staging-demo','manager','manager')").run();
t.race(()=>db.prepare('UPDATE platform_policy_state SET revision=revision+1').run());await save('/categories',{name:'Policy race',sort_order:0,is_active:true},'POST',409);
const variant=await save('/items/'+item.id+'/variants',{label:'Large',price_minor:25000,sort_order:0,is_active:true});
await save('/items/'+item.id+'/variants/'+variant.id,{label:'Large',price_minor:25000,sort_order:1,is_active:false},'PATCH',200);
await save('/items/'+item.id+'/variants',{label:'Negative',price_minor:-1,sort_order:0,is_active:true},'POST',400);
await save('/items/'+item.id+'/translations/am',{name:'Synthetic translated item',description:'Translated description'},'PATCH',200);
await save('/items/'+item.id+'/translations/en',{name:'English',description:''},'PATCH',400);
await save('/hours/1',{opens_at:'08:00',closes_at:'23:00',is_closed:false},'PATCH',200);
await save('/hours/1',{opens_at:'08:00',closes_at:'23:00',is_closed:true},'PATCH',200);
const hours=await(await call(base+'/hours')).json();assert.equal(hours.hours[0].opens_at,'08:00');assert.equal(hours.hours[0].is_closed,1);
await save('/hours/7',{opens_at:'08:00',closes_at:'23:00',is_closed:false},'PATCH',400);
await save('/hours/2',{opens_at:'25:00',closes_at:'23:00',is_closed:false},'PATCH',400);
db.prepare("UPDATE feature_policies SET manager_editable=0 WHERE feature_key='menu.descriptions'").run();db.prepare('UPDATE platform_policy_state SET revision=revision+1').run();
detail=await(await call(base+'/items/'+item.id)).json();
await save('/items/'+item.id,{...original,description:'Locked change',version:detail.item.version},'PATCH',403);
await save('/items/'+item.id,{...original,price:234.56,version:detail.item.version},'PATCH',200);
db.prepare("UPDATE feature_policies SET manager_editable=1 WHERE feature_key='menu.descriptions'").run();db.prepare('UPDATE platform_policy_state SET revision=revision+1').run();
// A former admin's membership cannot preserve the stale admin policy bypass.
db.prepare("INSERT INTO platform_admins(user_id) VALUES('foreign')").run();
db.prepare("INSERT INTO restaurant_members(id,restaurant_id,user_id,role) VALUES('owner-editor-membership','staging-demo','owner','manager')").run();
db.prepare("UPDATE feature_policies SET manager_editable=0 WHERE feature_key='menu.categories'").run();db.prepare('UPDATE platform_policy_state SET revision=revision+1').run();
t.race(()=>db.prepare("DELETE FROM platform_admins WHERE user_id='owner'").run());
const revokedRole=await call(base+'/categories',{token:t.owner,body:{...await meta(),name:'Stale admin bypass',sort_order:0,is_active:true}});assert.equal(revokedRole.status,409);
db.prepare("INSERT INTO platform_admins(user_id) VALUES('owner')").run();db.prepare("DELETE FROM platform_admins WHERE user_id='foreign'").run();
db.prepare("UPDATE feature_policies SET manager_editable=1 WHERE feature_key='menu.categories'").run();db.prepare('UPDATE platform_policy_state SET revision=revision+1').run();
// Publish, then edit content. The old publication remains unchanged until the next publish.
async function publish(){const c=await(await call('/api/restaurants/staging-demo/config')).json(),p=await(await call('/api/restaurants/staging-demo/publication')).json();const r=await call('/api/restaurants/staging-demo/publish',{body:{revision:c.revision,policy_revision:c.policy_revision,publication_revision:p.publication_revision}});assert.equal(r.status,201,await r.clone().text());}
await publish();assert((await(await call('/r/staging-demo',{token:null})).text()).includes('Synthetic item'));
detail=await(await call(base+'/items/'+item.id)).json();await save('/items/'+item.id,{...original,name:'Edited draft item',price:234.56,version:detail.item.version},'PATCH',200);
assert(!(await(await call('/r/staging-demo',{token:null})).text()).includes('Edited draft item'));
await publish();assert((await(await call('/r/staging-demo',{token:null})).text()).includes('Edited draft item'));
await save('/categories/'+category.id,{name:'Synthetic category',sort_order:-2,is_active:false},'PATCH',200);
const preview=await(await call('/preview/staging-demo')).text();assert(!preview.includes('Edited draft item'));
assert((await(await call('/r/staging-demo',{token:null})).text()).includes('Edited draft item'));
for(let i=0;i<106;i++){const id='paged-editor-'+String(i).padStart(3,'0');db.prepare('INSERT INTO categories(id,restaurant_id,name) VALUES(?,?,?)').run(id,'staging-demo',id);db.prepare('INSERT INTO menu_items(id,restaurant_id,name,price) VALUES(?,?,?,1)').run(id,'staging-demo',id);}
for(const kind of ['categories','items']){let ids=[];for(let offset=0;offset!==null;){const r=await(await call(base+'/'+kind+'?search=paged-editor&offset='+offset)).json();ids.push(...r[kind].map(x=>x.id));offset=r.next_offset;}assert.equal(ids.length,106);assert.equal(new Set(ids).size,106);}
assert.equal((await(await call(base+'/items?search=%25')).json()).items.length,0);
assert.equal((await call(base+'/items?offset=-1')).status,400);
assert.equal((await call(base+'/items/'+item.id,{method:'DELETE',body:await meta()})).status,405);
assert.equal(db.prepare('SELECT count(*) n FROM menu_items WHERE id=?').get(item.id).n,1);
assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
console.log('Menu editor checks passed: owned draft creation and updates, shared revisions, item versions, rollback, policy/membership races, image reference protection, variants, translations, hours, publishing isolation and pagination beyond 100.');

