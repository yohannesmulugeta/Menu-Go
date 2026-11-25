import {restaurantAccess,liveActorSQL,liveActorParams} from '../config/access.mjs';
import {loadConfig,policies} from '../config/service.mjs';
import {input,mutationGuard,response,fail} from '../auth/http.mjs';
import {keys} from '../config/validation.mjs';
import {validatePNG,MAX_BYTES} from './png.mjs';
const featureFor=kind=>kind==='item'?'menu.item_images':'brand.'+kind;
export const mediaPath=(restaurantId,id)=>'/api/restaurants/'+encodeURIComponent(restaurantId)+'/media/'+id;
const idOK=v=>typeof v==='string'&&/^[0-9a-f-]{36}$/.test(v);
async function writable(db,access,kind){
 const [saved,policy]=await Promise.all([loadConfig(db,access.restaurant.id),policies(db)]),p=policy.byKey[featureFor(kind)];
 if(access.role!=='super_admin'&&(!p.allowed||!p.manager_editable||p.forced_value!==null))fail(403,'Image editing is locked by platform settings.');
 return {...saved,policy_revision:policy.revision};
}
const audit=(db,access,action,id,data)=>db.prepare('INSERT INTO platform_audit_logs(actor_user_id,action,target_type,target_id,after_json,request_id) SELECT ?,?,\'media\',?,?,? WHERE changes()=1').bind(access.session.user_id,action,id,JSON.stringify(data),crypto.randomUUID());
const unusedSQL=`NOT EXISTS(SELECT 1 FROM media_draft_refs d WHERE d.media_id=media_assets.id)
 AND NOT EXISTS(SELECT 1 FROM media_publication_refs p WHERE p.media_id=media_assets.id)
 AND NOT EXISTS(SELECT 1 FROM restaurant_publications p WHERE p.restaurant_id=media_assets.restaurant_id AND (instr(p.snapshot_json,media_assets.id)>0 OR instr(p.snapshot_json,media_assets.object_key)>0))
 AND NOT EXISTS(SELECT 1 FROM restaurant_configs c WHERE c.restaurant_id=media_assets.restaurant_id AND instr(c.content_settings_json,media_assets.id)>0)
 AND NOT EXISTS(SELECT 1 FROM menu_items i WHERE i.restaurant_id=media_assets.restaurant_id AND instr(coalesce(i.image_url,''),media_assets.id)>0)`;
