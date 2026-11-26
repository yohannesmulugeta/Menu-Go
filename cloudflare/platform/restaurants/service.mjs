import {requireSession,requireAdmin} from '../auth/service.mjs';
import {input,response,fail} from '../auth/http.mjs';
import {keys,validateConfig} from '../config/validation.mjs';
import {FEATURE_KEYS} from '../config/registry.mjs';
import {liveActorSQL,liveActorParams} from '../config/access.mjs';

export async function restaurantRoute(request,env) {
  const url=new URL(request.url), db=env.DB;
  if(url.pathname==='/api/restaurants') {
    if(request.method!=='GET')return response({error:'Method not allowed.'},405,{Allow:'GET'});
    const session=await requireSession(request,db);
    const offset=Number(url.searchParams.get('offset')||0);
    const search=(url.searchParams.get('search')||'').trim();
    if(!Number.isSafeInteger(offset)||offset<0||search.length>120)fail(400,'Check the search and page.');
    const pattern='%'+search.replace(/[\\%_]/g,'\\$&')+'%';
    const rows=await db.prepare(`SELECT r.id,r.name,r.slug,r.status FROM restaurants r
      WHERE (EXISTS(SELECT 1 FROM platform_admins WHERE user_id=?)
        OR EXISTS(SELECT 1 FROM restaurant_members m WHERE m.user_id=? AND m.restaurant_id=r.id AND m.role='manager'))
      AND (r.name LIKE ? ESCAPE '\\' OR r.slug LIKE ? ESCAPE '\\')
      ORDER BY r.name COLLATE NOCASE,r.id LIMIT 51 OFFSET ?`)
      .bind(session.user_id,session.user_id,pattern,pattern,offset).all();
    return response({restaurants:rows.results.slice(0,50),next_offset:rows.results.length>50?offset+50:null});
  }
  if(url.pathname==='/api/platform/onboarding-options') {
    await requireAdmin(request,db);
    if(request.method!=='GET')return response({error:'Method not allowed.'},405,{Allow:'GET'});
    const templates=await db.prepare('SELECT template_id,version,name,supported_features_json FROM template_releases ORDER BY template_id,version').all();
    const presets=await db.prepare('SELECT preset_id,version,name FROM config_presets WHERE schema_version=2 ORDER BY preset_id,version').all();
    return response({templates:templates.results.filter(t=>FEATURE_KEYS.every(k=>JSON.parse(t.supported_features_json).includes(k))).map(({supported_features_json,...t})=>t),presets:presets.results});
  }
  if(url.pathname!=='/api/platform/restaurants'||request.method==='GET')return null;
  if(request.method!=='POST')return response({error:'Method not allowed.'},405,{Allow:'GET, POST'});
  const session=await requireAdmin(request,db,true);
  const body=await input(request);
  keys(body,['name','slug','preset_id','preset_version','template_id','template_version'],'restaurant');
  const name=typeof body.name==='string'?body.name.trim():'';
  const slug=typeof body.slug==='string'?body.slug.trim():'';
  if(!name||name.length>120||/[\u0000-\u001f\u007f]/.test(name))fail(400,'Enter a restaurant name of 1–120 characters.');
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>80)fail(400,'Use up to 80 lowercase letters, numbers and single hyphens for the slug.');
  if(typeof body.preset_id!=='string'||!Number.isSafeInteger(body.preset_version)||typeof body.template_id!=='string'||!Number.isSafeInteger(body.template_version))fail(400,'Choose a preset and template.');
  const preset=await db.prepare('SELECT config_json FROM config_presets WHERE preset_id=? AND version=? AND schema_version=2').bind(body.preset_id,body.preset_version).first();
  const template=await db.prepare('SELECT supported_features_json FROM template_releases WHERE template_id=? AND version=?').bind(body.template_id,body.template_version).first();
  if(!preset||!template||!FEATURE_KEYS.every(k=>JSON.parse(template.supported_features_json).includes(k)))fail(400,'Choose a supported preset and template.');
  const config=validateConfig({...JSON.parse(preset.config_json),template_id:body.template_id,template_version:body.template_version});
  if(await db.prepare('SELECT 1 FROM restaurants WHERE slug=?').bind(slug).first())fail(409,'This restaurant slug is already in use.');
  const id=crypto.randomUUID();
  // The unique slug and guarded insert make retries and concurrent creates safe.
  const result=await db.batch([
    db.prepare(`INSERT INTO restaurants(id,name,slug,status) SELECT ?,?,?,'draft'
      WHERE ${liveActorSQL({admin:true,recent:true})}
      ON CONFLICT(slug) DO NOTHING`).bind(id,name,slug,...liveActorParams(session,{admin:true,recent:true})),
    db.prepare(`INSERT INTO restaurant_configs(restaurant_id,schema_version,template_id,template_version,features_json,theme_json,content_settings_json)
      SELECT id,?,?,?,?,?,? FROM restaurants WHERE id=?`)
      .bind(config.schema_version,config.template_id,config.template_version,JSON.stringify(config.features),JSON.stringify(config.theme),JSON.stringify(config.content_settings),id),
    db.prepare(`INSERT INTO platform_audit_logs(actor_user_id,action,target_type,target_id,request_id,after_json)
      SELECT ?,'restaurant.created','restaurant',?,?,? WHERE EXISTS(SELECT 1 FROM restaurants WHERE id=?)`)
      .bind(session.user_id,id,crypto.randomUUID(),JSON.stringify({name,slug,preset_id:body.preset_id,preset_version:body.preset_version,template_id:config.template_id,template_version:config.template_version}),id)
  ]);
  if(!result[0].meta.changes)fail(409,'The slug or your access changed. Reload before trying again.');
  return response({restaurant:{id,name,slug,status:'draft'}},201);
}

