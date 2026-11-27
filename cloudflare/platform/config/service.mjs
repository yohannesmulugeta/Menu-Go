import {requireAdmin} from '../auth/service.mjs';
import {fail,input,response} from '../auth/http.mjs';
import {FEATURES,FEATURE_KEYS,CONTENT_FEATURE} from './registry.mjs';
import {validateConfig,mergePatch,keys} from './validation.mjs';
import {resolveFeatures,publicProjection} from './resolution.mjs';
import {restaurantAccess,liveActorSQL,liveActorParams} from './access.mjs';
export function policyFromRows(rows){
  if(!rows.length||!Number.isSafeInteger(rows[0].policy_revision)||rows[0].policy_revision<1||FEATURE_KEYS.some(k=>!rows.some(p=>p.feature_key===k)))fail(503,'Feature policy is not initialized.');
  return {revision:rows[0].policy_revision,byKey:Object.fromEntries(rows.map(({policy_revision,...p})=>[p.feature_key,p]))};
}
export async function policies(db){
  const rows=await db.prepare('SELECT f.*,s.revision policy_revision FROM feature_policies f CROSS JOIN platform_policy_state s WHERE s.singleton=1 ORDER BY f.feature_key').all();
  return policyFromRows(rows.results);
}
export async function loadConfig(db,id){
  const row=await db.prepare('SELECT * FROM restaurant_configs WHERE restaurant_id=?').bind(id).first();if(!row)fail(409,'Restaurant configuration needs initialization.');
  const config=validateConfig({schema_version:row.schema_version,template_id:row.template_id,template_version:row.template_version,features:JSON.parse(row.features_json),theme:JSON.parse(row.theme_json),content_settings:JSON.parse(row.content_settings_json)});
  return {revision:row.revision,config};
}
async function template(db,config){
  const row=await db.prepare('SELECT supported_features_json FROM template_releases WHERE template_id=? AND version=?').bind(config.template_id,config.template_version).first();if(!row)fail(400,'Choose an available template version.');
  const supported=JSON.parse(row.supported_features_json);if(!Array.isArray(supported)||supported.some(k=>!Object.hasOwn(FEATURES,k)))fail(503,'Template capabilities need review.');return supported;
}
export async function loadData(db,restaurant){
  const id=restaurant.id;
  const queries=[
    "SELECT id,name,sort_order FROM categories WHERE restaurant_id=? AND deleted_at IS NULL AND is_active=1 ORDER BY sort_order,id",
    "SELECT i.id,i.name,i.description,i.price,i.category_id,i.image_url,i.is_popular FROM menu_items i LEFT JOIN categories c ON c.id=i.category_id AND c.restaurant_id=i.restaurant_id WHERE i.restaurant_id=? AND i.deleted_at IS NULL AND i.is_available=1 AND (i.category_id IS NULL OR(c.deleted_at IS NULL AND c.is_active=1)) ORDER BY i.sort_order,i.id",
    'SELECT id,menu_item_id,label,price_minor,is_active FROM menu_item_variants WHERE restaurant_id=? AND is_active=1 ORDER BY sort_order,id',
    'SELECT menu_item_id,locale,name,description FROM menu_item_translations WHERE restaurant_id=?',
    'SELECT weekday,opens_at,closes_at,is_closed FROM opening_hours WHERE restaurant_id=? ORDER BY weekday'
  ];
  const result=await Promise.all(queries.map(sql=>db.prepare(sql).bind(id).all()));
  let timezone=null;try{new Intl.DateTimeFormat('en',{timeZone:restaurant.timezone});timezone=restaurant.timezone;}catch{/* invalid legacy timezone keeps hours hidden */}
  return {categories:result[0].results,items:result[1].results,variants:result[2].results,translations:result[3].results,hours:result[4].results,timezone};
}
const canonical=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
function auditConfig(config){const c=structuredClone(config),w=c.content_settings.wifi;c.content_settings.wifi={network_name_set:!!w.network_name,password_set:!!w.password,public_name:w.public_name,public_password:w.public_password};return c;}
async function bundle(db,access){
  const [saved,policy,data]=await Promise.all([loadConfig(db,access.restaurant.id),policies(db),loadData(db,access.restaurant)]),supported=await template(db,saved.config);
  return {...saved,policy_revision:policy.revision,effective:resolveFeatures(saved.config,policy.byKey,supported,data,access.role),data};
}
export async function configRoute(request,env){
  const db=env.DB,url=new URL(request.url),path=url.pathname,method=request.method;
  if(path==='/api/platform/features'){
    await requireAdmin(request,db);if(method!=='GET')return response({error:'Method not allowed.'},405,{Allow:'GET'});
    const p=await policies(db);return response({schema_version:2,policy_revision:p.revision,features:FEATURE_KEYS.map(key=>({key,...FEATURES[key],policy:p.byKey[key]}))});
  }
  const policyMatch=/^\/api\/platform\/features\/([^/]+)$/.exec(path);
  if(policyMatch){
    if(method!=='PATCH')return response({error:'Method not allowed.'},405,{Allow:'PATCH'});
    const s=await requireAdmin(request,db,true),key=decodeURIComponent(policyMatch[1]);if(!Object.hasOwn(FEATURES,key))fail(400,'Unknown feature.');
    const body=await input(request);keys(body,['revision','policy_revision','allowed','manager_editable','forced_value'],'feature policy');
    if(!Number.isSafeInteger(body.revision)||!Number.isSafeInteger(body.policy_revision)||typeof body.allowed!=='boolean'||typeof body.manager_editable!=='boolean'||![null,true,false].includes(body.forced_value))fail(400,'Enter a complete feature policy and its current revisions.');
    const p=await policies(db),old=p.byKey[key];if(p.revision!==body.policy_revision||old.revision!==body.revision)fail(409,'Platform settings changed. Reload before saving.');
    const t=crypto.randomUUID(),result=await db.batch([
      db.prepare(`UPDATE feature_policies SET allowed=?,manager_editable=?,forced_value=?,revision=revision+1 WHERE feature_key=? AND revision=? AND (SELECT revision FROM platform_policy_state WHERE singleton=1)=? AND ${liveActorSQL({admin:true,recent:true})}`)
        .bind(Number(body.allowed),Number(body.manager_editable),body.forced_value===null?null:Number(body.forced_value),key,body.revision,body.policy_revision,...liveActorParams(s,{admin:true,recent:true})),
      db.prepare('UPDATE platform_policy_state SET revision=revision+1 WHERE singleton=1 AND changes()=1'),
      db.prepare("INSERT INTO platform_audit_logs(actor_user_id,action,target_type,target_id,before_json,after_json,request_id) SELECT ?,'config.policy_changed','feature',?,?,?,? WHERE changes()=1")
        .bind(s.user_id,key,JSON.stringify(old),JSON.stringify({allowed:body.allowed,manager_editable:body.manager_editable,forced_value:body.forced_value}),t)
    ]);
    if(!result[0].meta.changes)fail(409,'The policy or your account changed. Reload before saving.');
    return response({ok:true,revision:body.revision+1,policy_revision:body.policy_revision+1});
  }
  const match=/^\/api\/restaurants\/([^/]+)\/(config|preview-data|feature-catalogue|feedback|analytics)$/.exec(path);if(!match)return null;
  const id=decodeURIComponent(match[1]),action=match[2],access=await restaurantAccess(request,db,id);
  const actor={admin:access.role==='super_admin',restaurantId:id};
  if(action==='feature-catalogue'&&method==='GET'){
    const [templates,presets]=await Promise.all([db.prepare('SELECT template_id,version,name,supported_features_json FROM template_releases WHERE json_array_length(supported_features_json)>0 ORDER BY template_id,version').all(),db.prepare('SELECT preset_id,version,name,schema_version FROM config_presets WHERE schema_version=2 ORDER BY preset_id,version').all()]);
    return response({schema_version:2,features:FEATURE_KEYS.map(key=>({key,...FEATURES[key]})),templates:templates.results.map(t=>({...t,supported_features:JSON.parse(t.supported_features_json),supported_features_json:undefined})),presets:presets.results});
  }
  if((action==='config'||action==='preview-data')&&method==='GET'){
    const b=await bundle(db,access);
    if(action==='preview-data')return response(publicProjection(b.config,b.effective,access.restaurant,b.data,url.searchParams.get('locale')||'en'));
    const {data,...view}=b;return response({...view,restaurant:{id,name:access.restaurant.name,status:access.restaurant.status}});
  }
  if(action==='config'&&method==='PATCH'){
    const patch=await input(request,32768),b=await bundle(db,access);
    const next=mergePatch(b.config,patch);
    // Private managed media can only be attached through the ownership-checked route.
    for(const key of ['logo_url','cover_url']){
      const value=next.content_settings[key],old=b.config.content_settings[key];
      const managed=v=>{try{return /^\/api\/restaurants\/[^/]+\/media\//.test(new URL(v).pathname);}catch{return false;}};
      if(value!==old&&(managed(value)||managed(old)))fail(400,'Use the image controls to replace or remove an uploaded image.');
    }
    if(patch.revision!==b.revision||patch.policy_revision!==b.policy_revision)fail(409,'Settings changed. Reload before saving.');
    const supported=await template(db,next);
    if((next.template_id!==b.config.template_id||next.template_version!==b.config.template_version)&&FEATURE_KEYS.some(k=>!supported.includes(k)))fail(400,'Choose a template that supports every shared feature.');
    for(const key of FEATURE_KEYS)if(next.features[key]!==b.config.features[key]&&b.effective[key].locked)fail(403,'This feature is locked: '+FEATURES[key].label+'.');
    if(access.role!=='super_admin')for(const [key,feature]of Object.entries(CONTENT_FEATURE))if(canonical(next.content_settings[key])!==canonical(b.config.content_settings[key])&&b.effective[feature].locked)fail(403,'These settings are locked: '+FEATURES[feature].label+'.');
    for(const itemId of Object.keys(next.content_settings.item_labels))if(!await db.prepare('SELECT 1 FROM menu_items WHERE id=? AND restaurant_id=? AND deleted_at IS NULL').bind(itemId,id).first())fail(400,'Item labels must belong to this restaurant.');
    const result=await db.batch([
      db.prepare(`UPDATE restaurant_configs SET schema_version=?,template_id=?,template_version=?,features_json=?,theme_json=?,content_settings_json=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE restaurant_id=? AND revision=? AND (SELECT revision FROM platform_policy_state WHERE singleton=1)=? AND ${liveActorSQL(actor)}`)
        .bind(next.schema_version,next.template_id,next.template_version,JSON.stringify(next.features),JSON.stringify(next.theme),JSON.stringify(next.content_settings),id,b.revision,b.policy_revision,...liveActorParams(access.session,actor)),
      db.prepare("INSERT INTO platform_audit_logs(actor_user_id,action,target_type,target_id,before_json,after_json,request_id) SELECT ?,'config.restaurant_saved','restaurant',?,?,?,? WHERE changes()=1")
        .bind(access.session.user_id,id,JSON.stringify(auditConfig(b.config)),JSON.stringify(auditConfig(next)),crypto.randomUUID())
    ]);
    if(!result[0].meta.changes)fail(409,'Settings, permissions or platform policy changed. Reload before saving.');
    return response({ok:true,revision:b.revision+1,policy_revision:b.policy_revision});
  }
  if(action==='feedback'&&method==='GET'){
    // Turning collection off retains authorized access to old private feedback.
    const offset=Number(url.searchParams.get('offset')||0);if(!Number.isSafeInteger(offset)||offset<0)fail(400,'Invalid page.');
    const result=await db.prepare('SELECT id,message,rating,status,created_at FROM feedback WHERE restaurant_id=? ORDER BY created_at DESC,id LIMIT 51 OFFSET ?').bind(id,offset).all();return response({feedback:result.results.slice(0,50),next_offset:result.results.length>50?offset+50:null});
  }
  if(action==='analytics'&&method==='GET'){
    const b=await bundle(db,access);if(!b.effective['analytics.dashboard'].enabled)fail(403,'Analytics dashboard is disabled by platform settings.');
    const result=await db.prepare("SELECT day,event_type,count FROM daily_analytics WHERE restaurant_id=? AND day>=date('now','-30 days') ORDER BY day,event_type").bind(id).all();return response({days:30,events:result.results});
  }
  return response({error:'Method not allowed.'},405,{Allow:action==='config'?'GET, PATCH':'GET'});
}