async function receive(request){
 mutationGuard(request,'image/png');if(request.headers.has('Content-Encoding'))fail(415,'Compressed request bodies are not supported.');
 const size=request.headers.get('Content-Length');if(size!==null&&(!/^\d+$/.test(size)||Number(size)>MAX_BYTES))fail(413,'Images must be at most 5 MiB.');
 const reader=request.body?.getReader();if(!reader)fail(400,'Choose an image.');const parts=[];let total=0;
 while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_BYTES){await reader.cancel();fail(413,'Images must be at most 5 MiB.');}parts.push(value);}
 return validatePNG(Buffer.concat(parts,total));
}
async function asset(db,id,restaurantId){return db.prepare("SELECT id,restaurant_id,object_key,kind,mime_type,width,height,size_bytes,lifecycle,state FROM media_assets WHERE id=? AND restaurant_id=? AND state!='deleted'").bind(id,restaurantId).first();}
export async function mediaRoute(request,env){
 const match=/^\/api\/restaurants\/([^/]+)\/media(?:\/([a-f0-9-]+))?$/.exec(new URL(request.url).pathname);if(!match)return null;
 const db=env.DB,id=decodeURIComponent(match[1]),mediaId=match[2],access=await restaurantAccess(request,db,id),url=new URL(request.url);
 if(!mediaId&&request.method==='POST'){
  const kind=url.searchParams.get('kind'),itemId=url.searchParams.get('item_id');if(!['logo','cover','item'].includes(kind))fail(400,'Choose logo, cover or item.');
  if(kind==='item'&&(!itemId||!await db.prepare('SELECT 1 FROM menu_items WHERE id=? AND restaurant_id=? AND deleted_at IS NULL').bind(itemId,id).first()))fail(404,'Menu item not found.');
  if(kind!=='item'&&itemId)fail(400,'This image does not use an item.');
  const saved=await writable(db,access,kind),image=await receive(request),newId=crypto.randomUUID(),key='draft/'+crypto.randomUUID()+'/'+newId+'.png';
  const inserted=await db.batch([
   db.prepare(`INSERT INTO media_assets(id,restaurant_id,object_key,kind,mime_type,width,height,size_bytes,checksum_sha256,created_by,lifecycle)
    SELECT ?,?,?,?,?,?,?,?,?,?,'pending' WHERE ${liveActorSQL()} AND (SELECT revision FROM platform_policy_state WHERE singleton=1)=?
    AND (SELECT count(*) FROM media_assets WHERE restaurant_id=? AND state!='deleted')<100
    AND coalesce((SELECT sum(size_bytes) FROM media_assets WHERE restaurant_id=? AND state!='deleted'),0)+?<=104857600
    AND (SELECT count(*) FROM media_assets WHERE created_by=? AND created_at>datetime('now','-15 minutes'))<20
    AND (? IS NULL OR EXISTS(SELECT 1 FROM menu_items WHERE id=? AND restaurant_id=? AND deleted_at IS NULL))`)
    .bind(newId,id,key,kind,image.mime_type,image.width,image.height,image.size_bytes,image.checksum_sha256,access.session.user_id,...liveActorParams(access.session,{restaurantId:id}),saved.policy_revision,id,id,image.size_bytes,access.session.user_id,itemId,itemId,id),
   audit(db,access,'media.upload_started',newId,{kind}),
   db.prepare('INSERT INTO media_item_owners(media_id,restaurant_id,menu_item_id) SELECT ?,?,? WHERE ? IS NOT NULL AND EXISTS(SELECT 1 FROM media_assets WHERE id=?)').bind(newId,id,itemId,itemId,newId)
  ]);
  if(!inserted[0].meta.changes)fail(409,'Upload quota, permissions or platform settings changed.');
  // The durable pending record precedes R2. Failed/uncertain writes remain bounded cleanup candidates.
  await env.MEDIA.put(key,image.bytes,{httpMetadata:{contentType:'image/png'}});
  const ready=await db.batch([
   db.prepare(`UPDATE media_assets SET lifecycle='ready' WHERE id=? AND restaurant_id=? AND lifecycle='pending' AND state='draft' AND ${liveActorSQL()} AND (SELECT revision FROM platform_policy_state WHERE singleton=1)=?`).bind(newId,id,...liveActorParams(access.session,{restaurantId:id}),saved.policy_revision),
   audit(db,access,'media.upload_ready',newId,{kind,width:image.width,height:image.height,size_bytes:image.size_bytes})
  ]);
  if(!ready[0].meta.changes)fail(409,'Upload was not attached. Reload before trying again.');
  return response({id:newId,url:url.origin+mediaPath(id,newId),kind,width:image.width,height:image.height,size_bytes:image.size_bytes},201);
 }
 if(!mediaId)return response({error:'Method not allowed.'},405,{Allow:'POST'});
 if(!idOK(mediaId))fail(404,'Image not found.');const row=await asset(db,mediaId,id);if(!row)fail(404,'Image not found.');
 if(['GET','HEAD'].includes(request.method)){
  if(row.lifecycle!=='ready')fail(404,'Image not found.');const object=await env.MEDIA.get(row.object_key);if(!object)fail(404,'Image not found.');
  await restaurantAccess(request,db,id);
  if((await asset(db,mediaId,id))?.lifecycle!=='ready')fail(404,'Image not found.');
  return new Response(request.method==='HEAD'?null:object.body,{headers:{'Content-Type':row.mime_type,'Content-Length':String(row.size_bytes),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','Content-Disposition':'inline','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"}});
 }
 if(request.method==='DELETE'){
  const body=await input(request);keys(body,['revision','policy_revision'],'image deletion');const saved=await writable(db,access,row.kind);
  if(body.revision!==saved.revision||body.policy_revision!==saved.policy_revision)fail(409,'Reload settings before deleting an image.');
  const result=await db.batch([
   db.prepare(`UPDATE media_assets SET lifecycle='deleting' WHERE id=? AND restaurant_id=? AND state='draft' AND ${unusedSQL} AND ${liveActorSQL()} AND (SELECT revision FROM restaurant_configs WHERE restaurant_id=?)=? AND (SELECT revision FROM platform_policy_state WHERE singleton=1)=?`).bind(mediaId,id,...liveActorParams(access.session,{restaurantId:id}),id,saved.revision,saved.policy_revision),
   audit(db,access,'media.delete_requested',mediaId,{kind:row.kind})
  ]);
  if(!result[0].meta.changes)fail(409,'Image is referenced or settings changed.');
  await env.MEDIA.delete(row.object_key);await db.prepare("UPDATE media_assets SET state='deleted' WHERE id=? AND lifecycle='deleting'").bind(mediaId).run();return response({ok:true});
 }
 return response({error:'Method not allowed.'},405,{Allow:'GET, HEAD, DELETE'});
}
export async function attachmentRoute(request,env){
 const match=/^\/api\/restaurants\/([^/]+)\/media-attachment$/.exec(new URL(request.url).pathname);if(!match)return null;
 const db=env.DB,id=decodeURIComponent(match[1]),access=await restaurantAccess(request,db,id);if(request.method!=='PATCH')return response({error:'Method not allowed.'},405,{Allow:'PATCH'});
 const body=await input(request);keys(body,['kind','item_id','media_id','revision','policy_revision'],'image attachment');const kind=body.kind;
 if(!['logo','cover','item'].includes(kind)||!(body.media_id===null||idOK(body.media_id)))fail(400,'Choose a valid image.');
 const saved=await writable(db,access,kind);if(saved.revision!==body.revision||saved.policy_revision!==body.policy_revision)fail(409,'Settings changed. Reload before attaching the image.');
 let item=null;if(kind==='item'){item=await db.prepare('SELECT id FROM menu_items WHERE id=? AND restaurant_id=? AND deleted_at IS NULL').bind(body.item_id||'',id).first();if(!item)fail(404,'Menu item not found.');}else if(body.item_id!==undefined)fail(400,'This image does not use an item.');
 const row=body.media_id?await asset(db,body.media_id,id):null;
 if(body.media_id&&(!row||row.kind!==kind||row.lifecycle!=='ready'||row.state==='deleted'))fail(404,'Image not found.');
 if(row&&item&&!await db.prepare('SELECT 1 FROM media_item_owners WHERE media_id=? AND restaurant_id=? AND menu_item_id=?').bind(row.id,id,item.id).first())fail(404,'Image not found.');
 const slot=item?'item:'+item.id:kind,value=row?new URL(request.url).origin+mediaPath(id,row.id):'',config=structuredClone(saved.config.content_settings);
 if(!item)config[kind+'_url']=value;
 const changed=`EXISTS(SELECT 1 FROM platform_audit_logs WHERE request_id=?)`,requestId=crypto.randomUUID();
 const result=await db.batch([
  db.prepare(`UPDATE restaurant_configs SET content_settings_json=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE restaurant_id=? AND revision=? AND (SELECT revision FROM platform_policy_state WHERE singleton=1)=? AND ${liveActorSQL()}
   AND (? IS NULL OR EXISTS(SELECT 1 FROM media_assets a WHERE a.id=? AND a.restaurant_id=? AND a.kind=? AND a.lifecycle='ready' AND a.state!='deleted'))
   AND (? IS NULL OR EXISTS(SELECT 1 FROM menu_items WHERE id=? AND restaurant_id=? AND deleted_at IS NULL))`)
   .bind(JSON.stringify(config),id,saved.revision,saved.policy_revision,...liveActorParams(access.session,{restaurantId:id}),body.media_id,body.media_id,id,kind,item?.id||null,item?.id||null,id),
  db.prepare("INSERT INTO platform_audit_logs(actor_user_id,action,target_type,target_id,after_json,request_id) SELECT ?,'media.attached','restaurant',?,?,? WHERE changes()=1").bind(access.session.user_id,id,JSON.stringify({kind,media_id:body.media_id,item_id:item?.id||null}),requestId),
  db.prepare(`DELETE FROM media_draft_refs WHERE restaurant_id=? AND slot=? AND ${changed}`).bind(id,slot,requestId),
  db.prepare(`INSERT INTO media_draft_refs(restaurant_id,slot,media_id) SELECT ?,?,? WHERE ? IS NOT NULL AND ${changed}`).bind(id,slot,body.media_id,body.media_id,requestId),
  db.prepare(`UPDATE menu_items SET image_url=? WHERE id=? AND restaurant_id=? AND ${changed}`).bind(value,item?.id||null,id,requestId)
 ]);
 if(!result[0].meta.changes)fail(409,'Settings, image or permissions changed. The previous image remains attached.');
 return response({ok:true,revision:saved.revision+1,policy_revision:saved.policy_revision,url:value});
}
export async function cleanupMedia(db,bucket){
 const candidates=await db.prepare(`SELECT id,object_key FROM media_assets WHERE state='draft' AND (lifecycle='deleting' OR created_at<datetime('now','-1 day')) AND ${unusedSQL} ORDER BY created_at,id LIMIT 25`).all();
 for(const row of candidates.results){
  const claimed=await db.prepare(`UPDATE media_assets SET lifecycle='deleting' WHERE id=? AND state='draft' AND ${unusedSQL}`).bind(row.id).run();
  if(!claimed.meta.changes)continue;
  try{await bucket.delete(row.object_key);await db.batch([
   db.prepare("UPDATE media_assets SET state='deleted' WHERE id=? AND lifecycle='deleting' AND state!='deleted'").bind(row.id),
   db.prepare("INSERT INTO platform_audit_logs(action,target_type,target_id,request_id) SELECT 'media.cleaned','media',?,? WHERE changes()=1").bind(row.id,crypto.randomUUID())
  ]);}catch{/* Retry a bounded deletion on the next scheduled run. */}
 }
}
