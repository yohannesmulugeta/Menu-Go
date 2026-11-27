// Operator-only preparation. State is private and must stay outside the repository.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,relative,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {deflateSync} from 'node:zlib';
import {applyLocalMigrations} from '../cloudflare/platform/migrations.mjs';
import {validateConfig} from '../cloudflare/platform/config/validation.mjs';
import {pngChunk,validatePNG} from '../cloudflare/platform/media/png.mjs';
import {hashPassword,digest,randomToken} from '../cloudflare/platform/auth/passwords.mjs';
import {PUBLIC_ORIGIN} from '../cloudflare/platform/publications/service.mjs';

const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export function syntheticPNG(width,height,seed=1) {
  const raw=Buffer.alloc((width*4+1)*height);let noise=seed;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {noise=(Math.imul(noise,1664525)+1013904223)>>>0;const at=y*(width*4+1)+1+x*4;raw[at]=x%256;raw[at+1]=y%256;raw[at+2]=noise>>>24;raw[at+3]=255;}
  const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
  return validatePNG(Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),pngChunk('IHDR',header),pngChunk('IDAT',deflateSync(raw)),pngChunk('IEND',Buffer.alloc(0))])).bytes;
}
function save(path,state){writeFileSync(path,JSON.stringify(state,null,2)+'\n',{mode:0o600});}
function bulk(table,columns,rows,queries) {
  for(let offset=0;offset<rows.length;offset+=10){const chunk=rows.slice(offset,offset+10);queries.push({sql:'INSERT INTO '+table+'('+columns.join(',')+') VALUES '+chunk.map(()=> '('+columns.map(()=>'?').join(',')+')').join(','),params:chunk.flat()});}
}
export function prepareFixtureState() {
  const db=new DatabaseSync(':memory:');applyLocalMigrations(db);const preset=JSON.parse(db.prepare("SELECT config_json FROM config_presets WHERE preset_id='cafe' AND version=2").get().config_json);db.close();
  const tag=randomBytes(6).toString('hex'),userId='capacity-'+tag,sessionToken=randomToken(),credential=hashPassword(randomBytes(32).toString('base64url')),time=Math.floor(Date.now()/1000),queries=[];
  queries.push({sql:'INSERT INTO users(id,email) VALUES(?,?)',params:[userId,userId+'@example.invalid']});
  queries.push({sql:'INSERT INTO login_credentials(user_id,username,hash_format,password_hash,parameters_json,must_change_password,temporary_expires_at) VALUES(?,?,?,?,?,0,?)',params:[userId,userId,credential.hash_format,credential.password_hash,credential.parameters_json,time+7200]});
  queries.push({sql:'INSERT INTO auth_sessions(token_hash,user_id,credential_version,created_at,idle_expires_at,absolute_expires_at,reauthenticated_at) VALUES(?,?,1,?,?,?,?)',params:[digest(sessionToken),userId,time,time+3600,time+3600,time]});
  const fixtures=['classic','mokodo','occasion'].map((template,index)=>{
    const id=crypto.randomUUID(),slug='editcheck-'+tag+'-'+index;
    const config=validateConfig({...structuredClone(preset),template_id:template,template_version:template==='classic'?2:1,features:{...preset.features,'menu.variants':true,'guest.language':true,'guest.hours':true,'guest.feedback':false,'analytics.collection':false},content_settings:{...structuredClone(preset.content_settings),languages:['en','am'],story:'Disposable synthetic capacity menu. No orders or real restaurant data.',pricing:{mode:'custom',vat_rate:null,service_rate:null,text:'Synthetic test prices only.',placement:'bottom'}}});
    queries.push({sql:"INSERT INTO restaurants(id,name,slug,status) VALUES(?,?,?,'draft')",params:[id,'Synthetic capacity '+template,slug]});
    queries.push({sql:'INSERT INTO restaurant_members(id,restaurant_id,user_id,role) VALUES(?,?,?,\'manager\')',params:[crypto.randomUUID(),id,userId]});
    queries.push({sql:'INSERT INTO restaurant_configs(restaurant_id,schema_version,template_id,template_version,features_json,theme_json,content_settings_json) VALUES(?,2,?,?,?,?,?)',params:[id,config.template_id,config.template_version,JSON.stringify(config.features),JSON.stringify(config.theme),JSON.stringify(config.content_settings)]});
    const categories=Array.from({length:10},(_,i)=>[crypto.randomUUID(),id,'Synthetic category '+(i+1),i]);bulk('categories',['id','restaurant_id','name','sort_order'],categories,queries);
    const items=Array.from({length:100},(_,i)=>[crypto.randomUUID(),id,categories[i%10][0],'Capacity test item '+(i+1),'Synthetic description for menu load testing.',100+i+.45,i,Number(i%10===0)]);bulk('menu_items',['id','restaurant_id','category_id','name','description','price','sort_order','is_popular'],items,queries);
    bulk('menu_item_variants',['id','restaurant_id','menu_item_id','label','price_minor'],items.slice(0,20).map(v=>[crypto.randomUUID(),id,v[0],'Synthetic large',25075]),queries);
    bulk('menu_item_translations',['restaurant_id','menu_item_id','locale','name','description'],items.map((v,i)=>[id,v[0],'am','የሙከራ እቃ '+(i+1),'የሙከራ ምናሌ']),queries);
    bulk('opening_hours',['id','restaurant_id','weekday','opens_at','closes_at','is_closed'],Array.from({length:7},(_,i)=>[crypto.randomUUID(),id,i,'08:00','18:00',0]),queries);
    const images=[{kind:'cover',width:640,height:320,seed:index*10+1},{kind:'logo',width:128,height:128,seed:index*10+2},...items.slice(0,4).map((item,i)=>({kind:'item',item_id:item[0],width:320,height:240,seed:index*10+i+3}))];
    return {id,slug,template,items:100,categories:10,variants:20,translations:100,images};
  });
  assert.equal(fixtures.reduce((n,f)=>n+f.images.length,0),18,'Stay below the existing 20 uploads/account/15min quota.');
  return {tag,userId,sessionToken,created_utc:new Date().toISOString(),fixtures,seedQueries:queries};
}
async function provision(path,state) {
  async function call(route,{method='GET',body,bytes}={}) {
    assert(route.startsWith('/api/restaurants/'));
    const response=await fetch(PUBLIC_ORIGIN+route,{method,redirect:'error',signal:AbortSignal.timeout(45000),headers:{Cookie:'__Host-admaki_menu='+state.sessionToken,...(method!=='GET'?{Origin:PUBLIC_ORIGIN,'X-Menu-Request':'1','Content-Type':bytes?'image/png':'application/json'}:{})},body:bytes||(body?JSON.stringify(body):undefined)});
    const data=await response.json();if(!response.ok)throw Error(method+' '+route+' HTTP '+response.status+': '+data.error);return data;
  }
  // Three independent tenants; mutations within each tenant remain sequential.
  const outcomes=await Promise.allSettled(state.fixtures.map(async fixture=>{
    const base='/api/restaurants/'+fixture.id;let saved=await call(base+'/config');
    for(const image of fixture.images) {
      if(!image.uploaded) {
        const bytes=syntheticPNG(image.width,image.height,image.seed);
        image.sha256=createHash('sha256').update(bytes).digest('hex');
        image.uploaded=await call(base+'/media?kind='+image.kind+(image.item_id?'&item_id='+image.item_id:''),{method:'POST',bytes});save(path,state);
      }
      if(!image.attached) {
        const result=await call(base+'/media-attachment',{method:'PATCH',body:{kind:image.kind,...(image.item_id?{item_id:image.item_id}:{}),media_id:image.uploaded.id,revision:saved.revision,policy_revision:saved.policy_revision}});
        saved.revision=result.revision;image.attached=true;save(path,state);
      }
    }
    if(!fixture.publication) {
      const head=await call(base+'/publication');
      fixture.publication=await call(base+'/publish',{method:'POST',body:{revision:saved.revision,policy_revision:saved.policy_revision,publication_revision:head.publication_revision}});save(path,state);
    }
    console.log(JSON.stringify({template:fixture.template,items:fixture.items,images:fixture.images.length,published:true}));
  }));
  const failed=outcomes.find(r=>r.status==='rejected');if(failed)throw failed.reason;
}
export function publicManifest(state) {
  const paths=[],fixtures=state.fixtures.map(f=>{
    assert(f.publication,'Publish before creating an anonymous test manifest.');
    const en={path:'/r/'+f.slug,type:'text/html',kind:f.template+'-html-en',contains:['100 items','Capacity test item 100','250.75'],min_bytes:30000};
    const am={...en,kind:f.template+'-html-am',locale:'am',contains:['100 items','የሙከራ እቃ 100','250.75']};
    paths.push(en,en,am,am);
    const images=f.images.map(i=>({id:i.uploaded.id,kind:i.kind,width:i.width,height:i.height,size_bytes:i.uploaded.size_bytes,sha256:i.sha256,path:'/public-media/'+f.slug+'/'+i.uploaded.id}));
    const weighted=[images[0],images[0],images[1],...images.slice(2).flatMap(i=>[i,i,i])];
    paths.push(...weighted.map(i=>({path:i.path,type:'image/png',kind:f.template+'-image',sha256:i.sha256,min_bytes:i.size_bytes})));
    paths.push({path:'/r/'+f.slug+'/qr.svg',type:'image/svg+xml',kind:f.template+'-qr',contains:'<svg'});
    return {id:f.id,slug:f.slug,template:f.template,items:f.items,categories:f.categories,variants:f.variants,translations:f.translations,publication_revision:f.publication.publication_revision,images};
  });
  assert.equal(paths.length,60);return {origin:PUBLIC_ORIGIN,created_utc:new Date().toISOString(),image_description:'Deterministic synthetic PNG payloads with representative byte sizes; not restaurant photographs.',fixtures,paths};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [mode,statePath,manifestPath]=process.argv.slice(2),path=resolve(statePath||'');assert(statePath,'Specify a private state path outside the repository.');const rel=relative(repo,path);assert(rel==='..'||rel.startsWith('..'+sep),'Private state must stay outside the repository.');
  if(mode==='prepare'){const state=prepareFixtureState();save(path,state);console.log(JSON.stringify({state_path:path,tag:state.tag,user_id:state.userId,fixtures:state.fixtures.map(f=>({id:f.id,slug:f.slug,template:f.template})),seed_queries:state.seedQueries.length}));}
  else if(mode==='provision'){const state=JSON.parse(readFileSync(path,'utf8'));await provision(path,state);}
  else if(mode==='manifest'){assert(manifestPath);const state=JSON.parse(readFileSync(path,'utf8'));writeFileSync(manifestPath,JSON.stringify(publicManifest(state),null,2)+'\n');console.log('Anonymous manifest written; no credentials included.');}
  else assert.fail('Choose prepare, provision or manifest.');
}
