// Operator test: private credentials stay in a mode-0600 state file outside Git.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomBytes,createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {resolve,relative,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {applyLocalMigrations} from '../cloudflare/platform/migrations.mjs';
import {hashPassword} from '../cloudflare/platform/auth/passwords.mjs';
import {validateConfig} from '../cloudflare/platform/config/validation.mjs';
import {PUBLIC_ORIGIN} from '../cloudflare/platform/publications/service.mjs';
import {syntheticPNG} from './staging-capacity-fixtures.mjs';
import {percentile} from './menu-capacity.mjs';

const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function save(path,value){writeFileSync(path,JSON.stringify(value,null,2)+'\n',{mode:0o600});}
export async function drainJobs(jobs,concurrency) {
  assert([1,3].includes(concurrency));const results=[],queue=[...jobs],failures=[];
  await Promise.all(Array.from({length:concurrency},async()=>{while(queue.length&&!failures.length){try{results.push(await queue.shift()());}catch(error){failures.push(error);}}}));
  return {results,failures};
}
export function prepareAuthUploadState() {
  const db=new DatabaseSync(':memory:');applyLocalMigrations(db);const preset=validateConfig(JSON.parse(db.prepare("SELECT config_json FROM config_presets WHERE preset_id='cafe' AND version=2").get().config_json));db.close();
  const tag=randomBytes(6).toString('hex'),queries=[],accounts=[];
  for(let i=0;i<3;i++) {
    const id='authload-'+tag+'-'+i,restaurantId=crypto.randomUUID(),slug='editcheck-'+tag+'-'+i,password=randomBytes(32).toString('base64url'),h=hashPassword(password);
    queries.push({sql:'INSERT INTO users(id,email) VALUES(?,?)',params:[id,id+'@example.invalid']},{sql:'INSERT INTO login_credentials(user_id,username,hash_format,password_hash,parameters_json,must_change_password,temporary_expires_at) VALUES(?,?,?,?,?,0,?)',params:[id,id,h.hash_format,h.password_hash,h.parameters_json,Math.floor(Date.now()/1000)+7200]},{sql:"INSERT INTO restaurants(id,name,slug,status) VALUES(?,?,?,'draft')",params:[restaurantId,'Disposable auth/upload '+i,slug]},{sql:"INSERT INTO restaurant_members(id,restaurant_id,user_id,role) VALUES(?,?,?,'manager')",params:[crypto.randomUUID(),restaurantId,id]},{sql:'INSERT INTO restaurant_configs(restaurant_id,schema_version,template_id,template_version,features_json,theme_json,content_settings_json) VALUES(?,2,?,?,?,?,?)',params:[restaurantId,preset.template_id,preset.template_version,JSON.stringify(preset.features),JSON.stringify(preset.theme),JSON.stringify(preset.content_settings)]});
    accounts.push({id,username:id,password,restaurantId,slug,images:[]});
  }
  return {tag,created_utc:new Date().toISOString(),accounts,seedQueries:queries};
}
async function run(statePath,state,uploadOnly=false) {
  const output={started_utc:new Date().toISOString(),origin:PUBLIC_ORIGIN,scope:'Three isolated managers/tenants. Bounded actual login/upload HTTP tests from the operator executor. Wall times include its outbound network/proxy; no independent-network or large-login-capacity claim.',phases:[],checks:[],cleanup:[]};
  const checkpoint=()=>save(statePath,state);
  async function request(path,{method='GET',body,bytes,token,headers={}}={}) {
    assert(path==='/api/auth/login'||path==='/api/auth/logout'||path==='/api/auth/session'||path==='/api/platform/users'||/^\/api\/restaurants\/[a-f0-9-]{36}\/(config|media(?:\/[a-f0-9-]{36})?)(?:\?kind=logo)?$/.test(path));
    const start=performance.now(),response=await fetch(PUBLIC_ORIGIN+path,{method,redirect:'error',signal:AbortSignal.timeout(30000),headers:{...(token?{Cookie:'__Host-admaki_menu='+token}:{}),...(method!=='GET'?{Origin:PUBLIC_ORIGIN,'X-Menu-Request':'1','Content-Type':bytes?'image/png':'application/json'}:{}),...headers},body:bytes||(body?JSON.stringify(body):undefined)});
    const data=Buffer.from(await response.arrayBuffer());let json=null;try{json=JSON.parse(data);}catch{/* Image response. */}
    return {status:response.status,json,bytes:data,cookie:response.headers.get('set-cookie'),retry_after:response.headers.get('retry-after'),latency_ms:performance.now()-start};
  }
  async function login(account,expected=200,password=account.password) {
    const r=await request('/api/auth/login',{method:'POST',body:{username:account.username,password}});assert.equal(r.status,expected,'Unexpected synthetic login status');
    if(expected===200){assert.equal(r.json.role,'manager');assert.equal(r.json.restaurants.length,1);assert.equal(r.json.restaurants[0].id,account.restaurantId);const token=/__Host-admaki_menu=([a-f0-9]{64})/.exec(r.cookie||'')?.[1];assert(token);account.token=token;checkpoint();}
    return r;
  }
  async function phase(name,jobs,concurrency) {
    const started_utc=new Date().toISOString();
    // Drain in-flight requests before cleanup; an early rejection must not race logout.
    const {results,failures}=await drainJobs(jobs,concurrency);
    const times=results.map(r=>r.latency_ms);const record={name,started_utc,finished_utc:new Date().toISOString(),requests:results.length+failures.length,unexpected_failures:failures.length,concurrency,statuses:results.reduce((a,r)=>{a[r.status]=(a[r.status]||0)+1;return a;},{}),latency_ms:times.length?{median:percentile(times,.5),p95:percentile(times,.95),max:percentile(times,1)}:null};output.phases.push(record);console.log(JSON.stringify(record));if(failures.length)throw failures[0];return results;
  }
  try {
    if(!uploadOnly) {
    const loginWindow=Math.floor(Date.now()/900000);
    await phase('login-sequential',Array.from({length:9},(_,i)=>()=>login(state.accounts[i%3])),1);
    await phase('login-concurrent',Array.from({length:9},(_,i)=>()=>login(state.accounts[i%3])),3);
    const wrong=await login(state.accounts[1],401,'Deliberately incorrect synthetic passphrase 902');
    const unknown=await request('/api/auth/login',{method:'POST',body:{username:'unknown-'+state.tag,password:'Deliberately incorrect synthetic passphrase 902'}});assert.equal(unknown.status,401);assert.equal(wrong.json.error,unknown.json.error);output.checks.push('Generic incorrect/unknown-account errors');
    const denied=await request('/api/platform/users',{token:state.accounts[1].token});assert.equal(denied.status,403);
    const foreign=await request('/api/restaurants/'+state.accounts[0].restaurantId+'/config',{token:state.accounts[1].token});assert.equal(foreign.status,404);output.checks.push('Managers have no platform privileges or cross-tenant access');
    // Account zero has six prior attempts; nine more are allowed, the sixteenth is denied.
    for(let i=0;i<9;i++)await login(state.accounts[0]);assert.equal(Math.floor(Date.now()/900000),loginWindow,'Login rate-limit test crossed a time-window boundary; results incomplete');const limited=await login(state.accounts[0],429);assert.equal(limited.retry_after,'900');output.checks.push('Sixteenth account login attempt returns 429/Retry-After without resetting rate limits');
    } else {
      output.scope+=' Upload-only continuation uses operator-issued scoped test sessions; it does not certify login.';
      for(const account of state.accounts){const r=await request('/api/auth/session',{token:account.token});assert.equal(r.status,200);assert.equal(r.json.role,'manager');assert.equal(r.json.restaurants.length,1);assert.equal(r.json.restaurants[0].id,account.restaurantId);}
    }
    for(const account of state.accounts){const r=await request('/api/restaurants/'+account.restaurantId+'/config',{token:account.token});assert.equal(r.status,200);account.revision=r.json.revision;account.policy_revision=r.json.policy_revision;}
    async function upload(account,seed=1,expected=201) {
      const bytes=syntheticPNG(320,240,seed),r=await request('/api/restaurants/'+account.restaurantId+'/media?kind=logo',{method:'POST',bytes,token:account.token});assert.equal(r.status,expected,'Unexpected synthetic upload status');if(expected===201){account.images.push({id:r.json.id,url:r.json.url,size_bytes:r.json.size_bytes,sha256:createHash('sha256').update(bytes).digest('hex')});checkpoint();}return r;
    }
    await phase('upload-sequential',state.accounts.map((account,i)=>()=>upload(account,i+1)),1);
    await phase('upload-concurrent',Array.from({length:9},(_,i)=>()=>upload(state.accounts[i%3],i+10)),3);
    for(const account of state.accounts){const image=account.images[0],r=await request(new URL(image.url).pathname,{token:account.token});assert.equal(r.status,200);assert.equal(createHash('sha256').update(r.bytes).digest('hex'),image.sha256);assert.equal(r.bytes.length,image.size_bytes);}
    output.checks.push('Authenticated R2 image round trips match expected SHA-256 and length');
    const path='/api/restaurants/'+state.accounts[1].restaurantId+'/media?kind=logo',token=state.accounts[1].token;
    assert.equal((await request(path,{method:'POST',token,bytes:Buffer.from('<svg/>')})).status,415);
    assert.equal((await request(path,{method:'POST',token,bytes:syntheticPNG(2,2),headers:{Origin:'https://other.invalid'}})).status,403);
    assert.equal((await request(path,{method:'POST',token,bytes:Buffer.alloc(5242881)})).status,413);
    assert.equal((await request(path,{method:'POST',token:state.accounts[0].token,bytes:syntheticPNG(2,2)})).status,404);output.checks.push('Invalid image, cross-origin, oversize and cross-tenant uploads denied');
    // Four accepted uploads so far; 16 more reach the existing 20-image quota.
    for(let i=0;i<16;i++)await upload(state.accounts[0],100+i);await upload(state.accounts[0],999,409);output.checks.push('Twenty accepted uploads/account; next upload denied without lifting quota');
    output.passed=true;
  } catch(error) {output.passed=false;output.failure={name:error.name,message:error.message};}
  finally {
    for(const account of state.accounts) {
      for(const image of account.images.filter(i=>!i.deleted)) {
        try {const r=await request('/api/restaurants/'+account.restaurantId+'/media/'+image.id,{method:'DELETE',token:account.token,body:{revision:account.revision,policy_revision:account.policy_revision}});image.deleted=r.status===200;if(!image.deleted)output.cleanup.push({image_id:image.id,status:r.status});checkpoint();}catch(error){output.cleanup.push({image_id:image.id,error:error.name});}
      }
      if(account.token){try{const r=await request('/api/auth/logout',{method:'POST',body:{},token:account.token});assert.equal(r.status,200);assert.equal((await request('/api/restaurants/'+account.restaurantId+'/config',{token:account.token})).status,401);output.checks.push('Logout revokes synthetic manager access');}catch(error){output.cleanup.push({account:account.id,error:error.name});}}
    }
  }
  output.finished_utc=new Date().toISOString();output.accepted_uploads=state.accounts.reduce((n,a)=>n+a.images.length,0);output.deleted_uploads=state.accounts.reduce((n,a)=>n+a.images.filter(i=>i.deleted).length,0);return output;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [mode,statePath,outputPath]=process.argv.slice(2);assert(statePath);const path=resolve(statePath),rel=relative(repo,path);assert(rel==='..'||rel.startsWith('..'+sep),'Keep private credentials outside Git.');
  if(mode==='prepare'){const state=prepareAuthUploadState();save(path,state);console.log(JSON.stringify({tag:state.tag,accounts:state.accounts.length,queries:state.seedQueries.length}));}
  else if(mode==='run'||mode==='upload-only'){assert(outputPath);const state=JSON.parse(readFileSync(path,'utf8')),result=await run(path,state,mode==='upload-only');writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));if(!result.passed||result.cleanup.length)process.exitCode=1;}
  else assert.fail('Choose prepare, run or upload-only.');
}
