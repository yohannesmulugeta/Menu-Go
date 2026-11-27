import {env,exports} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {it,expect,beforeAll} from 'vitest';
import {deflateSync} from 'node:zlib';
import {hashPassword,digest} from '../cloudflare/platform/auth/passwords.mjs';
import {pngChunk} from '../cloudflare/platform/media/png.mjs';

const origin='https://staging.invalid',password='Private runtime test coffee 723';
const call=async(path,{method='GET',body,bytes,cookie,headers={}}={})=>exports.default.fetch(new Request(origin+path,{method,headers:{'CF-Connecting-IP':'192.0.2.21',...(cookie?{Cookie:cookie}:{}),...(method!=='GET'?{Origin:origin,'X-Menu-Request':'1','Content-Type':bytes?'image/png':'application/json'}:{}),...headers},body:bytes||(body?JSON.stringify(body):undefined)}));
const login=async(username,p=password)=>{const r=await call('/api/auth/login',{method:'POST',body:{username,password:p}});expect(r.status).toBe(200);const data=await r.json();expect(r.headers.get('Set-Cookie')).toContain('Secure; HttpOnly; SameSite=Strict');return {cookie:r.headers.get('Set-Cookie').split(';')[0],data};};
const png=()=>{const h=Buffer.alloc(13);h.writeUInt32BE(320);h.writeUInt32BE(240,4);h[8]=8;h[9]=6;const raw=Buffer.alloc((320*4+1)*240,123);for(let y=0;y<240;y++)raw[y*(320*4+1)]=0;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),pngChunk('IHDR',h),pngChunk('IDAT',deflateSync(raw)),pngChunk('IEND',Buffer.alloc(0))]);};
beforeAll(async()=>{
  await applyD1Migrations(env.DB,env.TEST_MIGRATIONS);
  // The app tracks checksums separately from the test helper's d1_migrations.
  await env.DB.prepare('CREATE TABLE schema_migrations(name TEXT PRIMARY KEY,sha256 TEXT NOT NULL)').run();
  await env.DB.batch(env.TEST_MIGRATIONS.map(m=>env.DB.prepare('INSERT INTO schema_migrations(name,sha256) VALUES(?,?)').bind(m.name,'local-rpc-fixture')));
  for(const [id,admin] of [['rpc-owner',true],['rpc-manager',false]]){
    const h=hashPassword(password);
    await env.DB.batch([
      env.DB.prepare('INSERT INTO users(id,email) VALUES(?,?)').bind(id,id+'@example.invalid'),
      env.DB.prepare('INSERT INTO login_credentials(user_id,username,hash_format,password_hash,parameters_json,must_change_password) VALUES(?,?,?,?,?,0)').bind(id,id,h.hash_format,h.password_hash,h.parameters_json),
      admin?env.DB.prepare('INSERT INTO platform_admins(user_id) VALUES(?)').bind(id):env.DB.prepare("INSERT INTO restaurant_members(id,restaurant_id,user_id,role) VALUES(?,'staging-demo',?,'manager')").bind(id,id)
    ]);
  }
});

