import {policies} from '../config/service.mjs';
import {liveActorSQL,liveActorParams} from '../config/access.mjs';
import {fail} from '../auth/http.mjs';

const contentFeatures=['menu.categories','menu.descriptions','menu.popular','menu.item_images','menu.variants','guest.language','guest.hours'];
export async function menuMetadata(db,access) {
  // Read the revision before the content, so a concurrent write yields a stale save.
  const config=await db.prepare('SELECT revision FROM restaurant_configs WHERE restaurant_id=?').bind(access.restaurant.id).first();
  if(!config)fail(409,'Initialize the restaurant configuration first.');
  const policy=await policies(db);
  return {restaurant:{id:access.restaurant.id,name:access.restaurant.name,currency:access.restaurant.currency},revision:config.revision,policy_revision:policy.revision,editable:Object.fromEntries(contentFeatures.map(key=>{
    const p=policy.byKey[key];
    return [key,access.role==='super_admin'||!!(p.allowed&&p.manager_editable&&p.forced_value===null)];
  }))};
}
export function editable(meta,key,changed=true) {
  if(changed&&!meta.editable[key])fail(403,'This content is locked by platform settings.');
}
export async function commitMenu(db,access,meta,body,{sql,params,guard='1',guardParams=[],action,id}) {
  if(body.revision!==meta.revision||body.policy_revision!==meta.policy_revision)fail(409,'Menu settings or permissions changed. Reload before saving.');
  const tenant=access.restaurant.id,actor={admin:access.role==='super_admin',restaurantId:access.restaurant.id};
  const result=await db.batch([
    db.prepare(`UPDATE restaurant_configs SET revision=revision+1,updated_at=CURRENT_TIMESTAMP
      WHERE restaurant_id=? AND revision=? AND (SELECT revision FROM platform_policy_state WHERE singleton=1)=?
      AND ${liveActorSQL(actor)} AND (${guard})`)
      .bind(tenant,body.revision,body.policy_revision,...liveActorParams(access.session,actor),...guardParams),
    db.prepare(sql).bind(...params),
    db.prepare("INSERT INTO platform_audit_logs(actor_user_id,action,target_type,target_id,request_id,after_json) SELECT ?,?,'restaurant',?,?,? WHERE changes()=1")
      .bind(access.session.user_id,action,tenant,crypto.randomUUID(),JSON.stringify({entity_id:id,draft_revision:body.revision+1}))
  ]);
  if(!result[0].meta.changes||!result[1].meta.changes)fail(409,'The menu or your access changed. Reload before saving.');
  return {id,revision:body.revision+1,policy_revision:body.policy_revision};
}
export async function ownedItem(db,tenant,id) {
  const item=await db.prepare('SELECT * FROM menu_items WHERE id=? AND restaurant_id=? AND deleted_at IS NULL').bind(id,tenant).first();
  if(!item)fail(404,'Menu item not found.');
  return item;
}

