import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {testEnvironment,fixturePNG} from './check-menu-media.mjs';
import worker from '../cloudflare/platform/worker.mjs';
import {PUBLIC_ORIGIN as origin} from '../cloudflare/platform/publications/service.mjs';

const t=testEnvironment(),{db,env,manager,foreign}=t,queries=[];
const prepare=env.DB.prepare.bind(env.DB);env.DB.prepare=sql=>{queries.push(sql);return prepare(sql);};
const base='/api/restaurants/staging-demo',slug='staging-demo';
async function call(path,{method='GET',body,bytes,token=manager,headers={}}={}) {
  return worker.fetch(new Request(origin+path,{method,headers:{...(token?{Cookie:'__Host-admaki_menu='+token}:{}),...(body||bytes?{Origin:origin,'Content-Type':bytes?'image/png':'application/json','X-Menu-Request':'1'}:{}),...headers},body:bytes|| (body?JSON.stringify(body):undefined)}),env);
}
async function saved() {return (await call(base+'/config')).json();}
async function body() {const config=await saved(),head=await(await call(base+'/publication')).json();return {revision:config.revision,policy_revision:config.policy_revision,publication_revision:head.publication_revision};}
async function publish(expected=201) {const r=await call(base+'/publish',{method:'POST',body:await body()});assert.equal(r.status,expected,await r.clone().text());return r.json();}
async function patch(patch) {const s=await saved();const r=await call(base+'/config',{method:'PATCH',body:{revision:s.revision,policy_revision:s.policy_revision,...patch}});assert.equal(r.status,200,await r.clone().text());}
assert.equal((await call('/r/'+slug,{token:null})).status,404);
assert.equal((await call(base+'/publish',{method:'POST',body:await body(),token:foreign})).status,404);
assert.equal((await call(base+'/publish',{method:'POST',body:await body(),headers:{Origin:'https://other.invalid'}})).status,403);
await patch({features:{'analytics.collection':true},content_settings:{wifi:{network_name:'private-fixture',password:'private-password',public_name:false,public_password:false}}});
const stale=await body();
let result=await publish();assert.equal(result.publication_revision,1);
const snapshot=db.prepare('SELECT snapshot_json FROM restaurant_publications WHERE restaurant_id=? AND revision=1').get(slug).snapshot_json;
assert(!snapshot.includes('private-password'));assert(!snapshot.includes('private-fixture'));
assert.equal((await call(base+'/publish',{method:'POST',body:stale})).status,409);
queries.length=0;let r=await call('/r/'+slug,{token:null});assert.equal(queries.length,3,'Public HTML must use environment, coherent context and final-current checks.');assert.equal(r.status,200,await r.clone().text());let html=await r.text();
assert(!html.includes('Saved draft preview'));assert(html.includes('guestRequest'));
new Script(html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)[1]);
assert.match(r.headers.get('cache-control'),/no-store/);assert.match(r.headers.get('content-security-policy'),/nonce-/);
assert.equal((await call('/r/'+slug,{method:'HEAD',token:null})).status,200);
assert.equal(await(await call('/r/'+slug,{method:'HEAD',token:null})).text(),'');
assert.equal((await call('/r/'+slug,{method:'POST',body:{},token:null})).status,405);
assert.equal((await call('/r/'+slug+'/qrXsvg',{token:null})).status,404);
queries.length=0;r=await call('/r/'+slug+'/qr.svg',{token:null});assert.equal(r.status,200);assert.equal(queries.length,3);assert.match(await r.text(),/<svg[^>]*xmlns="http:\/\/www.w3.org\/2000\/svg"/);assert.match(r.headers.get('content-disposition'),/attachment/);
queries.length=0;assert.equal((await call('/api/public/menus/'+slug+'/feedback',{method:'POST',token:null,body:{message:'Synthetic feedback'}})).status,201);assert.equal(queries.length,4,'Feedback must retain the live write gate with one context read.');
queries.length=0;assert.equal((await call('/api/public/menus/'+slug+'/events',{method:'POST',token:null,body:{event:'menu_view'}})).status,202);assert.equal(queries.length,4,'Analytics must retain the live write gate with one context read.');
// Draft changes do not change the public snapshot.
db.prepare("UPDATE menu_items SET name='Changed draft item' WHERE id='item-a'").run();
assert(! (await(await call('/r/'+slug,{token:null})).text()).includes('Changed draft item'));
const history=db.prepare('SELECT count(*) n FROM restaurant_publications').get().n;
t.race(()=>db.prepare("UPDATE menu_items SET price=124.45 WHERE id='item-a'").run());
await publish(409);assert.equal(db.prepare('SELECT count(*) n FROM restaurant_publications').get().n,history);
// Capture-to-commit policy and session races fail before state changes.
t.race(()=>db.prepare('UPDATE platform_policy_state SET revision=revision+1').run());await publish(409);
t.race(()=>db.prepare("UPDATE auth_sessions SET revoked_at=unixepoch() WHERE user_id='manager'").run());await publish(409);
db.prepare("UPDATE auth_sessions SET revoked_at=NULL WHERE user_id='manager'").run();
// Upload, publish and serve a genuine protected image through publication refs.
r=await call(base+'/media?kind=cover',{method:'POST',bytes:fixturePNG()});assert.equal(r.status,201,await r.clone().text());const media=await r.json();
const s=await saved();r=await call(base+'/media-attachment',{method:'PATCH',body:{kind:'cover',media_id:media.id,revision:s.revision,policy_revision:s.policy_revision}});assert.equal(r.status,200);
const key=db.prepare('SELECT object_key FROM media_assets WHERE id=?').get(media.id).object_key,bytes=t.objects.get(key);
t.objects.delete(key);await publish(409);t.objects.set(key,bytes);
const beforeContent=db.prepare('SELECT content_settings_json FROM restaurant_configs WHERE restaurant_id=?').get(slug).content_settings_json;
db.prepare("UPDATE restaurant_configs SET content_settings_json=json_set(content_settings_json,'$.logo_url',?) WHERE restaurant_id=?").run(media.url,slug);await publish(409);
db.prepare('UPDATE restaurant_configs SET content_settings_json=? WHERE restaurant_id=?').run(beforeContent,slug);
db.exec("CREATE TRIGGER synthetic_publication_failure BEFORE INSERT ON media_publication_refs BEGIN SELECT RAISE(ABORT,'synthetic failure'); END;");
await publish(503);assert.equal(db.prepare('SELECT count(*) n FROM restaurant_publications').get().n,history);assert.equal(db.prepare('SELECT revision FROM restaurant_publication_heads WHERE restaurant_id=?').get(slug).revision,1);
db.exec('DROP TRIGGER synthetic_publication_failure');
result=await publish();assert.equal(result.publication_revision,2);
const publicImage='/public-media/'+slug+'/'+media.id;
queries.length=0;r=await call(publicImage,{token:null});assert.equal(r.status,200,await r.clone().text());assert.equal(queries.length,4);assert.match(r.headers.get('content-type'),/image\/png/);
assert.equal((await call(new URL(media.url).pathname,{token:null})).status,401);
assert.equal((await call('/public-media/other/'+media.id,{token:null})).status,404);
assert.equal((await call('/public-media/'+slug+'/'+crypto.randomUUID(),{token:null})).status,404);
assert.equal(db.prepare('SELECT count(*) n FROM media_publication_refs WHERE media_id=?').get(media.id).n,1);
// Current policy gates both HTML and existing image URLs, with no cache bypass.
db.prepare("UPDATE feature_policies SET allowed=0,revision=revision+1 WHERE feature_key='brand.cover'").run();db.prepare('UPDATE platform_policy_state SET revision=revision+1').run();
assert(!(await(await call('/r/'+slug,{token:null})).text()).includes('class="cover-photo"'));
assert.equal((await call(publicImage,{token:null})).status,404);
db.prepare("UPDATE feature_policies SET allowed=1,revision=revision+1 WHERE feature_key='brand.cover'").run();db.prepare('UPDATE platform_policy_state SET revision=revision+1').run();
const originalGet=t.bucket.get;
t.bucket.get=async key=>{const object=await originalGet(key);db.prepare('UPDATE platform_policy_state SET revision=revision+1').run();return object;};
assert.equal((await call(publicImage,{token:null})).status,409);t.bucket.get=originalGet;
db.prepare("UPDATE feature_policies SET allowed=0,revision=revision+1 WHERE feature_key='guest.qr_download'").run();db.prepare('UPDATE platform_policy_state SET revision=revision+1').run();
assert.equal((await call('/r/'+slug+'/qr.svg',{token:null})).status,403);
// A policy or head change during rendering must still fail at the final barrier.
const renderPrepare=env.DB.prepare.bind(env.DB);
let invalidate=null;
env.DB.prepare=sql=>{const statement=renderPrepare(sql);if(invalidate&&sql.startsWith('SELECT 1 FROM restaurants r JOIN restaurant_publication_heads')){const action=invalidate;invalidate=null;if(action==='policy')db.prepare('UPDATE platform_policy_state SET revision=revision+1').run();else db.prepare("UPDATE restaurant_publication_heads SET revision=1 WHERE restaurant_id='staging-demo'").run();}return statement;};
invalidate='policy';assert.equal((await call('/r/'+slug,{token:null})).status,409);
invalidate='head';assert.equal((await call('/r/'+slug,{token:null})).status,409);db.prepare("UPDATE restaurant_publication_heads SET revision=2 WHERE restaurant_id='staging-demo'").run();
const beforeEpoch=db.prepare('SELECT revision FROM platform_policy_state').get().revision;
db.prepare('DELETE FROM platform_policy_state').run();assert.equal((await call('/r/'+slug,{token:null})).status,503);db.prepare('INSERT INTO platform_policy_state(singleton,revision) VALUES(1,?)').run(beforeEpoch);
// Unpublish revokes the menu, image and capabilities while preserving history.
r=await call(base+'/unpublish',{method:'POST',body:{publication_revision:1}});assert.equal(r.status,409);
r=await call(base+'/unpublish',{method:'POST',body:{publication_revision:2}});assert.equal(r.status,200);
assert.equal((await call('/r/'+slug,{token:null})).status,404);assert.equal((await call(publicImage,{token:null})).status,404);
assert.equal((await call('/api/public/menus/'+slug+'/feedback',{method:'POST',token:null,body:{message:'revoked'}})).status,404);
assert.equal(db.prepare('SELECT count(*) n FROM restaurant_publications').get().n,history+1);
assert.equal(db.prepare('SELECT count(*) n FROM media_publication_refs WHERE media_id=?').get(media.id).n,1);
assert.equal((await call('/preview/'+slug)).status,200);
result=await publish();assert.equal(result.publication_revision,3);
db.prepare("UPDATE restaurants SET status='suspended' WHERE id='staging-demo'").run();await publish(409);assert.equal((await call('/r/'+slug,{token:null})).status,404);
// Retained legacy history can exist without a current publication head.
db.prepare("INSERT INTO restaurant_configs(restaurant_id,schema_version,template_id,template_version,features_json,theme_json,content_settings_json) SELECT 'other',2,'classic',2,json_extract(config_json,'$.features'),json_extract(config_json,'$.theme'),json_extract(config_json,'$.content_settings') FROM config_presets WHERE preset_id='cafe' AND version=2").run();
db.prepare("INSERT INTO restaurant_publications(restaurant_id,revision,config_revision,snapshot_json) VALUES('other',7,1,'{}')").run();
const otherConfig=await(await call('/api/restaurants/other/config',{token:foreign})).json();
r=await call('/api/restaurants/other/publish',{method:'POST',token:foreign,body:{revision:otherConfig.revision,policy_revision:otherConfig.policy_revision,publication_revision:0}});assert.equal(r.status,201,await r.clone().text());assert.equal((await r.json()).publication_revision,8);
assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
console.log('Publication checks passed: coherent immutable snapshots, tenant/CSRF/session/policy guards, atomic refs, private/public media, live revocation, QR SVG, guest capabilities and retained history.');

