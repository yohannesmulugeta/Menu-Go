import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {applyLocalMigrations} from '../cloudflare/platform/migrations.mjs';
import {validateConfig} from '../cloudflare/platform/config/validation.mjs';
import {resolveFeatures,capabilityManifest} from '../cloudflare/platform/config/resolution.mjs';
import {policies} from '../cloudflare/platform/config/service.mjs';
import {PUBLIC_ORIGIN} from '../cloudflare/platform/publications/service.mjs';
import {TEMPLATE_RELEASES} from '../cloudflare/platform/templates/render.mjs';
import worker from '../cloudflare/platform/worker.mjs';

export function percentile(values,p) {
  assert(values.length>0,'Cannot summarize an empty sample.');
  const sorted=[...values].sort((a,b)=>a-b);
  return Math.round(sorted[Math.max(0,Math.ceil(sorted.length*p)-1)]*100)/100;
}

// Real SQLite and Worker code; no network, Cloudflare CPU or billing emulation.
export async function scaleFixture(tenants,itemsPerTenant=100) {
  const db=new DatabaseSync(':memory:');applyLocalMigrations(db);
  const statements=new Map(),captured=[];
  const prepare=sql=>{if(!statements.has(sql))statements.set(sql,db.prepare(sql));return statements.get(sql);};
  const d1={prepare(sql){let args=[];const statement={bind(...a){args=a;return statement;},async first(){captured.push({sql,args});return prepare(sql).get(...args)||null;},async all(){captured.push({sql,args});return {results:prepare(sql).all(...args)};},async run(){captured.push({sql,args});return {meta:{changes:Number(prepare(sql).run(...args).changes)}};}};return statement;}};
  const policy=await policies(d1),preset=JSON.parse(db.prepare("SELECT config_json FROM config_presets WHERE preset_id='cafe' AND version=2").get().config_json);
  const restaurant=db.prepare("INSERT INTO restaurants(id,name,slug,status) VALUES(?,?,?,'active')");
  const category=db.prepare('INSERT INTO categories(id,restaurant_id,name,sort_order) VALUES(?,?,?,?)');
  const item=db.prepare('INSERT INTO menu_items(id,restaurant_id,category_id,name,description,price,sort_order) VALUES(?,?,?,?,?,?,?)');
  const publication=db.prepare('INSERT INTO restaurant_publications(restaurant_id,revision,config_revision,snapshot_json) VALUES(?,1,1,?)');
  const head=db.prepare('INSERT INTO restaurant_publication_heads(restaurant_id,revision) VALUES(?,1)');
  db.exec('BEGIN');
  try {
    for(let n=0;n<tenants;n++) {
      const id='capacity-'+n,release=TEMPLATE_RELEASES[n%TEMPLATE_RELEASES.length];
      const config=validateConfig({...preset,template_id:release.id,template_version:release.version});
      const r={id,name:'Synthetic capacity restaurant '+n,slug:id,currency:'ETB',timezone:'Africa/Addis_Ababa',status:'active'};
      restaurant.run(id,r.name,id);
      const categories=Array.from({length:10},(_,c)=>({id:id+'-c'+c,name:'Category '+c,sort_order:c}));
      for(const c of categories)category.run(c.id,id,c.name,c.sort_order);
      const items=Array.from({length:itemsPerTenant},(_,i)=>({id:id+'-i'+i,name:'Synthetic item '+n+' / '+i,description:'Example menu description for capacity measurement.',price:100+i+.45,category_id:categories[i%10].id,image_url:null,is_popular:0}));
      for(const [i,v] of items.entries())item.run(v.id,id,v.category_id,v.name,v.description,v.price,i);
      const data={categories,items,variants:[],translations:[],hours:[],timezone:r.timezone};
      const states=resolveFeatures(config,policy.byKey,release.supported_features,data);
      publication.run(id,JSON.stringify({version:1,restaurant:r,config,data,capabilities:capabilityManifest(config,states)}));head.run(id);
    }
    db.exec('COMMIT');
  } catch(error) {db.exec('ROLLBACK');throw error;}
  return {db,d1,captured,env:{ENVIRONMENT:'admaki-menu-platform-staging',DB:d1,MEDIA:{}}};
}

