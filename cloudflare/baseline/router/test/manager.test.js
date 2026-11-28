import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import router from '../router.js';
import {passwordHash,SESSION_COOKIE,digest} from '../manager-auth.js';

const fixture=JSON.parse(readFileSync(new URL('./occasion-fixture.json',import.meta.url)));
const originalPassword='Test-only-initial-4v8M';
const replacement='Test-only-replacement-6c2R';
const salt='test-only-salt-not-for-production';
const hash=await passwordHash(originalPassword,salt);
async function setup({mustChange=1}={}) {
  const db=new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON;'+readFileSync(new URL('./schema.sql',import.meta.url),'utf8')+readFileSync(new URL('../migrations/001_manager_credentials.sql',import.meta.url),'utf8'));
  const insert=(table,row)=>{const entries=Object.entries(row);db.prepare(`INSERT INTO ${table}(${entries.map(([k])=>k)}) VALUES(${entries.map(()=>'?')})`).run(...entries.map(([,v])=>v));};
  insert('restaurants',fixture.restaurant);
  insert('restaurants',{id:'other-restaurant',name:'Other',slug:'other',status:'active'});
  for(const c of fixture.categories)insert('categories',c);
  for(const item of fixture.items)insert('menu_items',item);
  insert('users',{id:'local-manager',email:'local-manager@users.invalid'});
  insert('restaurant_members',{id:'local-membership',restaurant_id:fixture.restaurant.id,user_id:'local-manager',role:'manager'});
  insert('manager_credentials',{user_id:'local-manager',restaurant_id:fixture.restaurant.id,username:'occasion',password_hash:hash,salt,must_change_password:mustChange});
  function prepare(sql,params=[]) {
    return {_sql:sql,_params:params,bind(...args){return prepare(sql,args);},async first(){const r=db.prepare(sql).get(...params);return r?{...r}:null;},async all(){return {results:db.prepare(sql).all(...params).map(r=>({...r})),success:true};},async run(){const r=db.prepare(sql).run(...params);return {success:true,meta:{changes:Number(r.changes)}};}};
  }
  const env={DB:{prepare,async batch(statements){db.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await (/^\s*SELECT/i.test(s._sql)?s.all():s.run()));db.exec('COMMIT');return results;}catch(e){db.exec('ROLLBACK');throw e;}}},MENU_CORE:{async fetch(){return new Response('original core',{status:202});}}};
  async function request(path,{method='GET',body,cookie,origin='https://app.admakidigital.com',headers={}}={}) {
    if(cookie)headers.Cookie=cookie;
    if(body!==undefined){headers.Origin=origin;headers['Content-Type']='application/json';headers['X-Menu-Request']='1';}
    return router.fetch(new Request('https://app.admakidigital.com'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),env,{});
  }
  const login=(password=originalPassword,username='occasion')=>request('/manager/api/login',{method:'POST',body:{username,password}});
  return {db,env,request,login};
}
const cookieFrom=r=>r.headers.get('Set-Cookie')?.split(';')[0];

test('username login has secure opaque sessions and requires a first-login password change',async()=>{
  const {db,request,login}=await setup();
  const response=await login();assert.equal(response.status,200);
  const data=await response.json();assert.equal(data.must_change_password,true);assert.equal(data.next,'/manager/change-password');assert.equal('password' in data,false);
  const setCookie=response.headers.get('Set-Cookie');for(const flag of ['HttpOnly','Secure','SameSite=Strict','Path=/'])assert.ok(setCookie.includes(flag));
  const cookie=cookieFrom(response),rawToken=cookie.split('=')[1];
  assert.equal(db.prepare('SELECT token_hash FROM manager_sessions').get().token_hash,await digest(rawToken));
  assert.equal((await request(`/api/admin/restaurants/${fixture.restaurant.id}`,{cookie})).status,428);
  const root=await request('/',{cookie});assert.equal(root.status,302);assert.equal(root.headers.get('Location'),'https://app.admakidigital.com/manager/change-password');
  const preview=await request('/preview/occasion',{cookie});assert.equal(preview.status,302);
});

