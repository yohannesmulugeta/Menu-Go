import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {pbkdf2Sync} from 'node:crypto';
import {applyLocalMigrations} from '../cloudflare/platform/migrations.mjs';
import {hashPassword,verifyPassword,passwordProblem,normalizeUsername,digest} from '../cloudflare/platform/auth/passwords.mjs';
import {legacyCredentialPlan} from '../cloudflare/platform/auth/legacy.mjs';
import {ownerPlan} from '../cloudflare/platform/auth/operator.mjs';
import {cleanupAuth} from '../cloudflare/platform/auth/service.mjs';
import worker from '../cloudflare/platform/worker.mjs';
const db=new DatabaseSync(':memory:');applyLocalMigrations(db);
let beforeBatch=null;
const d1={prepare(sql){let params=[];const statement={bind(...values){params=values;return statement;},async first(){return db.prepare(sql).get(...params)||null;},async all(){return {results:db.prepare(sql).all(...params)};},async run(){const r=db.prepare(sql).run(...params);return {meta:{changes:Number(r.changes)}};}};return statement;},async batch(statements){if(beforeBatch){const fn=beforeBatch;beforeBatch=null;fn();}db.exec('BEGIN IMMEDIATE');try{const result=[];for(const s of statements)result.push(await s.run());db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}};
const env={ENVIRONMENT:'admaki-menu-platform-staging',DB:d1,MEDIA:{}};
const origin='https://staging.invalid';
const request=(path,body,token,headers={})=>new Request(origin+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json',Origin:origin,'X-Menu-Request':'1'}),...(token?{Cookie:token}:{}),'CF-Connecting-IP':'192.0.2.1',...headers},body:body===undefined?undefined:JSON.stringify(body)});
const call=(path,body,token,headers)=>worker.fetch(request(path,body,token,headers),env);
const cookie=r=>r.headers.get('set-cookie').split(';')[0];
const user=(id,username,password,admin=false,ids=['staging-demo'],must=0)=>{const h=hashPassword(password);db.prepare('INSERT INTO users(id,email) VALUES(?,?)').run(id,id+'@test.invalid');db.prepare('INSERT INTO login_credentials(user_id,username,hash_format,password_hash,parameters_json,must_change_password) VALUES(?,?,?,?,?,?)').run(id,username,h.hash_format,h.password_hash,h.parameters_json,must);if(admin)db.prepare('INSERT INTO platform_admins(user_id) VALUES(?)').run(id);else for(const r of ids)db.prepare("INSERT INTO restaurant_members(id,restaurant_id,user_id,role) VALUES(?,?,?,'manager')").run(id+r,r,id);};
const login=async(username,password)=>{const r=await call('/api/auth/login',{username,password});assert.equal(r.status,200,await r.clone().text());return {token:cookie(r),data:await r.json()};};
const ownerPassword='river lantern meadow 72',managerPassword='garden sunrise coffee 83';
user('owner','owner',ownerPassword,true);
user('manager','manager',managerPassword);
db.prepare("INSERT INTO restaurants(id,name,slug,status) VALUES('other','Other private restaurant','other','draft')").run();
user('multi','multi','sunny mountain window 84',false,['staging-demo','other']);
assert.equal(normalizeUsername(' OccaSion '),'occasion');assert.equal(normalizeUsername('bad@example.com'),null);
assert.ok(passwordProblem('short'));assert.equal(passwordProblem('a memorable coffee phrase 7','user'),null);
const h=hashPassword('a memorable coffee phrase 7');assert.ok(verifyPassword('a memorable coffee phrase 7',h));assert.ok(!verifyPassword('wrong',h));
assert.ok(!verifyPassword('x',{...h,parameters_json:'{"N":9999999999}'}));
let r=await call('/api/auth/login',{username:'owner',password:ownerPassword},undefined,{Origin:'https://evil.invalid'});assert.equal(r.status,403);
r=await call('/api/auth/login',{username:'owner',password:ownerPassword},undefined,{'X-Menu-Request':'0'});assert.equal(r.status,403);
r=await call('/api/auth/login',{username:'owner',password:ownerPassword},undefined,{'Sec-Fetch-Site':'cross-site'});assert.equal(r.status,403);
r=await call('/api/auth/login',{username:'owner',password:'x'.repeat(5000)});assert.equal(r.status,413);
const incorrect=await call('/api/auth/login',{username:'owner',password:'wrong'}),unknown=await call('/api/auth/login',{username:'unknown',password:'wrong'});assert.equal(incorrect.status,401);assert.deepEqual(await incorrect.json(),await unknown.json());
const owner=await login('OWNER',ownerPassword),manager=await login('manager',managerPassword),multi=await login('multi','sunny mountain window 84');
assert.equal(owner.data.role,'super_admin');assert.equal(manager.data.role,'manager');assert.equal(multi.data.restaurants.length,2);
r=await call('/api/auth/session',undefined,manager.token);const publicSession=await r.text();assert.ok(!/password_hash|parameters_json|@test|token_hash/.test(publicSession));assert.match(r.headers.get('cache-control'),/no-store/);
r=await call('/api/auth/login',{username:'owner',password:ownerPassword});assert.match(r.headers.get('set-cookie'),/Secure; HttpOnly; SameSite=Strict/);assert.ok(r.headers.get('set-cookie').startsWith('__Host-'));
assert.equal((await call('/api/manage/staging-demo/overview',undefined,manager.token)).status,200);
assert.equal((await call('/api/manage/other/overview',undefined,manager.token)).status,404);
assert.equal((await call('/api/platform/users',undefined,manager.token)).status,403);
assert.equal((await call('/api/platform/users',{username:'intruder',restaurant_ids:['other']},manager.token)).status,403);
assert.equal((await call('/api/platform/users/owner/reset-password',{},manager.token)).status,403);
// Server membership changes take effect for an existing session.
db.prepare("DELETE FROM restaurant_members WHERE user_id='manager'").run();assert.equal((await call('/api/manage/staging-demo/overview',undefined,manager.token)).status,404);
db.prepare("INSERT INTO restaurant_members(id,restaurant_id,user_id,role) VALUES('restored','staging-demo','manager','manager')").run();
// First-login credentials cannot reach even their own protected overview.
r=await call('/api/platform/users',{username:'newmanager',restaurant_ids:['staging-demo','other']},owner.token);assert.equal(r.status,201,await r.clone().text());let created=await r.json();const temporary=created.temporary_password;
const first=await login('newmanager',temporary);assert.equal(first.data.must_change_password,true);
assert.equal((await call('/api/manage/staging-demo/overview',undefined,first.token)).status,403);
r=await call('/api/auth/password',{current_password:temporary,new_password:'blue basket meadow 907',username:'newname'},first.token);assert.equal(r.status,200,await r.clone().text());
assert.equal(await (await call('/api/auth/session',undefined,first.token)).json(),null);
assert.equal((await call('/api/auth/login',{username:'newmanager',password:temporary})).status,401);
const renamed=await login('newname','blue basket meadow 907');assert.equal(renamed.data.must_change_password,false);
const second=await login('newname','blue basket meadow 907');
r=await call('/api/platform/users/'+created.user_id+'/reset-password',{},owner.token);assert.equal(r.status,200);const reset=await r.json();
for(const t of [renamed.token,second.token])assert.equal(await (await call('/api/auth/session',undefined,t)).json(),null);
assert.equal((await call('/api/auth/login',{username:'newname',password:'blue basket meadow 907'})).status,401);
assert.equal((await login('newname',reset.temporary_password)).data.must_change_password,true);
const usersBody=await (await call('/api/platform/users',undefined,owner.token)).text();assert.ok(!usersBody.includes(reset.temporary_password));
db.prepare('UPDATE login_credentials SET temporary_expires_at=? WHERE user_id=?').run(Math.floor(Date.now()/1000)-1,created.user_id);
assert.equal((await call('/api/auth/login',{username:'newname',password:reset.temporary_password})).status,401);
// Recent reauthentication required for privileged changes.
db.prepare('UPDATE auth_sessions SET reauthenticated_at=1 WHERE token_hash=?').run(digest(owner.token.split('=')[1]));
assert.equal((await call('/api/platform/users',{username:'moreuser',restaurant_ids:['staging-demo']},owner.token)).status,428);
assert.equal((await call('/api/auth/reauth',{current_password:ownerPassword},owner.token)).status,200);
assert.equal((await call('/api/platform/users',{username:'badrole',restaurant_ids:['staging-demo'],role:'super_admin'},owner.token)).status,400);
assert.equal((await call('/api/platform/users',{username:'owner',restaurant_ids:['staging-demo']},owner.token)).status,409);
assert.equal((await call('/api/platform/users',{username:'moreuser',restaurant_ids:['missing']},owner.token)).status,400);
// Legacy UTF-8 salt verification upgrades the same user ID after successful login.
user('legacy','legacy','placeholder shared password 20');db.prepare("DELETE FROM login_credentials WHERE user_id='legacy'").run();const salt='a1b2c3d4e5f607182930a1b2c3d4e5f6',legacyPassword='legacy coffee pass 98';
const legacyHash=pbkdf2Sync(legacyPassword,salt,100000,32,'sha256').toString('hex');
const legacyRow={user_id:'legacy',username:'legacy',password_hash:legacyHash,salt,iterations:100000,password_version:1};
db.prepare('INSERT INTO manager_credentials(user_id,restaurant_id,username,password_hash,salt,iterations,password_version,must_change_password) VALUES(?,?,?,?,?,100000,1,0)').run('legacy','staging-demo','legacy',legacyHash,salt);
await d1.batch(legacyCredentialPlan(legacyRow,'legacy-import').map(q=>d1.prepare(q.sql).bind(...q.params)));
await d1.batch(legacyCredentialPlan(legacyRow,'legacy-replay').map(q=>d1.prepare(q.sql).bind(...q.params)));
assert.equal(db.prepare("SELECT count(*) n FROM platform_audit_logs WHERE action='auth.legacy_import'").get().n,1);
assert.throws(()=>legacyCredentialPlan({...legacyRow,iterations:1},'bad'),/Unsupported/);
const legacy=()=>db.prepare("UPDATE login_credentials SET hash_format='pbkdf2-sha256-legacy',password_hash=?,parameters_json=?,credential_version=1 WHERE user_id='legacy'").run(legacyHash,JSON.stringify({salt,salt_encoding:'utf8',iterations:100000}));legacy();
const migrated=await login('legacy',legacyPassword);assert.equal(migrated.data.user_id,'legacy');assert.equal(db.prepare("SELECT hash_format FROM login_credentials WHERE user_id='legacy'").get().hash_format,'scrypt-v1');
// A reset racing legacy rehash must not mint a session for the reset version.
legacy();beforeBatch=()=>{const changed=hashPassword('different current secret 12');db.prepare("UPDATE login_credentials SET credential_version=2,password_hash=?,hash_format=?,parameters_json=? WHERE user_id='legacy'").run(changed.password_hash,changed.hash_format,changed.parameters_json);};
assert.equal((await call('/api/auth/login',{username:'legacy',password:legacyPassword})).status,409);
// Rotation racing a reset cannot overwrite it.
beforeBatch=()=>db.prepare("UPDATE login_credentials SET credential_version=credential_version+1 WHERE user_id='manager'").run();
assert.equal((await call('/api/auth/password',{current_password:managerPassword,new_password:'different garden phrase 23'},manager.token)).status,409);
// Last enabled owner is protected at the database boundary.
assert.throws(()=>db.prepare("DELETE FROM platform_admins WHERE user_id='owner'").run(),/last/);
assert.throws(()=>db.prepare("UPDATE users SET disabled=1 WHERE id='owner'").run(),/last/);
assert.throws(()=>db.prepare("UPDATE login_credentials SET disabled=1 WHERE user_id='owner'").run(),/last/);
assert.throws(()=>db.prepare("DELETE FROM login_credentials WHERE user_id='owner'").run(),/last/);
// Offline recovery cannot promote a manager; owner recovery revokes all sessions and is audited.
const recovery=hashPassword('operator recovery fixture 27');
async function operator(mode,userId,username){return d1.batch(ownerPlan({mode,userId,username,credential:recovery,expiresAt:Math.floor(Date.now()/1000)+86400,requestId:crypto.randomUUID()}).map(q=>d1.prepare(q.sql).bind(...q.params)));}
await operator('recover','manager','manager');assert.equal(db.prepare("SELECT count(*) n FROM platform_admins WHERE user_id='manager'").get().n,0);
await operator('recover','owner','owner');assert.equal(await (await call('/api/auth/session',undefined,owner.token)).json(),null);assert.equal((await login('owner','operator recovery fixture 27')).data.must_change_password,true);
const fresh=new DatabaseSync(':memory:');applyLocalMigrations(fresh);const bootstrap=ownerPlan({mode:'bootstrap',userId:'new-owner',username:'owner',credential:recovery,expiresAt:9999999999,requestId:'bootstrap-test'});
fresh.exec('BEGIN');for(const q of bootstrap)fresh.prepare(q.sql).run(...q.params);fresh.exec('COMMIT');assert.equal(fresh.prepare('SELECT count(*) n FROM platform_admins').get().n,1);
// No plaintext passwords in credentials or audit records.
const audits=JSON.stringify(db.prepare('SELECT * FROM platform_audit_logs').all());for(const secret of [ownerPassword,managerPassword,temporary,reset.temporary_password])assert.ok(!audits.includes(secret));
// Logout, absolute/idle expiry, user disable and scheduled bounded cleanup.
const final=await login('multi','sunny mountain window 84');assert.equal((await call('/api/auth/logout',{},final.token)).status,200);assert.equal(await (await call('/api/auth/session',undefined,final.token)).json(),null);
const expired=await login('multi','sunny mountain window 84');db.prepare('UPDATE auth_sessions SET idle_expires_at=created_at+1,absolute_expires_at=created_at+1 WHERE token_hash=?').run(digest(expired.token.split('=')[1]));
// Advance the created/expiry timestamps safely beyond both deadlines.
db.prepare('UPDATE auth_sessions SET created_at=1,idle_expires_at=2,absolute_expires_at=2 WHERE token_hash=?').run(digest(expired.token.split('=')[1]));assert.equal(await (await call('/api/auth/session',undefined,expired.token)).json(),null);
await cleanupAuth(d1);assert.equal(db.prepare('SELECT count(*) n FROM auth_sessions WHERE absolute_expires_at<=2').get().n,0);
db.prepare("UPDATE users SET disabled=1 WHERE id='multi'").run();assert.equal(await (await call('/api/auth/session',undefined,multi.token)).json(),null);
db.prepare('DELETE FROM auth_rate_limits').run();for(let i=0;i<15;i++)assert.equal((await call('/api/auth/login',{username:'throttle',password:'wrong'})).status,401);r=await call('/api/auth/login',{username:'throttle',password:'wrong'});assert.equal(r.status,429);assert.equal(r.headers.get('retry-after'),'900');
assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
console.log('Shared authentication checks passed: roles, multi-tenant denial, CSRF, password upgrade/races, first-login rotation, reset/revocation, temporary expiry, reauthentication, owner recovery/last-admin protection, throttling, cleanup and secret-free responses/audits.');
