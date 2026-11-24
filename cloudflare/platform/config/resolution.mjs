import {FEATURES,FEATURE_KEYS} from './registry.mjs';
import {safeURL,safePhone} from './validation.mjs';
const hasText=v=>typeof v==='string'&&v.trim().length>0;
export function readiness(config,data={}){
  const c=config.content_settings,items=data.items||[],categories=data.categories||[],variants=data.variants||[],translations=data.translations||[];
  const result={none:true,items:items.length>0,categories:categories.length>0,popular:items.some(i=>i.is_popular===1),item_images:items.some(i=>safeURL(i.image_url,'image')),descriptions:items.some(i=>hasText(i.description)),variants:variants.some(v=>v.is_active===1&&Number.isSafeInteger(v.price_minor)&&v.price_minor>=0&&items.some(i=>i.id===v.menu_item_id)),labels:items.some(i=>Object.hasOwn(c.item_labels,i.id)&&c.item_labels[i.id].length>0),cover:!!safeURL(c.cover_url,'image'),logo:!!safeURL(c.logo_url,'image'),phone:!!safePhone(c.phone),directions:!!safeURL(c.google_maps_url,'directions'),review:!!safeURL(c.google_review_url,'review'),hours:(data.hours||[]).some(h=>h.is_closed===1||(/^([01]\d|2[0-3]):[0-5]\d$/.test(h.opens_at)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(h.closes_at)))&&!!data.timezone,wifi:c.wifi.public_name&&hasText(c.wifi.network_name),translations:c.languages.length>1&&translations.some(t=>c.languages.includes(t.locale)),pricing:c.pricing.mode!=='custom'||hasText(c.pricing.text),story:hasText(c.story)};
  for(const name of ['instagram','facebook','tiktok','youtube','telegram','whatsapp','linkedin','website'])result[name]=!!safeURL(c[name+'_url'],name);
  return result;
}
export function resolveFeatures(config,policies,supported,data={},role='manager'){
  const available=new Set(supported),deps=readiness(config,data),result={};
  for(const key of FEATURE_KEYS){const entry=FEATURES[key],p=policies[key],requested=config.features[key],effectiveRequested=p?.forced_value===null?requested:p?.forced_value===1;
    const ready=available.has(key)&&!!deps[entry.dependency],enabled=!!p?.allowed&&effectiveRequested&&ready;
    const lock=!p?.allowed?'platform_disabled':p.forced_value!==null?'platform_forced':role!=='super_admin'&&(!p.manager_editable||!entry.manager_editable)?'manager_locked':null;
    const reason=!p?.allowed?'platform_disabled':!available.has(key)?'template_unsupported':p.forced_value===0?'platform_forced_off':!effectiveRequested?'not_requested':!ready?'missing_data':'enabled';
    result[key]={requested,effective_requested:!!effectiveRequested,enabled,ready,locked:!!lock,lock_reason:lock,reason};
  }
  return result;
}
export function publicProjection(config,states,restaurant,data={},locale='en'){
  const enabled=k=>!!states[k]?.enabled,c=config.content_settings;
  const selected=enabled('guest.language')&&c.languages.includes(locale)?locale:'en';
  const dto={schema_version:1,restaurant:{id:restaurant.id,name:restaurant.name,slug:restaurant.slug,currency:restaurant.currency||'ETB'},theme:{...config.theme},locale:selected,features:Object.fromEntries(FEATURE_KEYS.map(k=>[k,enabled(k)])),items:[]};
  if(enabled('brand.cover'))dto.cover={url:safeURL(c.cover_url,'image'),focal:{...c.cover_focal}};
  if(enabled('brand.logo'))dto.logo_url=safeURL(c.logo_url,'image');
  if(enabled('menu.story'))dto.story=c.story;
  const contact={};if(enabled('contact.call'))contact.phone=safePhone(c.phone);if(enabled('contact.directions'))contact.google_maps_url=safeURL(c.google_maps_url,'directions');if(enabled('contact.google_review'))contact.google_review_url=safeURL(c.google_review_url,'review');
  for(const name of ['instagram','facebook','tiktok','youtube','telegram','whatsapp','linkedin','website'])if(enabled('contact.social.'+name))contact[name+'_url']=safeURL(c[name+'_url'],name);
  if(Object.keys(contact).length)dto.contact=contact;
  if(enabled('guest.wifi')){dto.wifi={network_name:c.wifi.network_name};if(c.wifi.public_password&&c.wifi.password)dto.wifi.password=c.wifi.password;}
  if(enabled('guest.hours'))dto.hours={timezone:data.timezone,days:(data.hours||[]).filter(h=>h.is_closed===1||(/^([01]\d|2[0-3]):[0-5]\d$/.test(h.opens_at)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(h.closes_at))).map(h=>({weekday:h.weekday,is_closed:!!h.is_closed,...(h.is_closed?{}:{opens_at:h.opens_at,closes_at:h.closes_at})}))};
  if(enabled('pricing.disclosure'))dto.pricing_disclosure={...c.pricing,placement:'bottom'};
  if(enabled('guest.language'))dto.languages=[...c.languages];
  if(enabled('menu.categories'))dto.categories=(data.categories||[]).map(cat=>({id:cat.id,name:cat.name}));
  for(const item of data.items||[]){const translation=selected==='en'?null:(data.translations||[]).find(t=>t.menu_item_id===item.id&&t.locale===selected);
    const out={id:item.id,name:translation?.name||item.name,price:item.price};
    // Category ownership is checked by the database; hidden navigation does not hide items.
    if(enabled('menu.categories')&&item.category_id)out.category_id=item.category_id;
    if(enabled('menu.descriptions')&&hasText(translation?.description||item.description))out.description=translation?.description||item.description;
    if(enabled('menu.item_images')&&safeURL(item.image_url,'image'))out.image_url=safeURL(item.image_url,'image');
    if(enabled('menu.popular')&&item.is_popular)out.popular=true;
    if(enabled('menu.variants')){const vs=(data.variants||[]).filter(v=>v.menu_item_id===item.id&&v.is_active===1&&Number.isSafeInteger(v.price_minor)&&v.price_minor>=0);if(vs.length)out.variants=vs.map(v=>({id:v.id,label:v.label,price_minor:v.price_minor}));}
    if(enabled('menu.dietary_labels')&&Object.hasOwn(c.item_labels,item.id)&&c.item_labels[item.id].length)out.labels=[...c.item_labels[item.id]];
    dto.items.push(out);
  }
  return dto;
}
// A publication carries capability metadata, never hidden Wi-Fi fields or account data.
export function capabilityManifest(config,states){return {version:1,template_id:config.template_id,template_version:config.template_version,requested:{...config.features},ready:Object.fromEntries(FEATURE_KEYS.map(k=>[k,states[k].ready]))};}