test('password change verifies the old password, revokes sessions, and permits only the owned restaurant',async()=>{
  const {db,request,login}=await setup();
  const oldCookie=cookieFrom(await login());
  const secondCookie=cookieFrom(await login());
  const change=body=>request('/manager/api/password',{method:'POST',cookie:oldCookie,body});
  assert.equal((await change({current_password:'wrong',new_password:replacement})).status,400);
  assert.equal((await change({current_password:originalPassword,new_password:'short'})).status,400);
  assert.equal((await change({current_password:originalPassword,new_password:originalPassword})).status,400);
  const result=await change({current_password:originalPassword,new_password:replacement,username:'occasion-team'});
  assert.equal(result.status,200);const cookie=cookieFrom(result);
  assert.equal((await request('/api/session',{cookie:oldCookie})).status,401);
  assert.equal((await request('/api/session',{cookie:secondCookie})).status,401);
  const session=await (await request('/api/session',{cookie})).json();assert.equal(session.user.email,'occasion-team');assert.equal(session.platform_admin,false);
  assert.equal((await request('/api/admin/restaurants/other-restaurant',{cookie})).status,403);
  assert.equal((await request('/api/admin/restaurants',{cookie})).status,403);
  const mine=await request(`/api/admin/restaurants/${fixture.restaurant.id}`,{cookie});assert.equal(mine.status,200);
  const item=fixture.items.find(i=>i.name==='Cheese Burger');
  const update=await request(`/api/admin/restaurants/${fixture.restaurant.id}/items/${item.id}`,{cookie,method:'PUT',body:{name:item.name,description:item.description,price:599.99,image_url:null,category_id:item.category_id,is_available:true,is_popular:false,version:1}});
  assert.equal(update.status,200,await update.text());assert.equal(db.prepare('SELECT price FROM menu_items WHERE id=?').get(item.id).price,599.99);
  assert.equal((await login(originalPassword,'occasion-team')).status,401);
  assert.equal((await login(replacement,'occasion-team')).status,200);
  const audit=db.prepare("SELECT new_data FROM audit_logs WHERE action='manager.password_changed'").get().new_data;
  assert.ok(!audit.includes(replacement)&&!audit.includes(originalPassword)&&!audit.includes(hash));
});

test('cross-origin requests, forged sessions, expired sessions and disabled accounts cannot authenticate',async()=>{
  const {db,request,login}=await setup({mustChange:0});
  assert.equal((await request('/manager/api/login',{method:'POST',origin:'https://other.example',body:{username:'occasion',password:originalPassword}})).status,403);
  const wrong=await login('wrong-password');assert.equal(wrong.status,401);assert.match(await wrong.text(),/Incorrect username or password/);
  const unknown=await login('wrong-password','unknown');assert.equal(unknown.status,401);assert.match(await unknown.text(),/Incorrect username or password/);
  assert.equal((await request('/api/session',{cookie:SESSION_COOKIE+'='+'0'.repeat(64)})).status,401);
  const cookie=cookieFrom(await login());db.prepare('UPDATE manager_sessions SET expires_at=1').run();
  assert.equal((await request('/api/session',{cookie})).status,401);
  const newCookie=cookieFrom(await login());db.prepare('UPDATE users SET disabled=1').run();
  assert.equal((await request('/api/session',{cookie:newCookie})).status,401);assert.equal((await login()).status,401);
});

test('logout revokes the session and revoked tenant membership is enforced on each request',async()=>{
  const {db,request,login}=await setup({mustChange:0});
  const cookie=cookieFrom(await login());
  const logout=await request('/manager/api/logout',{method:'POST',cookie,body:{}});assert.equal(logout.status,200);assert.match(logout.headers.get('Set-Cookie'),/Max-Age=0/);
  assert.equal((await request('/api/session',{cookie})).status,401);
  const nextCookie=cookieFrom(await login());db.prepare('DELETE FROM restaurant_members WHERE user_id=?').run('local-manager');
  assert.equal((await request('/api/session',{cookie:nextCookie})).status,401);
});

test('login attempts are rate limited and existing email-based requests still delegate to the core',async()=>{
  const {db,request}=await setup();
  const delegated=await request('/api/session');assert.equal(delegated.status,202);
  const bucket=Math.floor(Math.floor(Date.now()/1000)/900);
  db.prepare('INSERT INTO manager_auth_limits(key,count,expires_at) VALUES(?,?,?)').run(await digest(`${bucket}:login-ip:unknown`),60,(bucket+1)*900);
  const response=await request('/manager/api/login',{method:'POST',body:{username:'occasion',password:originalPassword}});assert.equal(response.status,429);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM manager_sessions').get().n,0);
});