async function localScale() {
  const results=[];
  for(const tenants of [100,1000]) {
    const {db,captured,env}=await scaleFixture(tenants),samples=[],queryCounts=[],bytes=[];
    // Warm all layouts, then sample both a hot tenant and distributed tenants.
    for(let i=0;i<5;i++)await (await worker.fetch(new Request(PUBLIC_ORIGIN+'/r/capacity-'+i),env)).arrayBuffer();
    for(let i=0;i<100;i++) {
      const id=i<50?0:(i*19)%tenants;captured.length=0;
      const start=performance.now(),r=await worker.fetch(new Request(PUBLIC_ORIGIN+'/r/capacity-'+id),env),html=await r.text();
      samples.push(performance.now()-start);queryCounts.push(captured.length);bytes.push(Buffer.byteLength(html));
      assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/);
      assert.equal((html.match(/data-item data-category=/g)||[]).length,100);
      assert(html.includes('Synthetic item '+id+' / 99'));assert(!html.includes('Saved draft preview'));
      assert.equal(captured.length,3);
    }
    const plans=captured.map(({sql,args})=>({sql,params:args,plan:db.prepare('EXPLAIN QUERY PLAN '+sql).all(...args).map(p=>p.detail)}));
    // Policy scanning is bounded by the fixed feature catalogue, not tenant count.
    for(const q of plans)assert(!q.plan.some(p=>/^SCAN (r|h|p)(?:\s|$)/.test(p)),'Public lookup must use tenant indexes.');
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
    results.push({tenants,items:tenants*100,requests:100,errors:0,latency_ms:{median:percentile(samples,.5),p95:percentile(samples,.95),max:percentile(samples,1)},html_bytes:{min:Math.min(...bytes),max:Math.max(...bytes)},database_calls_per_html:[...new Set(queryCounts)],sqlite_bytes:Number(db.prepare('PRAGMA page_count').get().page_count)*Number(db.prepare('PRAGMA page_size').get().page_size),plans});
    db.close();
  }
  return {mode:'local-scale',scope:'Actual Worker on Node and in-memory SQLite. Sequential hot/distributed reads; not Cloudflare capacity, CPU or Ethiopia network performance.',results};
}