it('keeps secure auth, session revocation, tenant rules and image quotas across actual Durable Object RPC',async()=>{
  expect((await call('/api/health')).status).toBe(200);
  // Actual Request/Response streams cross the RPC boundary, including Set-Cookie.
  const concurrent=await Promise.all(Array.from({length:3},()=>login('rpc-manager')));
  const manager=concurrent[0],owner=await login('rpc-owner');
  expect(manager.data.role).toBe('manager');expect(owner.data.role).toBe('super_admin');
  expect((await call('/api/platform/users',{cookie:manager.cookie})).status).toBe(403);
  expect((await call('/api/restaurants/foreign/media?kind=logo',{method:'POST',bytes:png(),cookie:manager.cookie})).status).toBe(404);
  const wrong=await call('/api/auth/login',{method:'POST',body:{username:'rpc-manager',password:'incorrect'}});
  const missing=await call('/api/auth/login',{method:'POST',body:{username:'unknown-person',password:'incorrect'}});
  expect(wrong.status).toBe(401);expect(await wrong.json()).toEqual(await missing.json());
  expect((await call('/api/auth/login',{method:'POST',body:{username:'rpc-manager',password},headers:{Origin:'https://evil.invalid'}})).status).toBe(403);

  const created=await call('/api/platform/users',{method:'POST',cookie:owner.cookie,body:{username:'rpc-created',restaurant_ids:['staging-demo']}});
  expect(created.status).toBe(201);const account=await created.json();expect(account.temporary_password).toMatch(/^\d{6}$/);const first=await login('rpc-created',account.temporary_password);
  expect(first.data.must_change_password).toBe(true);
  const changed=await call('/api/auth/password',{method:'POST',cookie:first.cookie,body:{current_password:account.temporary_password,new_password:account.temporary_password==='483927'?'592836':'483927'}});
  expect(changed.status).toBe(200);
  expect(await(await call('/api/auth/session',{cookie:first.cookie})).json()).toBe(null);
  const renewed=await login('rpc-created','Another private test coffee 823');
  const reset=await call('/api/platform/users/'+account.user_id+'/reset-password',{method:'POST',cookie:owner.cookie,body:{}});
  expect(reset.status).toBe(200);expect(await(await call('/api/auth/session',{cookie:renewed.cookie})).json()).toBe(null);
  const credential=await env.DB.prepare('SELECT * FROM login_credentials WHERE user_id=?').bind(account.user_id).first();
  expect(credential.hash_format).toBe('scrypt-v1');expect(JSON.parse(credential.parameters_json)).toMatchObject({N:16384,r:8,p:5});

  const path='/api/restaurants/staging-demo/media?kind=logo',bytes=png();
  const images=await Promise.all(Array.from({length:3},async()=>{const r=await call(path,{method:'POST',cookie:manager.cookie,bytes});expect(r.status).toBe(201);return r.json();}));
  const image=await call(new URL(images[0].url).pathname,{cookie:manager.cookie});expect(image.status).toBe(200);expect(digest(Buffer.from(await image.arrayBuffer()))).toBe(digest(bytes));
  expect((await call(path,{method:'POST',cookie:manager.cookie,bytes:Buffer.from('<svg/>')})).status).toBe(415);
  expect((await call(path,{method:'POST',cookie:manager.cookie,bytes,headers:{Origin:'https://evil.invalid'}})).status).toBe(403);
  expect((await call(path,{method:'POST',cookie:manager.cookie,bytes:Buffer.alloc(5242881)})).status).toBe(413);
  for(let i=3;i<20;i++)expect((await call(path,{method:'POST',cookie:manager.cookie,bytes})).status).toBe(201);
  expect((await call(path,{method:'POST',cookie:manager.cookie,bytes})).status).toBe(409);
  // Four prior manager attempts (three successful and one wrong; the forbidden
  // origin never reaches throttling); the query uses the actual existing count.
  const key=digest(`${Math.floor(Date.now()/900000)}:login-account:rpc-manager`);
  let attempts=(await env.DB.prepare('SELECT count FROM auth_rate_limits WHERE key=?').bind(key).first()).count;
  while(attempts++<15)await login('rpc-manager');
  const limited=await call('/api/auth/login',{method:'POST',body:{username:'rpc-manager',password}});expect(limited.status).toBe(429);expect(limited.headers.get('Retry-After')).toBe('900');
  expect((await call('/api/auth/logout',{method:'POST',cookie:manager.cookie,body:{}})).status).toBe(200);
  expect(await(await call('/api/auth/session',{cookie:manager.cookie})).json()).toBe(null);
  const denied=await env.PRIVATE_OPERATIONS.getByName('test-direct').dispatch(new Request(origin+'/api/platform/users'));
  expect(denied.status).toBe(404);
});
