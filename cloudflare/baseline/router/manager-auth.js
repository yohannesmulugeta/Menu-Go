export const SESSION_COOKIE = '__Host-admaki_menu_manager';
const ITERATIONS = 100000, TTL = 8 * 3600;
const encoder = new TextEncoder();
const hex = bytes => Array.from(new Uint8Array(bytes), b=>b.toString(16).padStart(2,'0')).join('');
export const randomToken = (size=32) => hex(crypto.getRandomValues(new Uint8Array(size)));
export const digest = async value => hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
export async function passwordHash(password, salt, iterations=ITERATIONS) {
  const key = await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations},key,256));
}
const equal = (a,b) => {let mismatch=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++) mismatch|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return mismatch===0;};
export function hasManagerCookie(request) {return request.headers.get('Cookie')?.split(';').some(c=>c.trim().startsWith(SESSION_COOKIE+'=')) || false;}
export async function managerSession(request, env) {
  const token=request.headers.get('Cookie')?.split(';').map(c=>c.trim()).find(c=>c.startsWith(SESSION_COOKIE+'='))?.slice(SESSION_COOKIE.length+1);
  if(!token || !/^[a-f0-9]{64}$/.test(token))return null;
  return env.DB.prepare(`SELECT c.user_id,c.restaurant_id,c.username,c.password_version,c.must_change_password,u.email,
    s.token_hash,s.expires_at FROM manager_sessions s JOIN manager_credentials c ON c.user_id=s.user_id
    JOIN users u ON u.id=c.user_id
    JOIN restaurant_members m ON m.user_id=c.user_id AND m.restaurant_id=c.restaurant_id AND m.role='manager'
    WHERE s.token_hash=? AND s.expires_at>? AND s.password_version=c.password_version AND c.disabled=0 AND u.disabled=0`)
    .bind(await digest(token),Math.floor(Date.now()/1000)).first();
}
export function managerIdentity(session) {
  return {email:session.username,subject:session.user_id,user:{id:session.user_id,email:session.email,disabled:0}};
}
const cookie = (token,ttl=TTL) => `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${ttl}; Secure; HttpOnly; SameSite=Strict`;
export const json = (data,status=200,extra={}) => new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...extra}});
const fail = (status,message) => {throw Object.assign(new Error(message),{status});};
async function input(request) {
  if(request.headers.get('Origin')!==new URL(request.url).origin || request.headers.get('X-Menu-Request')!=='1')fail(403,'Request origin is not allowed.');
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))fail(415,'Send JSON.');
  const reader=request.body?.getReader(); if(!reader)fail(400,'Enter your login details.');
  let size=0; const chunks=[];
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();fail(413,'Request too large.');}chunks.push(value);}
  let body;try{const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}body=JSON.parse(new TextDecoder().decode(bytes));}catch{fail(400,'Invalid request.');}
  if(!body || typeof body!=='object' || Array.isArray(body))fail(400,'Invalid request.');return body;
}
async function rateLimit(env, key, limit, window=900) {
  const now=Math.floor(Date.now()/1000),bucket=Math.floor(now/window);
  const r=await env.DB.prepare('INSERT INTO manager_auth_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count')
    .bind(await digest(`${bucket}:${key}`),(bucket+1)*window).first();
  if(r.count>limit)fail(429,'Too many attempts. Try again in 15 minutes.');
}
async function newSession(env, credential) {
  const token=randomToken();
  await env.DB.prepare('INSERT INTO manager_sessions(token_hash,user_id,password_version,expires_at) VALUES(?,?,?,?)')
    .bind(await digest(token),credential.user_id,credential.password_version,Math.floor(Date.now()/1000)+TTL).run();
  return token;
}
function next(session) {return session.must_change_password?'/manager/change-password':`/#/admin/${encodeURIComponent(session.restaurant_id)}`;}
export async function managerAuthRoute(request, env) {
  const path=new URL(request.url).pathname;
  try {
    if(path==='/manager/api/session' && request.method==='GET') {
      const s=await managerSession(request,env);
      return json(s?{username:s.username,restaurant_id:s.restaurant_id,must_change_password:!!s.must_change_password,next:next(s)}:null);
    }
    if(!['/manager/api/login','/manager/api/password','/manager/api/logout'].includes(path))return null;
    if(request.method!=='POST')return json({error:'Method not allowed.'},405,{Allow:'POST'});
    const body=await input(request);
    if(path==='/manager/api/logout') {
      const s=await managerSession(request,env);
      if(s)await env.DB.prepare('DELETE FROM manager_sessions WHERE token_hash=?').bind(s.token_hash).run();
      return json({ok:true},200,{'Set-Cookie':cookie('',0)});
    }
    if(path==='/manager/api/login') {
      const username=typeof body.username==='string'?body.username.trim().toLowerCase():'';
      const password=typeof body.password==='string'?body.password:'';
      const ip=request.headers.get('CF-Connecting-IP')||'unknown';
      await rateLimit(env,'login-ip:'+ip,60);
      if(!/^[a-z0-9][a-z0-9._-]{2,47}$/.test(username)||password.length>256)fail(401,'Incorrect username or password.');
      await rateLimit(env,'login-account:'+username,20);
      const c=await env.DB.prepare(`SELECT c.*,u.disabled AS user_disabled FROM manager_credentials c JOIN users u ON u.id=c.user_id
        JOIN restaurant_members m ON m.user_id=c.user_id AND m.restaurant_id=c.restaurant_id AND m.role='manager' WHERE c.username=? COLLATE NOCASE`).bind(username).first();
      const hash=await passwordHash(password,c?.salt||'unknown-user-timing-salt',c?.iterations||ITERATIONS);
      if(!c||c.disabled||c.user_disabled||!equal(hash,c.password_hash))fail(401,'Incorrect username or password.');
      const existing=await managerSession(request,env);
      if(existing)await env.DB.prepare('DELETE FROM manager_sessions WHERE token_hash=?').bind(existing.token_hash).run();
      const token=await newSession(env,c);
      await env.DB.prepare('DELETE FROM manager_sessions WHERE expires_at<=?').bind(Math.floor(Date.now()/1000)).run();
      await env.DB.prepare('DELETE FROM manager_auth_limits WHERE expires_at<=?').bind(Math.floor(Date.now()/1000)).run();
      return json({ok:true,username:c.username,must_change_password:!!c.must_change_password,next:next(c)},200,{'Set-Cookie':cookie(token)});
    }
    const s=await managerSession(request,env);if(!s)fail(401,'Sign in to your manager account.');
    await rateLimit(env,'password:'+s.user_id,10);
    const old=await env.DB.prepare('SELECT * FROM manager_credentials WHERE user_id=? AND disabled=0').bind(s.user_id).first();
    const current=typeof body.current_password==='string'?body.current_password:'';
    if(!old || current.length>256 || !equal(await passwordHash(current,old.salt,old.iterations),old.password_hash))fail(400,'The current password is incorrect.');
    const password=body.new_password,username=typeof body.username==='string'?body.username.trim().toLowerCase():old.username;
    if(typeof password!=='string'||password.length<12||password.length>256)fail(400,'Use a password between 12 and 256 characters.');
    if(password===current)fail(400,'Choose a different password.');
    if(!/^[a-z0-9][a-z0-9._-]{2,47}$/.test(username))fail(400,'Use 3–48 lowercase letters, numbers, dots, hyphens or underscores.');
    const taken=await env.DB.prepare('SELECT user_id FROM manager_credentials WHERE username=? COLLATE NOCASE AND user_id<>?').bind(username,s.user_id).first();
    if(taken)fail(409,'This username is already in use.');
    const salt=randomToken(24),hash=await passwordHash(password,salt),token=randomToken(),tokenHash=await digest(token),version=old.password_version+1;
    // D1 batch commits the credential update, revocation, replacement session and audit together.
    const results=await env.DB.batch([
      env.DB.prepare('UPDATE manager_credentials SET username=?,password_hash=?,salt=?,iterations=?,password_version=password_version+1,must_change_password=0,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND password_version=?')
        .bind(username,hash,salt,ITERATIONS,s.user_id,old.password_version),
      env.DB.prepare('DELETE FROM manager_sessions WHERE user_id=? AND (SELECT password_hash FROM manager_credentials WHERE user_id=?)=?').bind(s.user_id,s.user_id,hash),
      env.DB.prepare('INSERT INTO manager_sessions(token_hash,user_id,password_version,expires_at) SELECT ?,user_id,password_version,? FROM manager_credentials WHERE user_id=? AND password_hash=?')
        .bind(tokenHash,Math.floor(Date.now()/1000)+TTL,s.user_id,hash),
      env.DB.prepare("INSERT INTO audit_logs(restaurant_id,actor_user_id,action,entity_type,entity_id,new_data) SELECT ?,?,'manager.password_changed','user',?,? WHERE EXISTS(SELECT 1 FROM manager_credentials WHERE user_id=? AND password_hash=?)")
        .bind(s.restaurant_id,s.user_id,s.user_id,JSON.stringify({username,sessions_revoked:true}),s.user_id,hash)
    ]);
    if(!results[0].meta.changes)fail(409,'Your account changed. Sign in again.');
    return json({ok:true,next:next({...s,must_change_password:0}),username},200,{'Set-Cookie':cookie(token)});
  } catch(error) {
    if(error.status)return json({error:error.message},error.status);
    console.error('Manager authentication failed',{name:error?.name||'Error'});
    return json({error:'Unable to sign in right now. Please try again.'},503);
  }
}
