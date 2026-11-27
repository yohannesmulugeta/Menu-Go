import {publishedContext} from './context.mjs';
import {restaurantAccess,liveActorSQL,liveActorParams} from '../config/access.mjs';
import {policies} from '../config/service.mjs';
import {resolveFeatures,publicProjection,capabilityManifest} from '../config/resolution.mjs';
import {FEATURE_KEYS} from '../config/registry.mjs';
import {keys} from '../config/validation.mjs';
import {input,response,fail} from '../auth/http.mjs';
import {draftStateSQL,draftConfig,snapshotData} from './snapshot.mjs';

export const PUBLIC_ORIGIN='https://admaki-menu-platform-staging.yohannesmulugeta084.workers.dev';
export const publicURL=slug=>PUBLIC_ORIGIN+'/r/'+encodeURIComponent(slug);
export const publicMediaPath=(slug,id)=>'/public-media/'+encodeURIComponent(slug)+'/'+id;
const currentRevisionSQL='COALESCE((SELECT revision FROM restaurant_publication_heads WHERE restaurant_id=?),0)';
const committedSQL="EXISTS(SELECT 1 FROM platform_audit_logs WHERE request_id=? AND action='publication.published')";
function revision(value) {return Number.isSafeInteger(value)&&value>=0;}
export function managedMedia(url,restaurantId) {
  if(!url)return null;
  let parsed;try{parsed=new URL(url);}catch{return null;}
  const match=/^\/api\/restaurants\/([^/]+)\/media\/([a-f0-9-]{36})$/.exec(parsed.pathname);
  if(!match) {
    if(parsed.pathname.startsWith('/api/restaurants/')||parsed.pathname.startsWith('/public-media/'))fail(400,'Use the image controls for managed media.');
    return null;
  }
  if(parsed.origin!==PUBLIC_ORIGIN||decodeURIComponent(match[1])!==restaurantId||parsed.search||parsed.hash)fail(400,'An uploaded image belongs to a different restaurant or origin.');
  return match[2];
}
function referencedMedia(config,data,restaurantId) {
  const refs=[];
  for(const kind of ['logo','cover']) {
    const id=managedMedia(config.content_settings[kind+'_url'],restaurantId);
    if(id)refs.push({id,kind});
  }
  for(const item of data.items) {
    const id=managedMedia(item.image_url,restaurantId);
    if(id)refs.push({id,kind:'item',itemId:item.id});
  }
  return refs;
}

