import {randomToken,digest,temporaryPassword,normalizeUsername,passwordProblem,hashPassword,verifyPassword,DUMMY_CREDENTIAL,HASH_FORMAT} from './passwords.mjs';
import {fail,input,response} from './http.mjs';
export const COOKIE='__Host-admaki_menu';
const IDLE=1800, ABSOLUTE=28800, RECENT=300;
const now=()=>Math.floor(Date.now()/1000);
const cookie=(token,ttl=ABSOLUTE)=>`${COOKIE}=${token}; Path=/; Max-Age=${ttl}; Secure; HttpOnly; SameSite=Strict`;
const credentialSQL='SELECT c.*,u.disabled user_disabled FROM login_credentials c JOIN users u ON u.id=c.user_id';
async function limit(db,key,max,window=900) {
  const t=now(),bucket=Math.floor(t/window);
  const row=await db.prepare('INSERT INTO auth_rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count')
    .bind(digest(`${bucket}:${key}`),(bucket+1)*window).first();
  if(row.count>max)fail(429,'Too many attempts. Try again in 15 minutes.');
}
export async function session(request,db) {
  const token=request.headers.get('Cookie')?.split(';').map(c=>c.trim()).find(c=>c.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
  if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
  const s=await db.prepare(`SELECT c.*,s.token_hash,s.reauthenticated_at,s.idle_expires_at,s.absolute_expires_at FROM auth_sessions s
    JOIN login_credentials c ON c.user_id=s.user_id JOIN users u ON u.id=c.user_id
    WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.credential_version=c.credential_version
    AND s.idle_expires_at>? AND s.absolute_expires_at>? AND c.disabled=0 AND u.disabled=0
    AND (c.temporary_expires_at IS NULL OR c.temporary_expires_at>?)`).bind(digest(token),now(),now(),now()).first();
  if(s && s.idle_expires_at<now()+IDLE-300)await db.prepare('UPDATE auth_sessions SET idle_expires_at=MIN(?,absolute_expires_at) WHERE token_hash=? AND revoked_at IS NULL').bind(now()+IDLE,s.token_hash).run();
  return s;
}
async function identity(db,s) {
  const admin=!!await db.prepare('SELECT 1 FROM platform_admins WHERE user_id=?').bind(s.user_id).first();
  const rows=await db.prepare(admin?'SELECT id,name,slug,status FROM restaurants ORDER BY name,id LIMIT 100':'SELECT r.id,r.name,r.slug,r.status FROM restaurants r JOIN restaurant_members m ON m.restaurant_id=r.id WHERE m.user_id=? AND m.role=\'manager\' ORDER BY r.name,r.id LIMIT 100');
  const result=await (admin?rows:rows.bind(s.user_id)).all();
  return {user_id:s.user_id,username:s.username,role:admin?'super_admin':'manager',must_change_password:!!s.must_change_password,restaurants:result.results};
}
async function requireSession(request,db,full=true) {
  const s=await session(request,db);if(!s)fail(401,'Sign in to continue.');
  if(full&&s.must_change_password)fail(403,'Change your temporary password first.');
  return s;
}
async function requireAdmin(request,db,recent=false) {
  const s=await requireSession(request,db);
  if(!await db.prepare('SELECT 1 FROM platform_admins WHERE user_id=?').bind(s.user_id).first())fail(403,'Super-admin access is required.');
  if(recent&&(!s.reauthenticated_at||s.reauthenticated_at<now()-RECENT))fail(428,'Confirm your password before managing accounts.');
  return s;
}
// Recheck the operator inside each credential mutation's transaction, after expensive hashing.
function actorGuard() {return `EXISTS(SELECT 1 FROM auth_sessions s JOIN login_credentials c ON c.user_id=s.user_id JOIN users u ON u.id=c.user_id JOIN platform_admins a ON a.user_id=c.user_id WHERE s.token_hash=? AND s.user_id=? AND s.revoked_at IS NULL AND s.credential_version=c.credential_version AND c.disabled=0 AND u.disabled=0 AND c.must_change_password=0 AND s.idle_expires_at>? AND s.absolute_expires_at>? AND s.reauthenticated_at>?)`;}
function actorParams(s){return [s.token_hash,s.user_id,now(),now(),now()-RECENT];}
async function credentialFor(db,userId){return db.prepare(credentialSQL+' WHERE c.user_id=?').bind(userId).first();}
async function verifyCurrent(db,s,password) {
  await limit(db,'verify:'+s.user_id,10);
  const c=await credentialFor(db,s.user_id);
  if(!c||c.credential_version!==s.credential_version||!verifyPassword(password,c))fail(400,'The current password is incorrect.');
  return c;
}
export async function authRoute(request,env) {
  const db=env.DB,path=new URL(request.url).pathname,method=request.method,requestId=crypto.randomUUID();
  if(path==='/api/auth/session'&&method==='GET') {
    const s=await session(request,db);return response(s?await identity(db,s):null);
  }
  if(path==='/api/platform/restaurants'&&method==='GET') {
    const s=await requireAdmin(request,db);return response((await identity(db,s)).restaurants);
  }
  if(path==='/api/platform/users'&&method==='GET') {
    await requireAdmin(request,db);
    const url=new URL(request.url),offset=Number(url.searchParams.get('offset')||0);
    if(!Number.isSafeInteger(offset)||offset<0)fail(400,'Invalid page.');
    const users=await db.prepare(`SELECT c.user_id,c.username,c.must_change_password,c.disabled,
      EXISTS(SELECT 1 FROM platform_admins a WHERE a.user_id=c.user_id) is_admin
      FROM login_credentials c ORDER BY c.username LIMIT 51 OFFSET ?`).bind(offset).all();
    return response({users:users.results.slice(0,50),next_offset:users.results.length>50?offset+50:null});
  }
  const tenant=/^\/api\/manage\/([^/]+)\/overview$/.exec(path);
  if(tenant&&method==='GET') {
    const s=await requireSession(request,db),id=decodeURIComponent(tenant[1]);
    const allowed=await db.prepare("SELECT 1 WHERE EXISTS(SELECT 1 FROM platform_admins WHERE user_id=?) OR EXISTS(SELECT 1 FROM restaurant_members WHERE user_id=? AND restaurant_id=? AND role='manager')").bind(s.user_id,s.user_id,id).first();
    if(!allowed)fail(404,'Restaurant not found.');
    const r=await db.prepare('SELECT id,name,slug,status FROM restaurants WHERE id=?').bind(id).first();if(!r)fail(404,'Restaurant not found.');
    return response({restaurant:r,authentication:'ready',menu_management:'not enabled in this staging phase'});
  }
  const reset=/^\/api\/platform\/users\/([^/]+)\/reset-password$/.exec(path);
  const recognized=['/api/auth/login','/api/auth/logout','/api/auth/password','/api/auth/reauth','/api/platform/users'].includes(path)||!!reset;
  if(!recognized)return null;
  if(method!=='POST')return response({error:'Method not allowed.'},405,{Allow:'POST'});
  const body=await input(request);
  if(path==='/api/auth/logout') {
    const s=await session(request,db);
    if(s)await db.prepare('UPDATE auth_sessions SET revoked_at=? WHERE token_hash=?').bind(now(),s.token_hash).run();
    return response({ok:true},200,{'Set-Cookie':cookie('',0)});
  }
  if(path==='/api/auth/login') {
    await limit(db,'login-ip:'+(request.headers.get('CF-Connecting-IP')||'unknown'),40);
    const username=normalizeUsername(body.username);
    if(!username||typeof body.password!=='string'||Buffer.byteLength(body.password,'utf8')>1024)fail(401,'Incorrect username or password.');
    await limit(db,'login-account:'+username,15);
    const c=await db.prepare(credentialSQL+' WHERE c.username=? COLLATE NOCASE').bind(username).first();
    const valid=verifyPassword(body.password,c&&!c.disabled&&!c.user_disabled?c:DUMMY_CREDENTIAL);
    if(!c||c.disabled||c.user_disabled||!valid||(c.temporary_expires_at&&c.temporary_expires_at<=now()))fail(401,'Incorrect username or password.');
    const ident=await identity(db,c);
    if(ident.role!=='super_admin'&&!ident.restaurants.length)fail(401,'Incorrect username or password.');
    const token=randomToken(),t=now(),hash=digest(token),ops=[];
    let version=c.credential_version,expectedHash=c.password_hash;
    if(c.hash_format!==HASH_FORMAT) {
      const h=hashPassword(body.password);version++;expectedHash=h.password_hash;
      ops.push(db.prepare('UPDATE login_credentials SET hash_format=?,password_hash=?,parameters_json=?,credential_version=credential_version+1,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND credential_version=? AND password_hash=? AND disabled=0')
        .bind(h.hash_format,h.password_hash,h.parameters_json,c.user_id,c.credential_version,c.password_hash));
      ops.push(db.prepare('UPDATE auth_sessions SET revoked_at=? WHERE user_id=? AND credential_version<?').bind(t,c.user_id,version));
      ops.push(db.prepare('DELETE FROM manager_sessions WHERE user_id=?').bind(c.user_id));
    }
    // Version guard rejects a reset/disable racing this login. Credentials never come from the client.
    ops.push(db.prepare(`INSERT INTO auth_sessions(token_hash,user_id,credential_version,created_at,idle_expires_at,absolute_expires_at,reauthenticated_at)
      SELECT ?,c.user_id,c.credential_version,?,?,?,? FROM login_credentials c JOIN users u ON u.id=c.user_id
      WHERE c.user_id=? AND c.credential_version=? AND c.password_hash=? AND c.disabled=0 AND u.disabled=0 AND (c.temporary_expires_at IS NULL OR c.temporary_expires_at>?)
      AND (EXISTS(SELECT 1 FROM platform_admins a WHERE a.user_id=c.user_id) OR EXISTS(SELECT 1 FROM restaurant_members m WHERE m.user_id=c.user_id AND m.role='manager'))`)
      .bind(hash,t,t+IDLE,t+ABSOLUTE,t,c.user_id,version,expectedHash,t));
    const insertIndex=ops.length-1;
    ops.push(db.prepare("INSERT INTO platform_audit_logs(actor_user_id,action,target_type,target_id,request_id,after_json) SELECT ?,'auth.login','user',?,?,'{}' WHERE EXISTS(SELECT 1 FROM auth_sessions WHERE token_hash=?)").bind(c.user_id,c.user_id,requestId,hash));
    const result=await db.batch(ops);
    if(!result[insertIndex].meta.changes)fail(409,'Your account changed. Sign in again.');
    return response({ok:true,...ident},200,{'Set-Cookie':cookie(token)});
  }
  if(path==='/api/auth/reauth') {
    const s=await requireSession(request,db);await verifyCurrent(db,s,body.current_password);
    const r=await db.prepare('UPDATE auth_sessions SET reauthenticated_at=? WHERE token_hash=? AND credential_version=(SELECT credential_version FROM login_credentials WHERE user_id=?) AND revoked_at IS NULL').bind(now(),s.token_hash,s.user_id).run();
    if(!r.meta.changes)fail(409,'Your account changed. Sign in again.');return response({ok:true});
  }
  if(path==='/api/auth/password') {
    const s=await requireSession(request,db,false),old=await verifyCurrent(db,s,body.current_password);
    const username=body.username===undefined?old.username:normalizeUsername(body.username);
    if(!username)fail(400,'Use 3–48 letters, numbers, dots, hyphens or underscores for your username.');
    const problem=passwordProblem(body.new_password,username);if(problem)fail(400,problem);
    if(body.new_password===body.current_password)fail(400,'Choose a different password.');
    if(await db.prepare('SELECT 1 FROM login_credentials WHERE username=? COLLATE NOCASE AND user_id<>?').bind(username,s.user_id).first())fail(409,'This username is already in use.');
    const h=hashPassword(body.new_password);
    const rows=await db.batch([
      db.prepare('UPDATE login_credentials SET username=?,hash_format=?,password_hash=?,parameters_json=?,credential_version=credential_version+1,must_change_password=0,temporary_expires_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND credential_version=? AND disabled=0 AND EXISTS(SELECT 1 FROM users WHERE id=? AND disabled=0)')
        .bind(username,h.hash_format,h.password_hash,h.parameters_json,s.user_id,old.credential_version,s.user_id),
      db.prepare('UPDATE auth_sessions SET revoked_at=? WHERE user_id=? AND EXISTS(SELECT 1 FROM login_credentials WHERE user_id=? AND password_hash=?)').bind(now(),s.user_id,s.user_id,h.password_hash),
      db.prepare('DELETE FROM manager_sessions WHERE user_id=? AND EXISTS(SELECT 1 FROM login_credentials WHERE user_id=? AND password_hash=?)').bind(s.user_id,s.user_id,h.password_hash),
      db.prepare("INSERT INTO platform_audit_logs(actor_user_id,action,target_type,target_id,request_id,after_json) SELECT ?,'auth.password_changed','user',?,?,? WHERE EXISTS(SELECT 1 FROM login_credentials WHERE user_id=? AND password_hash=?)")
        .bind(s.user_id,s.user_id,requestId,JSON.stringify({username,sessions_revoked:true}),s.user_id,h.password_hash)
    ]);
    if(!rows[0].meta.changes)fail(409,'Your account changed. Sign in again.');
    return response({ok:true,next:'/login'},200,{'Set-Cookie':cookie('',0)});
  }
  const s=await requireAdmin(request,db,true);
  if(reset) {
    const userId=decodeURIComponent(reset[1]);if(userId===s.user_id)fail(400,'Use Change password for your own account.');
    const target=await credentialFor(db,userId);if(!target)fail(404,'Account not found.');
    const password=temporaryPassword(),h=hashPassword(password);
    const results=await db.batch([
      db.prepare(`UPDATE login_credentials SET hash_format=?,password_hash=?,parameters_json=?,credential_version=credential_version+1,must_change_password=1,temporary_expires_at=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND credential_version=? AND ${actorGuard()}`)
        .bind(h.hash_format,h.password_hash,h.parameters_json,now()+86400,userId,target.credential_version,...actorParams(s)),
      db.prepare('UPDATE auth_sessions SET revoked_at=? WHERE user_id=? AND EXISTS(SELECT 1 FROM login_credentials WHERE user_id=? AND password_hash=?)').bind(now(),userId,userId,h.password_hash),
      db.prepare('DELETE FROM manager_sessions WHERE user_id=? AND EXISTS(SELECT 1 FROM login_credentials WHERE user_id=? AND password_hash=?)').bind(userId,userId,h.password_hash),
      db.prepare("INSERT INTO platform_audit_logs(actor_user_id,action,target_type,target_id,request_id,after_json) SELECT ?,'auth.admin_reset','user',?,?,'{\"sessions_revoked\":true}' WHERE EXISTS(SELECT 1 FROM login_credentials WHERE user_id=? AND password_hash=?)").bind(s.user_id,userId,requestId,userId,h.password_hash)
    ]);
    if(!results[0].meta.changes)fail(409,'The account or your session changed. Sign in again.');
    return response({username:target.username,temporary_password:password,expires_in_seconds:86400});
  }
  const username=normalizeUsername(body.username),ids=body.restaurant_ids;
  if(!username||!Array.isArray(ids)||!ids.length||ids.length>10||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||id.length>100)||Object.hasOwn(body,'role'))fail(400,'Enter a username and 1–10 different restaurants.');
  if(await db.prepare('SELECT 1 FROM login_credentials WHERE username=? COLLATE NOCASE').bind(username).first())fail(409,'This username is already in use.');
  for(const id of ids)if(!await db.prepare('SELECT 1 FROM restaurants WHERE id=?').bind(id).first())fail(400,'Choose an existing restaurant.');
  const userId=crypto.randomUUID(),password=temporaryPassword(),h=hashPassword(password);
  const ops=[db.prepare(`INSERT INTO users(id,email) SELECT ?,? WHERE ${actorGuard()}`).bind(userId,`${userId}@login.admaki.invalid`,...actorParams(s)),
    db.prepare('INSERT INTO login_credentials(user_id,username,hash_format,password_hash,parameters_json,temporary_expires_at) SELECT id,?,?,?,?,? FROM users WHERE id=?').bind(username,h.hash_format,h.password_hash,h.parameters_json,now()+86400,userId),
    ...ids.map(id=>db.prepare("INSERT INTO restaurant_members(id,restaurant_id,user_id,role) SELECT ?,?,id,'manager' FROM users WHERE id=?").bind(crypto.randomUUID(),id,userId)),
    db.prepare("INSERT INTO platform_audit_logs(actor_user_id,action,target_type,target_id,request_id,after_json) SELECT ?,'auth.manager_created','user',?,?,? WHERE EXISTS(SELECT 1 FROM users WHERE id=?)")
      .bind(s.user_id,userId,requestId,JSON.stringify({username,restaurant_ids:ids}),userId)];
  const result=await db.batch(ops);if(!result[0].meta.changes)fail(409,'Your session changed. Sign in again.');
  return response({user_id:userId,username,temporary_password:password,expires_in_seconds:86400},201);
}
export async function cleanupAuth(db) {
  // Bounded indexed maintenance; never a full-table delete during a login request.
  await db.batch([
    db.prepare('DELETE FROM auth_sessions WHERE token_hash IN (SELECT token_hash FROM auth_sessions WHERE absolute_expires_at<=? ORDER BY absolute_expires_at LIMIT 500)').bind(now()),
    db.prepare('DELETE FROM auth_rate_limits WHERE key IN (SELECT key FROM auth_rate_limits WHERE expires_at<=? ORDER BY expires_at LIMIT 500)').bind(now())
  ]);
}