export async function runRate({rate,seconds=10,paths,fetcher=fetch,origin=PUBLIC_ORIGIN,timeoutMs=15000,maxInFlight=100,p95BudgetMs=3000}) {
  assert([10,25,50].includes(rate));assert(Number.isInteger(seconds)&&seconds>=1&&seconds<=30);
  assert.equal(origin,PUBLIC_ORIGIN,'Remote tests are restricted to the isolated staging host.');
  assert(Array.isArray(paths)&&paths.length>0);
  for(const p of paths)assert(p.path==='/api/health'||/^\/(?:r\/editcheck-[a-f0-9-]+(?:\/qr\.svg)?|public-media\/editcheck-[a-f0-9-]+\/[a-f0-9-]{36})$/.test(p.path),'Only staging health or known synthetic public fixtures may receive load.');
  const rows=[],pending=new Set(),start=performance.now(),run=crypto.randomUUID();let dropped=0;
  for(let i=0;i<rate*seconds;i++) {
    const due=start+i*1000/rate;await delay(Math.max(0,due-performance.now()));
    if(pending.size>=maxInFlight||performance.now()-due>1000){dropped++;continue;}
    const endpoint=paths[i%paths.length];
    const task=(async()=>{
      const began=performance.now();
      try {
        const response=await fetcher(origin+endpoint.path+'?capacity_probe='+run+'-'+i,{redirect:'error',signal:AbortSignal.timeout(timeoutMs),headers:{'Cache-Control':'no-cache'}});
        const headersMs=performance.now()-began,body=Buffer.from(await response.arrayBuffer()),type=response.headers.get('content-type')||'';
        const ok=response.status===200&&/no-store/.test(response.headers.get('cache-control')||'')&&type.includes(endpoint.type)&&(!endpoint.contains||body.toString().includes(endpoint.contains));
        rows.push({status:response.status,ok,headers_ms:headersMs,total_ms:performance.now()-began,bytes:body.length,colo:(response.headers.get('cf-ray')||'').split('-').at(-1),path:endpoint.path,...(ok?{}:{error:'Unexpected status, content, type or cache policy'})});
      } catch(error) {rows.push({status:0,ok:false,total_ms:performance.now()-began,path:endpoint.path,error:error.name+': '+error.message});}
    })();
    pending.add(task);void task.then(()=>pending.delete(task));
  }
  await Promise.all(pending);
  const elapsed=performance.now()-start,successful=rows.filter(r=>r.ok),errors=rows.length-successful.length;
  const p95=successful.length?percentile(successful.map(r=>r.total_ms),.95):null;
  return {rate,seconds,scheduled:rate*seconds,started:rows.length,dropped,errors,error_rate:rows.length?errors/rows.length:1,achieved_rps:Math.round(rows.length/(elapsed/1000)*100)/100,elapsed_ms:Math.round(elapsed),latency_ms:successful.length?{median:percentile(successful.map(r=>r.total_ms),.5),p95,max:percentile(successful.map(r=>r.total_ms),1)}:null,colos:[...new Set(rows.map(r=>r.colo).filter(Boolean))],gate:{p95_budget_ms:p95BudgetMs,max_error_rate:.01,passed:dropped===0&&rows.length>0&&errors/rows.length<=.01&&p95!==null&&p95<=p95BudgetMs},failures:rows.filter(r=>!r.ok),samples:rows};
}

async function remoteLoad(manifest) {
  const {readFile}=await import('node:fs/promises');const paths=JSON.parse(await readFile(manifest,'utf8')).paths;
  const health=await fetch(PUBLIC_ORIGIN+'/api/health?capacity_probe='+crypto.randomUUID(),{signal:AbortSignal.timeout(15000),redirect:'error'});
  assert.equal(health.status,200);assert.equal((await health.json()).environment,'staging');
  const results=[];
  for(const rate of [10,25,50]) {
    const result=await runRate({rate,paths});results.push(result);
    console.log(JSON.stringify({rate,requests:result.started,errors:result.errors,dropped:result.dropped,latency_ms:result.latency_ms,gate:result.gate}));
    if(!result.gate.passed)break;
    await delay(1000);
  }
  return {mode:'remote-load',origin:PUBLIC_ORIGIN,scope:'Single client/region, 10-second arrival windows, at most 100 simultaneous read-only HTTP requests. Retained tiny synthetic publication; no browser execution, guest writes, login, upload or multi-region certification. Gate is a provisional engineering budget.',results};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  const [mode,output,manifest]=process.argv.slice(2);assert(output,'Supply an output JSON path.');
  const started=new Date().toISOString();
  const result=mode==='local'?await localScale():mode==='remote'?await remoteLoad(manifest):mode==='control'?{mode:'remote-health-control',scope:'Same load generator and staging host, environment-check query only; no menu projection or R2.',results:[await runRate({rate:10,paths:[{path:'/api/health',type:'application/json',contains:'"environment":"staging"'}]})]}:assert.fail('Choose local, remote or control.');
  await writeFile(output,JSON.stringify({started_utc:started,finished_utc:new Date().toISOString(),...result},null,2)+'\n');
  console.log(JSON.stringify({output,results:result.results.map(({samples,plans,...r})=>{void samples;void plans;return r;})}));
  if(result.results.some(r=>r.gate&&!r.gate.passed))process.exitCode=1;
}
