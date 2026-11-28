import {DEFAULT_CONTENT,DEFAULT_THEME,DEFAULT_FEATURES,FEATURE_KEYS,hasFeature} from './registry.mjs';
import {fail} from '../auth/http.mjs';
export const LOCALES=['en','am','om','ti'];
export const LABELS=['vegetarian','vegan','gluten_free','contains_milk','contains_egg','contains_nuts','contains_gluten'];
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function keys(value,allowed,name){if(!object(value)||Object.keys(value).some(k=>!allowed.includes(k)))fail(400,`Invalid ${name}. Unknown fields are not accepted.`);}
function text(v,max,name){if(typeof v!=='string'||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))fail(400,`Invalid ${name}.`);return v.trim();}
const domains={instagram:['instagram.com'],facebook:['facebook.com','fb.com'],tiktok:['tiktok.com'],youtube:['youtube.com','youtu.be'],telegram:['t.me','telegram.me'],whatsapp:['wa.me','api.whatsapp.com','whatsapp.com'],linkedin:['linkedin.com'],directions:['google.com','maps.app.goo.gl','share.google'],review:['google.com','g.page','maps.app.goo.gl','share.google']};
export function safeURL(value,kind='website'){
  if(typeof value!=='string'||!value||value.length>2048)return null;
  try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port||!u.hostname.includes('.')||/^\d+(\.\d+){3}$/.test(u.hostname)||u.hostname.includes(':')||/\.(local|internal|invalid)$/.test(u.hostname))return null;
    const allowed=domains[kind];if(allowed&&!allowed.some(d=>u.hostname===d||u.hostname.endsWith('.'+d)))return null;return u.href;
  }catch{return null;}
}
export const safePhone=value=>typeof value==='string'&&/^\+[1-9][0-9]{7,14}$/.test(value)?value:null;
export function validateFeatures(value,{complete=false}={}){
  keys(value,FEATURE_KEYS,'features');if(Object.values(value).some(v=>typeof v!=='boolean')||(complete&&FEATURE_KEYS.some(k=>!Object.hasOwn(value,k))))fail(400,'Features must contain explicit boolean values.');return {...value};
}
export function validateTheme(value,{complete=false}={}){
  keys(value,Object.keys(DEFAULT_THEME),'theme');const out={...DEFAULT_THEME,...value};
  for(const key of ['background','surface','text','accent'])if(!/^#[a-fA-F0-9]{6}$/.test(out[key]))fail(400,'Use six-digit hexadecimal colors.');
  if(!['system','serif','rounded'].includes(out.font)||!['square','soft','round'].includes(out.radius))fail(400,'Choose a supported font and corner style.');
  if(complete&&Object.keys(DEFAULT_THEME).some(k=>!Object.hasOwn(value,k)))fail(400,'Theme tokens are incomplete.');return out;
}
export function validateContent(value,{complete=false}={}){
  keys(value,Object.keys(DEFAULT_CONTENT),'content settings');const c=structuredClone({...DEFAULT_CONTENT,...value});
  for(const [key,val]of Object.entries(c)){
    if(key.endsWith('_url')){const raw=text(val,2048,key),kind=key==='google_maps_url'?'directions':key==='google_review_url'?'review':key.replace('_url','');if(raw&&!safeURL(raw,kind))fail(400,`Enter a valid HTTPS link for ${key.replaceAll('_',' ')}.`);c[key]=raw?safeURL(raw,kind):'';}
  }
  c.phone=text(c.phone,32,'phone');if(c.phone&&!safePhone(c.phone))fail(400,'Use an international phone number such as +251 followed by the number.');
  c.story=text(c.story,3000,'story');keys(c.cover_focal,['x','y'],'cover focal point');if(['x','y'].some(k=>!Number.isFinite(c.cover_focal[k])||c.cover_focal[k]<0||c.cover_focal[k]>100))fail(400,'Cover focal point must be between 0 and 100.');
  if(!Array.isArray(c.languages)||c.languages[0]!=='en'||c.languages.length>4||new Set(c.languages).size!==c.languages.length||c.languages.some(l=>!LOCALES.includes(l)))fail(400,'Choose English first, followed by supported languages.');
  keys(c.pricing,['mode','vat_rate','service_rate','text','placement'],'price disclosure');const p=c.pricing;
  if(!['included','excluded','custom'].includes(p.mode)||p.placement!=='bottom'||[p.vat_rate,p.service_rate].some(v=>v!==null&&(!Number.isFinite(v)||v<0||v>100)))fail(400,'Check disclosure mode and percentage rates. Disclosure belongs at the bottom.');p.text=text(p.text,280,'price disclosure text');
  keys(c.wifi,['network_name','password','public_name','public_password'],'Wi-Fi');const w=c.wifi;w.network_name=text(w.network_name,120,'Wi-Fi name');w.password=text(w.password,256,'Wi-Fi password');
  if(typeof w.public_name!=='boolean'||typeof w.public_password!=='boolean'||(w.public_password&&!w.public_name))fail(400,'Explicitly choose which Wi-Fi details may be public.');
  if(!object(c.item_labels)||Object.keys(c.item_labels).length>200)fail(400,'Invalid item labels.');
  for(const [id,labels]of Object.entries(c.item_labels))if(id.length<1||id.length>100||!Array.isArray(labels)||labels.length>LABELS.length||new Set(labels).size!==labels.length||labels.some(l=>!LABELS.includes(l)))fail(400,'Use supported dietary/allergen labels for each item.');
  if(complete&&Object.keys(DEFAULT_CONTENT).some(k=>!Object.hasOwn(value,k)))fail(400,'Content settings are incomplete.');return c;
}
export function validateConfig(config){
  keys(config,['schema_version','template_id','template_version','features','theme','content_settings'],'configuration');
  if(config.schema_version!==2||typeof config.template_id!=='string'||!config.template_id||!Number.isSafeInteger(config.template_version)||config.template_version<1)fail(400,'Unsupported configuration version or template.');
  return {...config,features:validateFeatures(config.features,{complete:true}),theme:validateTheme(config.theme,{complete:true}),content_settings:validateContent(config.content_settings,{complete:true})};
}
export function migrateV1(config,restaurant={}){
  if(config.schema_version!==1)fail(400,'No adapter exists for this configuration version.');
  validateFeatures(config.features);const content=structuredClone(DEFAULT_CONTENT);
  for(const key of Object.keys(content))if(key.endsWith('_url')&&restaurant[key])content[key]=safeURL(restaurant[key],key==='google_maps_url'?'directions':key==='google_review_url'?'review':key.replace('_url',''))||'';
  content.cover_url=safeURL(restaurant.cover_image_url,'cover')||'';content.phone=safePhone(restaurant.phone)||'';
  // Explicit snapshots, rather than applying future preset edits to existing tenants.
  return validateConfig({schema_version:2,template_id:'classic',template_version:2,features:{...DEFAULT_FEATURES,...config.features,...(restaurant.slug==='occasion'?{'guest.hours':false}:{})},theme:{...DEFAULT_THEME,...config.theme},content_settings:{...content,...config.content_settings}});
}
export function mergePatch(current,patch){
  keys(patch,['revision','policy_revision','schema_version','template_id','template_version','features','theme','content_settings'],'configuration patch');
  if(!Number.isSafeInteger(patch.revision)||patch.revision<1||!Number.isSafeInteger(patch.policy_revision)||patch.policy_revision<1)fail(400,'Supply the current settings and platform revisions.');
  if(patch.features!==undefined)validateFeatures(patch.features);
  if(patch.theme!==undefined)validateTheme(patch.theme);
  if(patch.content_settings!==undefined)keys(patch.content_settings,Object.keys(DEFAULT_CONTENT),'content settings');
  const c={...current,schema_version:patch.schema_version??current.schema_version,template_id:patch.template_id??current.template_id,template_version:patch.template_version??current.template_version,features:{...current.features,...patch.features},theme:{...current.theme,...patch.theme},content_settings:{...current.content_settings,...patch.content_settings}};
  // Nested objects are complete replacements; partial nested changes cannot silently erase private fields.
  return validateConfig(c);
}
export const registryKnown=key=>hasFeature(key);