export async function publicationRoute(request,env) {
  const url=new URL(request.url),match=/^\/api\/restaurants\/([^/]+)\/(publication|publish|unpublish)$/.exec(url.pathname);
  if(!match)return null;
  const id=decodeURIComponent(match[1]),action=match[2],db=env.DB,access=await restaurantAccess(request,db,id);
  if(action==='publication') {
    if(request.method!=='GET')return response({error:'Method not allowed.'},405,{Allow:'GET'});
    const head=await db.prepare('SELECT h.revision,p.config_revision,p.created_at FROM restaurant_publication_heads h JOIN restaurant_publications p ON p.restaurant_id=h.restaurant_id AND p.revision=h.revision WHERE h.restaurant_id=?').bind(id).first();
    return response({publication_revision:head?.revision||0,config_revision:head?.config_revision||null,published_at:head?.created_at||null,active:access.restaurant.status==='active'&&!!head,url:publicURL(access.restaurant.slug)});
  }
  if(request.method!=='POST')return response({error:'Method not allowed.'},405,{Allow:'POST'});
  const body=await input(request);
  keys(body,action==='publish'?['revision','policy_revision','publication_revision']:['publication_revision'],'publication');
  if(!revision(body.publication_revision))fail(400,'Reload the current publication before continuing.');
  if(access.restaurant.status==='suspended')fail(409,'This restaurant is suspended.');
  if(action==='unpublish') {
    const result=await db.batch([
      db.prepare(`UPDATE restaurants SET status='draft',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='active' AND ${currentRevisionSQL}=? AND ${liveActorSQL()}`)
        .bind(id,id,body.publication_revision,...liveActorParams(access.session,{restaurantId:id})),
      db.prepare("INSERT INTO platform_audit_logs(actor_user_id,action,target_type,target_id,request_id,after_json) SELECT ?,'publication.unpublished','restaurant',?,?,? WHERE changes()=1")
        .bind(access.session.user_id,id,crypto.randomUUID(),JSON.stringify({publication_revision:body.publication_revision}))
    ]);
    if(!result[0].meta.changes)fail(409,'The publication or your access changed. Reload before trying again.');
    return response({ok:true});
  }
  if(!revision(body.revision)||!revision(body.policy_revision))fail(400,'Reload draft and policy revisions.');
  const captured=await db.prepare('SELECT '+draftStateSQL+' state FROM restaurants r WHERE r.id=?').bind(id).first();
  const state=JSON.parse(captured.state);
  if(!state.config)fail(409,'Initialize the draft configuration first.');
  const config=draftConfig(state.config),policy=await policies(db);
  if(body.revision!==state.config.revision||body.policy_revision!==policy.revision)fail(409,'Draft settings or platform policy changed.');
  const template=await db.prepare('SELECT supported_features_json FROM template_releases WHERE template_id=? AND version=?').bind(config.template_id,config.template_version).first();
  const supported=template?JSON.parse(template.supported_features_json):[];
  if(FEATURE_KEYS.some(key=>!supported.includes(key)))fail(400,'Choose a template supporting the shared menu features.');
  const data=snapshotData(state),refs=referencedMedia(config,data,id);
  for(const ref of refs) {
    const media=state.media.find(m=>m.id===ref.id);
    if(!media||media.kind!==ref.kind||media.lifecycle!=='ready'||media.state==='deleted'||(ref.itemId&&!state.owners.some(o=>o.media_id===ref.id&&o.menu_item_id===ref.itemId)))fail(409,'An uploaded image is unavailable or belongs to another item.');
    const object=env.MEDIA.head?await env.MEDIA.head(media.object_key):await env.MEDIA.get(media.object_key);
    if(!object)fail(409,'An uploaded image is unavailable. Replace it before publishing.');
  }
  const effective=resolveFeatures(config,policy.byKey,supported,data,access.role);
  // Private Wi-Fi values never enter a publication snapshot.
  const wifi=config.content_settings.wifi;
  if(!wifi.public_name)wifi.network_name='';
  if(!wifi.public_password)wifi.password='';
  const snapshot={version:1,restaurant:state.restaurant,config,data,capabilities:capabilityManifest(config,effective)};
  const latest=await db.prepare('SELECT COALESCE(MAX(revision),0) revision FROM restaurant_publications WHERE restaurant_id=?').bind(id).first();
  const requestId=crypto.randomUUID(),next=latest.revision+1;
  const result=await db.batch([
    db.prepare(`INSERT INTO restaurant_publications(restaurant_id,revision,config_revision,snapshot_json,created_by)
      SELECT r.id,?,?,?,? FROM restaurants r WHERE r.id=? AND r.status!='suspended'
      AND ${draftStateSQL}=? AND ${currentRevisionSQL}=?
      AND COALESCE((SELECT MAX(revision) FROM restaurant_publications WHERE restaurant_id=r.id),0)=?
      AND (SELECT revision FROM platform_policy_state WHERE singleton=1)=? AND ${liveActorSQL()}`)
      .bind(next,body.revision,JSON.stringify(snapshot),access.session.user_id,id,captured.state,id,body.publication_revision,latest.revision,body.policy_revision,...liveActorParams(access.session,{restaurantId:id})),
    db.prepare("INSERT INTO platform_audit_logs(actor_user_id,action,target_type,target_id,request_id,after_json) SELECT ?,'publication.published','restaurant',?,?,? WHERE changes()=1")
      .bind(access.session.user_id,id,requestId,JSON.stringify({publication_revision:next,config_revision:body.revision})),
    ...[...new Set(refs.map(r=>r.id))].map(mediaId=>db.prepare(`INSERT INTO media_publication_refs(restaurant_id,publication_revision,media_id) SELECT ?,?,? WHERE ${committedSQL}`).bind(id,next,mediaId,requestId)),
    db.prepare(`INSERT INTO restaurant_publication_heads(restaurant_id,revision) SELECT ?,? WHERE ${committedSQL} ON CONFLICT(restaurant_id) DO UPDATE SET revision=excluded.revision`).bind(id,next,requestId),
    db.prepare(`UPDATE restaurants SET status='active',updated_at=CURRENT_TIMESTAMP WHERE id=? AND ${committedSQL}`).bind(id,requestId)
  ]);
  if(!result[0].meta.changes)fail(409,'The menu, images, publication or access changed. Reload before publishing.');
  return response({ok:true,publication_revision:next,url:publicURL(access.restaurant.slug)},201);
}

export async function publishedMenu(db,slug,locale='en') {
  const context=await publishedContext(db,slug);
  const {snapshot,policy,supported}=context;
  if(snapshot.version!==1||!snapshot.config||!snapshot.data)fail(503,'This menu needs a new publication.');
  if(supported===null)fail(503,'The menu template is unavailable.');
  const states=resolveFeatures(snapshot.config,policy.byKey,supported,snapshot.data);
  const dto=publicProjection(snapshot.config,states,snapshot.restaurant,snapshot.data,locale);
  const images=[];
  function rewrite(value) {
    const id=managedMedia(value,context.restaurant_id);
    if(!id)return value;
    images.push(id);return PUBLIC_ORIGIN+publicMediaPath(slug,id);
  }
  if(dto.cover)dto.cover.url=rewrite(dto.cover.url);
  if(dto.logo_url)dto.logo_url=rewrite(dto.logo_url);
  for(const item of dto.items)if(item.image_url)item.image_url=rewrite(item.image_url);
  return {restaurant_id:context.restaurant_id,revision:context.revision,policy_revision:policy.revision,dto,images};
}
export async function assertCurrent(db,menu) {
  const valid=await db.prepare("SELECT 1 FROM restaurants r JOIN restaurant_publication_heads h ON h.restaurant_id=r.id CROSS JOIN platform_policy_state s WHERE r.id=? AND r.status='active' AND h.revision=? AND s.singleton=1 AND s.revision=?").bind(menu.restaurant_id,menu.revision,menu.policy_revision).first();
  if(!valid)fail(409,'The menu changed. Reload to continue.');
}

