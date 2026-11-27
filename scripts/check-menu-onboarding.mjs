import assert from 'node:assert/strict';
import {testEnvironment} from './check-menu-media.mjs';
import worker from '../cloudflare/platform/worker.mjs';
import {restaurantRoute} from '../cloudflare/platform/restaurants/service.mjs';

const t=testEnvironment(),{db,env,origin,owner,manager,foreign}=t;
async function request(path,{token=owner,body,method=body?'POST':'GET',headers={}}={}) {
  return worker.fetch(new Request(origin+path,{
    method,headers:{Cookie:'__Host-admaki_menu='+token,...(body?{'Content-Type':'application/json',Origin:origin,'X-Menu-Request':'1'}:{}),...headers},
    body:body?JSON.stringify(body):undefined
  }),env);
}
const icon=await request('/favicon.ico');assert.equal(icon.status,200);assert.equal(icon.headers.get('content-type'),'image/svg+xml');
assert.equal(await(await request('/favicon.ico',{method:'HEAD'})).text(),'');
const path='/api/platform/restaurants';
const body={name:'Synthetic onboarding',slug:'synthetic-onboard',preset_id:'cafe',preset_version:2,template_id:'occasion',template_version:1};
assert.equal((await request(path,{body,token:manager})).status,403);
assert.equal((await request(path,{body,headers:{Origin:'https://other.invalid'}})).status,403);
assert.equal((await request(path,{body:{...body,status:'active'}})).status,400);
assert.equal((await request(path,{body:{...body,slug:'../invalid'}})).status,400);
assert.equal((await request(path,{body:{...body,preset_version:999}})).status,400);
assert.equal((await request(path,{body:{...body,template_id:'classic',template_version:1}})).status,400);
let response=await request(path,{body});assert.equal(response.status,201,await response.clone().text());
const {restaurant}=await response.json();
assert.equal(restaurant.status,'draft');
const config=db.prepare('SELECT * FROM restaurant_configs WHERE restaurant_id=?').get(restaurant.id);
assert.equal(config.template_id,'occasion');assert.equal(config.schema_version,2);assert.equal(config.revision,1);
assert.equal(JSON.parse(config.content_settings_json).phone,'');
assert.equal(db.prepare('SELECT count(*) n FROM menu_items WHERE restaurant_id=?').get(restaurant.id).n,0);
assert.equal((await request('/api/restaurants/'+restaurant.id+'/config')).status,200);
assert.equal((await request('/preview/'+restaurant.id)).status,200);
assert.equal((await request('/preview/'+restaurant.id,{token:foreign})).status,404);
assert.equal((await request(path,{body})).status,409);
assert.equal(db.prepare("SELECT count(*) n FROM platform_audit_logs WHERE action='restaurant.created' AND target_id=?").get(restaurant.id).n,1);
// A revoked session at transaction time cannot create a tenant or a config.
t.race(()=>db.prepare('UPDATE auth_sessions SET revoked_at=unixepoch() WHERE user_id=?').run('owner'));
assert.equal((await request(path,{body:{...body,slug:'revoked-create'}})).status,409);
assert.equal(db.prepare("SELECT count(*) n FROM restaurants WHERE slug='revoked-create'").get().n,0);
db.prepare("UPDATE auth_sessions SET revoked_at=NULL WHERE user_id='owner'").run();
// A failing configuration write must roll back the restaurant and audit too.
db.exec("CREATE TRIGGER synthetic_config_failure BEFORE INSERT ON restaurant_configs WHEN (SELECT slug FROM restaurants WHERE id=NEW.restaurant_id)='atomic-fail' BEGIN SELECT RAISE(ABORT,'synthetic'); END;");
assert.equal((await request(path,{body:{...body,slug:'atomic-fail'}})).status,503);
assert.equal(db.prepare("SELECT count(*) n FROM restaurants WHERE slug='atomic-fail'").get().n,0);
db.exec('DROP TRIGGER synthetic_config_failure');
for(let index=0;index<106;index++) {
  const id='directory-'+String(index).padStart(3,'0');
  db.prepare("INSERT INTO restaurants(id,name,slug,status) VALUES(?,?,?,'draft')").run(id,id,id);
  db.prepare("INSERT INTO restaurant_members(id,restaurant_id,user_id,role) VALUES(?,?,'manager','manager')").run(id,id);
}
let seen=[];
for(let offset=0;offset!==null;) {
  response=await request('/api/restaurants?search=directory&offset='+offset,{token:manager});
  assert.equal(response.status,200,await response.clone().text());const page=await response.json();
  assert(page.restaurants.length<=50);assert.equal(page.summary.total,106);assert.equal(page.summary.draft,106);seen.push(...page.restaurants.map(r=>r.id));offset=page.next_offset;
}
assert.equal(seen.length,106);assert.equal(new Set(seen).size,106);
assert.equal((await (await request('/api/restaurants?search=directory',{token:foreign})).json()).restaurants.length,0);
assert.equal((await (await request('/api/restaurants?search=%25',{token:manager})).json()).restaurants.length,0);
assert.equal((await request('/api/restaurants?offset=-1')).status,400);
assert.equal((await request('/api/restaurants?offset=Infinity')).status,400);
assert.equal((await request('/api/platform/onboarding-options',{token:manager})).status,403);
assert.equal((await (await request('/api/platform/onboarding-options')).json()).templates.length,5);
const legacy=await request('/api/platform/restaurants');assert(Array.isArray(await legacy.json()));
// Dashboard filters do not delete fixtures, change access, or hide production data.
for(const [id,user,status] of [['fixture-own','manager','suspended'],['fixture-foreign','foreign','suspended'],['filter-active','manager','active']]){
  db.prepare('INSERT INTO restaurants(id,name,slug,status) VALUES(?,?,?,?)').run(id,id,id==='filter-active'?id:'editcheck-'+id,status);
  db.prepare("INSERT INTO restaurant_members(id,restaurant_id,user_id,role) VALUES(?,?,?,'manager')").run(id,id,user);
}
let filtered=await(await request('/api/restaurants?search=editcheck-&include_tests=0',{token:manager})).json();
assert.deepEqual(filtered.summary,{total:0,active:0,draft:0,suspended:0});
filtered=await(await request('/api/restaurants?search=editcheck-&include_tests=1',{token:manager})).json();
assert.equal(filtered.summary.total,1);assert.equal(filtered.restaurants[0].id,'fixture-own');
assert.equal(db.prepare("SELECT count(*) n FROM restaurants WHERE slug GLOB 'editcheck-*'").get().n,2);
filtered=await(await request('/api/restaurants?status=active',{token:manager})).json();
assert.equal(filtered.summary.active,1);assert.deepEqual(filtered.restaurants.map(r=>r.id),['filter-active']);
assert.equal((await request('/api/restaurants?status=invalid')).status,400);
assert.equal((await request('/api/restaurants?include_tests=false')).status,400);
const productionRead=await restaurantRoute(new Request(origin+'/api/restaurants?search=editcheck-&include_tests=0',{headers:{Cookie:'__Host-admaki_menu='+manager}}),{...env,ENVIRONMENT:'admaki-menu-platform-production'});
filtered=await productionRead.json();assert.equal(filtered.summary.total,1);assert.equal(filtered.restaurants[0].id,'fixture-own');
assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
console.log('Onboarding checks passed: paginated membership-scoped directory beyond 100, literal search, draft preset creation, duplicate prevention, transactional rollback, live-session guard, CSRF and existing API compatibility.');

