import {FEATURES,FEATURE_KEYS,hasFeature} from './registry.mjs';
import {validateFeatures} from './validation.mjs';
import {publishedContext} from '../publications/context.mjs';
import {fail,input,response} from '../auth/http.mjs';
import {digest} from '../auth/passwords.mjs';
const EVENT_FEATURE={menu_view:'analytics.collection',search:'menu.search',call_click:'contact.call',directions_click:'contact.directions',review_click:'contact.google_review',share:'guest.share',qr_download:'guest.qr_download'};
export function validateManifest(value){
  if(!value||value.version!==1||typeof value.template_id!=='string'||!Number.isSafeInteger(value.template_version))fail(503,'Published capabilities need initialization.');
  validateFeatures(value.requested,{complete:true});validateFeatures(value.ready,{complete:true});return value;
}
export async function publishedCapability(db,slug,key){
  if(!hasFeature(key))fail(400,'Unknown feature.');
  const context=await publishedContext(db,slug,'capabilities');
  const manifest=validateManifest(context.snapshot.capabilities),policy=context.policy,p=policy.byKey[key],supported=context.supported||[];
  const enabled=!!p?.allowed&&(p.forced_value===null?manifest.requested[key]:p.forced_value===1)&&manifest.ready[key]&&supported.includes(key);
  if(!enabled)fail(403,'This feature is disabled.');
  return {restaurant_id:context.restaurant_id,publication_revision:context.revision,policy_revision:policy.revision,manifest,policy:policy.byKey};
}
async function limit(db,request,tenant){
  const t=Math.floor(Date.now()/1000),window=900,key=digest(`public:${tenant}:${request.headers.get('CF-Connecting-IP')||'unknown'}:${Math.floor(t/window)}`);
  const result=await db.prepare('INSERT INTO public_request_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,(Math.floor(t/window)+1)*window).first();if(result.count>60)fail(429,'Too many requests. Try again later.');
}
function gateSQL(){return `EXISTS(SELECT 1 FROM restaurants r JOIN restaurant_publication_heads h ON h.restaurant_id=r.id WHERE r.id=? AND r.status='active' AND h.revision=?) AND (SELECT revision FROM platform_policy_state WHERE singleton=1)=?`;}
function policyGuard(key,cap){const p=cap.policy[key];return {sql:'EXISTS(SELECT 1 FROM feature_policies WHERE feature_key=? AND revision=? AND allowed=1 AND COALESCE(forced_value,?)=1)',params:[key,p.revision,Number(cap.manifest.requested[key])]};}
export async function publicCapabilityRoute(request,env){
  const match=/^\/api\/public\/menus\/([^/]+)\/(feedback|events)$/.exec(new URL(request.url).pathname);if(!match)return null;
  if(request.method!=='POST')return response({error:'Method not allowed.'},405,{Allow:'POST'});
  const slug=decodeURIComponent(match[1]),body=await input(request),key=match[2]==='feedback'?'guest.feedback':'analytics.collection',cap=await publishedCapability(env.DB,slug,key);
  await limit(env.DB,request,cap.restaurant_id);
  const guard=policyGuard(key,cap),params=[cap.restaurant_id,cap.publication_revision,cap.policy_revision,...guard.params];
  if(match[2]==='feedback'){
    if(Object.keys(body).some(k=>!['message','rating'].includes(k))||typeof body.message!=='string'||!body.message.trim()||body.message.trim().length>3000||(body.rating!==undefined&&(!Number.isInteger(body.rating)||body.rating<1||body.rating>5)))fail(400,'Enter feedback and an optional rating from 1 to 5.');
    const r=await env.DB.prepare(`INSERT INTO feedback(id,restaurant_id,message,rating) SELECT ?,?,?,? WHERE ${gateSQL()} AND ${guard.sql}`).bind(crypto.randomUUID(),cap.restaurant_id,body.message.trim(),body.rating??null,...params).run();if(!r.meta.changes)fail(409,'The menu or feature policy changed. Reload and try again.');return response({ok:true},201);
  }
  if(Object.keys(body).some(k=>k!=='event')||!Object.hasOwn(EVENT_FEATURE,body.event))fail(400,'Choose a supported anonymous menu event.');
  const eventKey=EVENT_FEATURE[body.event];
  // An event for a hidden/disabled module cannot be collected even when analytics is on.
  if(eventKey!==key){const p=cap.policy[eventKey],allowed=!!p?.allowed&&(p.forced_value===null?cap.manifest.requested[eventKey]:p.forced_value===1)&&cap.manifest.ready[eventKey];if(!allowed)fail(403,'This event is disabled.');}
  const eventGuard=policyGuard(eventKey,cap);
  const r=await env.DB.prepare(`INSERT INTO daily_analytics(restaurant_id,day,event_type,count) SELECT ?,date('now'),?,1 WHERE ${gateSQL()} AND ${guard.sql} AND ${eventGuard.sql} ON CONFLICT(restaurant_id,day,event_type) DO UPDATE SET count=count+1`)
    .bind(cap.restaurant_id,body.event,...params,...eventGuard.params).run();if(!r.meta.changes)fail(409,'The menu or feature policy changed. Reload and try again.');return response({ok:true},202);
}
export async function cleanupPublicLimits(db){await db.prepare('DELETE FROM public_request_limits WHERE key IN(SELECT key FROM public_request_limits WHERE expires_at<=? ORDER BY expires_at LIMIT 500)').bind(Math.floor(Date.now()/1000)).run();}
export const capabilityKeys=Object.keys(FEATURES);
