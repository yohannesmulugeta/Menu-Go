import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from 'jose';
import { createApp } from '../cloudflare/worker.mjs';

function database(){
 const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../cloudflare/schema.sql',import.meta.url),'utf8'));
 sql.exec(`INSERT INTO users(id,email) VALUES('owner','owner@example.test'),('manager','manager@example.test'),('disabled','disabled@example.test');
 UPDATE users SET disabled=1 WHERE id='disabled';
 INSERT INTO platform_admins(user_id) VALUES('owner');
 INSERT INTO restaurants(id,name,slug,status) VALUES('r-a','Restaurant A','restaurant-a','active'),('r-b','Restaurant B','restaurant-b','active'),('r-d','Draft','draft','draft');
 INSERT INTO restaurant_members(id,user_id,restaurant_id,role) VALUES('m-a','manager','r-a','manager');
 INSERT INTO categories(id,restaurant_id,name) VALUES('c-a','r-a','Drinks'),('c-b','r-b','Private category');
 INSERT INTO menu_items(id,restaurant_id,category_id,name,price) VALUES('i-a','r-a','c-a','Coffee',100),('i-b','r-b','c-b','Tea',50);`);
 function prepare(query,params=[]){return {bind(...values){return prepare(query,values);},async first(){return sql.prepare(query).get(...params)||null;},async all(){return {results:sql.prepare(query).all(...params)};},async run(){return {meta:{changes:Number(sql.prepare(query).run(...params).changes)}};},query,params};}
 return {sql,DB:{prepare,async batch(statements){sql.exec('BEGIN');try{const results=statements.map(({query,params})=>/^\s*(select|with|pragma)/i.test(query)?{results:sql.prepare(query).all(...params),meta:{changes:0}}:{results:[],meta:{changes:Number(sql.prepare(query).run(...params).changes)}});sql.exec('COMMIT');return results;}catch(error){sql.exec('ROLLBACK');throw error;}}}};
}
test('Cloudflare-native menu and tenant permissions',async t=>{
 const {publicKey,privateKey}=await generateKeyPair('RS256'),jwk=await exportJWK(publicKey);jwk.kid='test-key';jwk.alg='RS256';
 const app=createApp({keyResolver:createLocalJWKSet({keys:[jwk]})}),db=database();t.after(()=>db.sql.close());
 const issuer='https://example.cloudflareaccess.com',aud='menu-go-test';
 const env={DB:db.DB,ACCESS_ISSUER:issuer,ACCESS_AUD:aud};
 async function token(email,options={}){return new SignJWT({email,type:'app',...options.claims}).setProtectedHeader({alg:'RS256',kid:'test-key'}).setIssuer(options.issuer||issuer).setAudience(options.audience||aud).setSubject(email).setIssuedAt().setExpirationTime(options.expiry||'1h').sign(privateKey);}
 const owner=await token('owner@example.test'),manager=await token('manager@example.test'),unknown=await token('unknown@example.test');
 const call=(path,options={})=>app.fetch(new Request('https://menu.test'+path,{method:options.method||'GET',headers:{...(options.token?{Cookie:'CF_Authorization='+options.token}:{}),'CF-Connecting-IP':'192.0.2.1','X-Menu-Request':'1',Origin:options.origin||'https://menu.test',...(options.data?{'Content-Type':'application/json'}:{}),...options.headers},body:options.data?JSON.stringify(options.data):options.raw}),env);
 const a='/api/admin/restaurants/r-a',b='/api/admin/restaurants/r-b';
 await t.test('public menu and hours do not require login; drafts are hidden',async()=>{
  const response=await call('/api/restaurants/restaurant-a');assert.equal(response.status,200);const data=await response.json();assert.equal(data.items[0].name,'Coffee');assert.equal(data.restaurant.name,'Restaurant A');assert.equal((await call('/api/restaurants/draft')).status,404);
 });
 await t.test('unsigned, wrong-audience, wrong-issuer and expired identities are rejected',async()=>{
  const expired=await token('owner@example.test',{expiry:Math.floor(Date.now()/1000)-60});
  for(const value of ['forged',await token('owner@example.test',{audience:'other'}),await token('owner@example.test',{issuer:'https://attacker.test'}),expired])assert.equal((await call(a+'/items',{token:value})).status,401);
  assert.equal((await call(a+'/items',{headers:{'Cf-Access-Authenticated-User-Email':'owner@example.test'}})).status,401);
 });
 await t.test('verified email maps to migrated role; disabled users are blocked',async()=>{
  const session=await(await call('/api/session',{token:owner})).json();assert.equal(session.user.id,'owner');assert.equal(session.platform_admin,true);
  assert.equal((await call(a+'/items',{token:await token('disabled@example.test')})).status,403);
 });
 await t.test('manager has only assigned restaurant access',async()=>{
  assert.equal((await call(a+'/items',{token:manager})).status,200);
  assert.equal((await call(b+'/items',{token:manager})).status,403);
  assert.equal((await call(a+'/items',{token:unknown})).status,403);
  assert.equal((await call('/api/admin/restaurants',{token:manager})).status,403);
 });
 await t.test('CSRF and cross-tenant record IDs are rejected',async()=>{
  assert.equal((await call(a+'/items/i-a',{method:'DELETE',token:manager,origin:'https://attacker.test'})).status,403);
  assert.equal((await call(a+'/items/i-b',{method:'DELETE',token:manager})).status,404);
 });
 const payload={name:'Coffee',description:'Fresh',price:120.5,category_id:'c-a',image_url:null,is_available:true,is_popular:true,version:1};
 await t.test('invalid prices, foreign categories, unsafe URLs and boolean strings are rejected',async()=>{
  for(const changes of [{price:-1},{price:1.234},{category_id:'c-b'},{image_url:'javascript:alert(1)'},{is_available:'false'}])assert.equal((await call(a+'/items/i-a',{method:'PUT',token:manager,data:{...payload,...changes}})).status,400);
 });
 await t.test('price edits persist with audit history and reject stale versions',async()=>{
  assert.equal((await call(a+'/items/i-a',{method:'PUT',token:manager,data:payload})).status,200);
  assert.equal((await(await call('/api/restaurants/restaurant-a')).json()).items[0].price,120.5);
  assert.equal((await call(a+'/items/i-a',{method:'PUT',token:manager,data:payload})).status,409);
  assert.equal(db.sql.prepare('SELECT count(*) n FROM audit_logs').get().n,1);
 });
 await t.test('creating menu items works and deletion is recoverable',async()=>{
  const response=await call(a+'/items',{method:'POST',token:manager,data:{...payload,name:'New coffee'}});assert.equal(response.status,201);const item=await response.json();
  assert.equal((await call(a+'/items/'+item.id,{method:'DELETE',token:manager})).status,200);
  assert.ok(db.sql.prepare('SELECT deleted_at FROM menu_items WHERE id=?').get(item.id).deleted_at);
 });
 await t.test('unavailable items and hidden categories do not appear publicly',async()=>{
  assert.equal((await call(a+'/items/i-a',{method:'PATCH',token:manager,data:{is_available:false}})).status,200);
  assert.equal((await(await call('/api/restaurants/restaurant-a')).json()).items.length,0);
  await call(a+'/items/i-a',{method:'PATCH',token:manager,data:{is_available:true}});
  await call(a+'/categories/c-a',{method:'PUT',token:manager,data:{name:'Drinks',is_active:false}});
  assert.equal((await(await call('/api/restaurants/restaurant-a')).json()).items.length,0);
  await call(a+'/categories/c-a',{method:'PUT',token:manager,data:{name:'Drinks',is_active:true}});
 });
 await t.test('hours, feedback, analytics and activity routes retain their behavior',async()=>{
  assert.equal((await call(a+'/hours',{method:'PUT',token:manager,data:{rows:[{weekday:1,opens_at:'07:00',closes_at:'21:00',is_closed:false}]}})).status,200);
  assert.equal((await(await call('/api/restaurants/restaurant-a')).json()).hours[0].weekday,1);
  assert.equal((await call('/api/restaurants/r-a/feedback',{method:'POST',data:{message:'Great coffee'}})).status,201);
  const feedback=await(await call(a+'/feedback',{token:manager})).json();assert.equal(feedback[0].message,'Great coffee');
  assert.equal((await call(a+'/feedback/'+feedback[0].id,{method:'PATCH',token:manager,data:{}})).status,200);
  assert.equal((await call('/api/restaurants/r-a/events',{method:'POST',data:{event_type:'page_view',metadata:{slug:'restaurant-a',secret:'discard'}}})).status,201);
  const events=await(await call(a+'/analytics',{token:manager})).json();assert.equal(events.page_view,1);
  const metadata=JSON.parse(db.sql.prepare('SELECT metadata FROM analytics_events').get().metadata);assert.equal(metadata.secret,undefined);
  assert.ok((await(await call(a+'/audit',{token:manager})).json()).length>1);
 });
 await t.test('only the owner can activate restaurants or generate invitations',async()=>{
  assert.equal((await call(a,{method:'PATCH',token:manager,data:{status:'suspended'}})).status,403);
  assert.equal((await call(a+'/invites',{method:'POST',token:manager,data:{email:'new@example.test'}})).status,403);
  assert.equal((await call(a,{method:'PATCH',token:owner,data:{id:'r-b'}})).status,400);
 });
 await t.test('email-bound invitations create only manager access, expire and cannot be replayed',async()=>{
  const response=await call(a+'/invites',{method:'POST',token:owner,data:{email:'new@example.test'}});assert.equal(response.status,201);const invite=await response.json();
  assert.equal((await call('/api/invites/redeem',{method:'POST',token:unknown,data:{code:invite.invite_code}})).status,400);
  const newUser=await token('new@example.test');
  db.sql.prepare("UPDATE restaurant_invites SET expires_at='2000-01-01T00:00:00Z' WHERE invitee_email='new@example.test'").run();
  assert.equal((await call('/api/invites/redeem',{method:'POST',token:newUser,data:{code:invite.invite_code}})).status,400);
  db.sql.prepare("UPDATE restaurant_invites SET expires_at='2099-01-01T00:00:00Z' WHERE invitee_email='new@example.test'").run();
  assert.equal((await call('/api/invites/redeem',{method:'POST',token:newUser,data:{code:invite.invite_code}})).status,200);
  assert.equal((await call('/api/invites/redeem',{method:'POST',token:newUser,data:{code:invite.invite_code}})).status,400);
  assert.equal((await call(a+'/items',{token:newUser})).status,200);assert.equal((await call(b+'/items',{token:newUser})).status,403);
 });
 await t.test('new restaurants start draft and guests cannot discover them',async()=>{
  const response=await call('/api/admin/restaurants',{method:'POST',token:owner,data:{name:'New Cafe',slug:'new-cafe'}});assert.equal(response.status,201);
  assert.equal((await call('/api/restaurants/new-cafe')).status,404);
 });
 await t.test('upload activation error is clear; active R2 accepts real signatures and rejects mismatches',async()=>{
  const png=new Uint8Array([137,80,78,71,13,10,26,10,0]);
  assert.equal((await call(a+'/uploads',{method:'POST',token:manager,headers:{'Content-Type':'image/png'},raw:png})).status,503);
  const objects=new Map();env.MEDIA={async put(key,bytes,meta){objects.set(key,{bytes,meta});}};
  const response=await call(a+'/uploads',{method:'POST',token:manager,headers:{'Content-Type':'image/png'},raw:png});assert.equal(response.status,201);assert.equal(objects.size,1);
  assert.equal((await call(a+'/uploads',{method:'POST',token:manager,headers:{'Content-Type':'image/jpeg'},raw:png})).status,400);
 });
 await t.test('public feedback has abuse limits',async()=>{
  for(let i=0;i<4;i++)assert.equal((await call('/api/restaurants/r-a/feedback',{method:'POST',data:{message:'Feedback '+i}})).status,201);
  assert.equal((await call('/api/restaurants/r-a/feedback',{method:'POST',data:{message:'Too much'}})).status,429);
 });
});
