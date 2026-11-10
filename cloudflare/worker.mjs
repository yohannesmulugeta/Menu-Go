import { createRemoteJWKSet, jwtVerify } from 'jose';

class HttpError extends Error { constructor(status,message){super(message);this.status=status;} }
const fail=(status,message)=>{throw new HttpError(status,message);};
const securityHeaders={
 'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'strict-origin-when-cross-origin',
 'Permissions-Policy':'camera=(),microphone=(),geolocation=()',
 'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...securityHeaders,'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store'}});
const str=(value,label,max=200,required=false)=>{
 if(value==null)value='';
 if(typeof value!=='string'||value.trim().length>max||(required&&!value.trim()))fail(400,`Enter a valid ${label}.`);
 return value.trim();
};
const bool=(value,label)=>{if(typeof value!=='boolean')fail(400,`${label} must be true or false.`);return Number(value);};
const id=(value)=>str(value,'record ID',100,true);
const now=()=>new Date().toISOString();
const encode=encodeURIComponent;
async function digest(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join('');}
function validateUrl(value,label){
 if(value==null||value==='')return null;
 const clean=str(value,label,2048);
 if(/^\/(?:media|migrated-media)\/[a-zA-Z0-9/_.-]+$/.test(clean))return clean;
 try{const url=new URL(clean);if(['https:','http:'].includes(url.protocol))return url.href;}catch{}
 fail(400,`${label} must be an HTTP or HTTPS link.`);
}
async function readJson(request,max=16384){
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))fail(415,'Expected a JSON request.');
 const bytes=await readBytes(request,max);
 try{const data=JSON.parse(new TextDecoder().decode(bytes));if(!data||typeof data!=='object'||Array.isArray(data))fail(400,'Expected a JSON object.');return data;}catch(e){if(e instanceof HttpError)throw e;fail(400,'Invalid JSON.');}
}
async function readBytes(request,max){
 if(Number(request.headers.get('Content-Length'))>max)fail(413,'The upload is too large.');
 const reader=request.body?.getReader();if(!reader)fail(400,'Request body is required.');
 const chunks=[];let length=0;
 while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>max){await reader.cancel();fail(413,'The upload is too large.');}chunks.push(value);}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
function sameOrigin(request){
 if(request.headers.get('Origin')!==new URL(request.url).origin||request.headers.get('X-Menu-Request')!=='1')fail(403,'Request origin is not allowed.');
}
const toBool=row=>({...row,...('is_active'in row?{is_active:Boolean(row.is_active)}:{}),...('is_available'in row?{is_available:Boolean(row.is_available),is_popular:Boolean(row.is_popular),price:Number(row.price)}:{}),...('is_closed'in row?{is_closed:Boolean(row.is_closed)}:{})});
const decodeJSON=value=>value==null?null:JSON.parse(value);
const EVENT_TYPES=new Set(['page_view','menu_view','qr_scan','review_click','directions_click','wifi_click','feedback_open','feedback_submit']);
const REST_FIELDS=new Set(['name','tagline','description','phone','address','google_maps_url','google_review_url','instagram_url','tiktok_url','facebook_url','youtube_url','telegram_url','whatsapp_url','linkedin_url','website_url','logo_url','cover_image_url','currency','timezone','status']);

export function createApp({keyResolver}={}){
 const jwksByIssuer=new Map();
 async function verifiedIdentity(request,env,optional=false){
  const token=request.headers.get('Cf-Access-Jwt-Assertion')||request.headers.get('Cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('CF_Authorization='))?.slice(17);
  if(!token){if(optional)return null;fail(401,'Verify your email to sign in.');}
  if(!env.ACCESS_ISSUER||!env.ACCESS_AUD)fail(503,'Email sign-in is not configured.');
  try{
   if(!jwksByIssuer.has(env.ACCESS_ISSUER))jwksByIssuer.set(env.ACCESS_ISSUER,createRemoteJWKSet(new URL(env.ACCESS_ISSUER+'/cdn-cgi/access/certs')));
   const {payload}=await jwtVerify(token,keyResolver||jwksByIssuer.get(env.ACCESS_ISSUER),{issuer:env.ACCESS_ISSUER,audience:env.ACCESS_AUD,algorithms:['RS256'],requiredClaims:['sub','email','exp','iat'],clockTolerance:5});
   if(payload.type!=='app'||typeof payload.email!=='string'||!payload.email.includes('@'))fail(401,'Invalid email verification.');
   const email=payload.email.trim().toLowerCase();
   const user=await env.DB.prepare('SELECT * FROM users WHERE email=? COLLATE NOCASE').bind(email).first();
   if(user?.disabled)fail(403,'This account has been disabled.');
   return {email,user,subject:payload.sub};
  }catch(error){if(error instanceof HttpError)throw error;if(optional)return null;fail(401,'Your sign-in expired. Please verify your email again.');}
 }
 async function member(request,env,restaurantId){
  const identity=await verifiedIdentity(request,env);
  if(!identity.user)fail(403,'This email has no restaurant access. Accept your invitation first.');
  const admin=await env.DB.prepare('SELECT user_id FROM platform_admins WHERE user_id=?').bind(identity.user.id).first();
  if(!admin&&!await env.DB.prepare("SELECT id FROM restaurant_members WHERE user_id=? AND restaurant_id=? AND role='manager'").bind(identity.user.id,restaurantId).first())fail(403,'You cannot manage this restaurant.');
  return {...identity,isAdmin:Boolean(admin)};
 }
 async function platform(request,env){
  const identity=await verifiedIdentity(request,env);
  if(!identity.user||!await env.DB.prepare('SELECT user_id FROM platform_admins WHERE user_id=?').bind(identity.user.id).first())fail(403,'Platform administrator access is required.');
  return {...identity,isAdmin:true};
 }
 function audit(env,identity,restaurantId,action,entityType,entityId,oldData,newData){
  return env.DB.prepare('INSERT INTO audit_logs(restaurant_id,actor_user_id,action,entity_type,entity_id,old_data,new_data) VALUES(?,?,?,?,?,?,?)').bind(restaurantId,identity.user.id,action,entityType,entityId,oldData==null?null:JSON.stringify(oldData),newData==null?null:JSON.stringify(newData));
 }
 async function requireRestaurant(env,restaurantId){const row=await env.DB.prepare('SELECT * FROM restaurants WHERE id=?').bind(restaurantId).first();if(!row)fail(404,'Restaurant not found.');return row;}
 async function publicLimit(request,env,restaurantId,kind,limit){
  const slot=Math.floor(Date.now()/600000),ip=request.headers.get('CF-Connecting-IP')||'unknown';
  const key=await digest([slot,ip,restaurantId,kind].join('|'));
  const row=await env.DB.prepare('INSERT INTO public_request_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,(slot+1)*600).first();
  if(row.count>limit)fail(429,'Too many requests. Please try again later.');
  if(Math.random()<0.01)await env.DB.prepare('DELETE FROM public_request_limits WHERE expires_at < ?').bind(Math.floor(Date.now()/1000)).run();
 }
 async function route(request,env){
  const url=new URL(request.url),path=url.pathname,method=request.method;
  if(method==='OPTIONS')return json({error:'Cross-origin requests are not allowed.'},403);
  if(path.startsWith('/api/')&&!['GET','HEAD'].includes(method))sameOrigin(request);
  if(path==='/api/health'&&method==='GET'){
   if(!env.DB)fail(503,'Database binding missing.');await env.DB.prepare('SELECT 1 FROM restaurants LIMIT 1').first();
   return json({ok:true,database:'Cloudflare D1',authentication:'Cloudflare Access',uploads:env.MEDIA?'ready':'R2 activation required',runtime:'Cloudflare'});
  }
  if(path==='/api/auth/login'&&method==='GET'){
   await verifiedIdentity(request,env);
   const destination=url.searchParams.get('returnTo')||'/#/login';
   if(!destination.startsWith('/#/')||destination.includes('\\')||destination.includes('\n'))fail(400,'Invalid return address.');
   return Response.redirect(new URL(destination,url.origin).href,302);
  }
  if(path==='/api/session'&&method==='GET'){
   const identity=await verifiedIdentity(request,env,true);
   if(!identity)return json(null);
   const admin=identity.user?Boolean(await env.DB.prepare('SELECT user_id FROM platform_admins WHERE user_id=?').bind(identity.user.id).first()):false;
   return json({user:{id:identity.user?.id||identity.subject,email:identity.email},platform_admin:admin});
  }
  const guest=path.match(/^\/api\/restaurants\/([a-z0-9-]+)$/);
  if(guest&&method==='GET'){
   const restaurant=await env.DB.prepare("SELECT * FROM restaurants WHERE slug=? AND status='active'").bind(guest[1]).first();
   if(!restaurant)fail(404,'Restaurant not found or not available.');
   const [categories,items,hours,wifi]=await env.DB.batch([
    env.DB.prepare('SELECT id,name,sort_order FROM categories WHERE restaurant_id=? AND is_active=1 AND deleted_at IS NULL ORDER BY sort_order,name').bind(restaurant.id),
    env.DB.prepare('SELECT m.* FROM menu_items m LEFT JOIN categories c ON c.id=m.category_id AND c.restaurant_id=m.restaurant_id WHERE m.restaurant_id=? AND m.is_available=1 AND m.deleted_at IS NULL AND (m.category_id IS NULL OR (c.is_active=1 AND c.deleted_at IS NULL)) ORDER BY m.sort_order,m.created_at,m.id').bind(restaurant.id),
    env.DB.prepare('SELECT weekday,opens_at,closes_at,is_closed FROM opening_hours WHERE restaurant_id=? ORDER BY weekday').bind(restaurant.id),
    env.DB.prepare('SELECT network_name,password_hint,is_visible FROM wifi_details WHERE restaurant_id=? AND is_visible=1').bind(restaurant.id),
   ]);
   return json({restaurant,categories:categories.results,items:items.results.map(toBool),hours:hours.results.map(toBool),wifi:wifi.results[0]||null});
  }
  const publicWrite=path.match(/^\/api\/restaurants\/([a-zA-Z0-9-]+)\/(feedback|events)$/);
  if(publicWrite&&method==='POST'){
   const restaurant=await requireRestaurant(env,publicWrite[1]);if(restaurant.status!=='active')fail(404,'Restaurant not found.');
   const kind=publicWrite[2];await publicLimit(request,env,restaurant.id,kind,kind==='feedback'?5:180);
   const input=await readJson(request,8192);
   if(kind==='feedback'){
    const message=str(input.message,'feedback message',3000,true);
    await env.DB.prepare('INSERT INTO feedback(id,restaurant_id,message) VALUES(?,?,?)').bind(crypto.randomUUID(),restaurant.id,message).run();
   }else{
    if(!EVENT_TYPES.has(input.event_type))fail(400,'Invalid event type.');
    const metadata=input.metadata||{};if(typeof metadata!=='object'||Array.isArray(metadata)||JSON.stringify(metadata).length>1024)fail(400,'Invalid event metadata.');
    // Only the public page slug is needed for existing analytics. Discard other
    // visitor-supplied metadata to avoid collecting unnecessary personal data.
    const clean=typeof metadata.slug==='string'?{slug:str(metadata.slug,'slug',120)}:{};
    await env.DB.prepare('INSERT INTO analytics_events(restaurant_id,event_type,metadata) VALUES(?,?,?)').bind(restaurant.id,input.event_type,JSON.stringify(clean)).run();
   }return json({ok:true},201);
  }
  if(path==='/api/invites/redeem'&&method==='POST'){
   const identity=await verifiedIdentity(request,env),input=await readJson(request),code=str(input.code,'invitation code',200,true);
   const codeHash=await digest(code),timestamp=now();
   const invite=await env.DB.prepare('SELECT * FROM restaurant_invites WHERE code_hash=? AND invitee_email=? COLLATE NOCASE AND used_at IS NULL AND julianday(expires_at)>julianday(?)').bind(codeHash,identity.email,timestamp).first();
   if(!invite)fail(400,'This invitation is invalid, expired, already used, or belongs to another email.');
   const userId=identity.user?.id||crypto.randomUUID(),memberId=crypto.randomUUID(),claimId=crypto.randomUUID();
   // Consume, create user and grant membership in one transaction. Every
   // dependent statement checks the unique claim timestamp, so a replay cannot
   // grant access or create a user after losing a concurrent claim.
   const result=await env.DB.batch([
    env.DB.prepare('UPDATE restaurant_invites SET used_at=?,claim_id=? WHERE id=? AND used_at IS NULL AND julianday(expires_at)>julianday(?)').bind(timestamp,claimId,invite.id,timestamp),
    env.DB.prepare('INSERT INTO users(id,email,email_confirmed_at) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM restaurant_invites WHERE id=? AND claim_id=?) ON CONFLICT(email) DO NOTHING').bind(userId,identity.email,timestamp,invite.id,claimId),
    env.DB.prepare("INSERT INTO restaurant_members(id,restaurant_id,user_id,role) SELECT ?,?,u.id,'manager' FROM users u WHERE u.email=? COLLATE NOCASE AND u.disabled=0 AND EXISTS(SELECT 1 FROM restaurant_invites WHERE id=? AND claim_id=?) ON CONFLICT(restaurant_id,user_id) DO NOTHING").bind(memberId,invite.restaurant_id,identity.email,invite.id,claimId),
   ]);
   if(!result[0].meta.changes)fail(409,'This invitation has already been used.');
   return json({restaurant_id:invite.restaurant_id});
  }
  if(path==='/api/admin/my-restaurant'&&method==='GET'){
   const identity=await verifiedIdentity(request,env);if(!identity.user)return json(null);
   const requested=url.searchParams.get('restaurant_id');
   if(requested){const access=await member(request,env,requested);return json({restaurant:await requireRestaurant(env,requested),role:access.isAdmin?'platform_admin':'restaurant_manager'});}
   const restaurant=await env.DB.prepare("SELECT r.* FROM restaurants r JOIN restaurant_members m ON m.restaurant_id=r.id WHERE m.user_id=? AND m.role='manager' ORDER BY m.created_at LIMIT 1").bind(identity.user.id).first();
   return json(restaurant?{restaurant,role:'restaurant_manager'}:null);
  }
  if(path==='/api/admin/restaurants'){
   const identity=await platform(request,env);
   if(method==='GET'){const rows=await env.DB.prepare('SELECT * FROM restaurants ORDER BY created_at DESC').all();return json(rows.results);}
   if(method==='POST'){
    const input=await readJson(request),name=str(input.name,'restaurant name',200,true),slug=str(input.slug,'restaurant link',100,true);
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))fail(400,'Use lowercase letters, numbers and hyphens for the restaurant link.');
    if(await env.DB.prepare('SELECT id FROM restaurants WHERE slug=?').bind(slug).first())fail(409,'This restaurant link is already in use.');
    const rid=crypto.randomUUID(),data={name,slug,tagline:str(input.tagline,'tagline',500)||null,address:str(input.address,'address',1000)||null};
    await env.DB.batch([env.DB.prepare("INSERT INTO restaurants(id,name,slug,tagline,address,status) VALUES(?,?,?,?,?,'draft')").bind(rid,name,slug,data.tagline,data.address),audit(env,identity,rid,'INSERT','restaurants',rid,null,data)]);
    return json({restaurant_id:rid,slug},201);
   }fail(405,'Method not allowed.');
  }
  const admin=path.match(/^\/api\/admin\/restaurants\/([a-zA-Z0-9-]+)(?:\/(categories|items|hours|feedback|analytics|audit|invites|uploads|wifi)(?:\/([a-zA-Z0-9-]+))?)?$/);
  if(admin){
   const [,rid,resource,entityId]=admin,identity=await member(request,env,rid),restaurant=await requireRestaurant(env,rid);
   if(!resource&&method==='GET')return json(restaurant);
   if(!resource&&method==='PATCH'){
    const input=await readJson(request),updates={};
    for(const [field,value] of Object.entries(input)){
     if(!REST_FIELDS.has(field))fail(400,`Cannot edit ${field}.`);
     if(field==='status'){if(!identity.isAdmin)fail(403,'Only the platform administrator can change restaurant status.');if(!['active','draft','suspended'].includes(value))fail(400,'Invalid restaurant status.');updates[field]=value;}
     else if(field.endsWith('_url'))updates[field]=validateUrl(value,field);
     else {updates[field]=str(value,field,field==='description'?10000:field==='address'?1000:500,field==='name'||field==='currency'||field==='timezone')||null;}
    }
    if(!Object.keys(updates).length)fail(400,'No changes supplied.');
    updates.updated_at=now();const fields=Object.keys(updates);
    await env.DB.batch([env.DB.prepare('UPDATE restaurants SET '+fields.map(f=>f+'=?').join(',')+' WHERE id=?').bind(...fields.map(f=>updates[f]),rid),audit(env,identity,rid,'UPDATE','restaurants',rid,restaurant,updates)]);return json({ok:true});
   }
   if(resource==='categories'){
    if(method==='GET'&&!entityId)return json((await env.DB.prepare('SELECT * FROM categories WHERE restaurant_id=? AND deleted_at IS NULL ORDER BY sort_order,name').bind(rid).all()).results.map(toBool));
    if(method==='POST'||method==='PUT'){
     if((method==='PUT')!==Boolean(entityId))fail(405,'Method not allowed.');
     const input=await readJson(request),name=str(input.name,'category name',120,true),cid=entityId||crypto.randomUUID();
     const old=entityId?await env.DB.prepare('SELECT * FROM categories WHERE id=? AND restaurant_id=? AND deleted_at IS NULL').bind(cid,rid).first():null;
     if(entityId&&!old)fail(404,'Category not found.');
     const active=input.is_active===undefined?(old?.is_active??1):bool(input.is_active,'Category visibility');
     const stmt=entityId?env.DB.prepare('UPDATE categories SET name=?,is_active=? WHERE id=? AND restaurant_id=?').bind(name,active,cid,rid):env.DB.prepare('INSERT INTO categories(id,restaurant_id,name,is_active,sort_order) VALUES(?,?,?,?,(SELECT coalesce(max(sort_order),0)+1 FROM categories WHERE restaurant_id=?))').bind(cid,rid,name,active,rid);
     await env.DB.batch([stmt,audit(env,identity,rid,entityId?'UPDATE':'INSERT','categories',cid,old,{name,is_active:Boolean(active)})]);return json({id:cid},entityId?200:201);
    }
    if(method==='DELETE'&&entityId){
     const old=await env.DB.prepare('SELECT * FROM categories WHERE id=? AND restaurant_id=? AND deleted_at IS NULL').bind(entityId,rid).first();if(!old)fail(404,'Category not found.');
     await env.DB.batch([env.DB.prepare('UPDATE menu_items SET category_id=NULL,version=version+1 WHERE category_id=? AND restaurant_id=?').bind(entityId,rid),env.DB.prepare('UPDATE categories SET deleted_at=? WHERE id=? AND restaurant_id=?').bind(now(),entityId,rid),audit(env,identity,rid,'DELETE','categories',entityId,old,null)]);return json({ok:true});
    }
   }
   if(resource==='items'){
    if(method==='GET'&&!entityId){const rows=await env.DB.prepare('SELECT m.*,c.name category_name FROM menu_items m LEFT JOIN categories c ON c.id=m.category_id AND c.restaurant_id=m.restaurant_id WHERE m.restaurant_id=? AND m.deleted_at IS NULL ORDER BY m.sort_order,m.created_at,m.id').bind(rid).all();return json(rows.results.map(row=>({...toBool(row),category:row.category_name?{name:row.category_name}:null})));}
    const old=entityId?await env.DB.prepare('SELECT * FROM menu_items WHERE id=? AND restaurant_id=? AND deleted_at IS NULL').bind(entityId,rid).first():null;
    if(entityId&&!old)fail(404,'Menu item not found.');
    if(method==='PATCH'&&entityId){const input=await readJson(request),available=bool(input.is_available,'Availability');await env.DB.batch([env.DB.prepare('UPDATE menu_items SET is_available=?,version=version+1,updated_at=? WHERE id=? AND restaurant_id=?').bind(available,now(),entityId,rid),audit(env,identity,rid,'UPDATE','menu_items',entityId,old,{is_available:Boolean(available)})]);return json({ok:true});}
    if(method==='DELETE'&&entityId){await env.DB.batch([env.DB.prepare('UPDATE menu_items SET deleted_at=?,version=version+1 WHERE id=? AND restaurant_id=?').bind(now(),entityId,rid),audit(env,identity,rid,'DELETE','menu_items',entityId,old,null)]);return json({ok:true});}
    if(method==='POST'&&!entityId||method==='PUT'&&entityId){
     const input=await readJson(request),name=str(input.name,'item name',200,true),description=str(input.description,'description',3000)||null;
     if(typeof input.price!=='number'||!Number.isFinite(input.price)||input.price<0||input.price>9999999.99||Math.abs(input.price*100-Math.round(input.price*100))>0.00001)fail(400,'Enter a non-negative price with at most two decimals.');
     const categoryId=input.category_id?str(input.category_id,'category',100,true):null;
     if(categoryId&&!await env.DB.prepare('SELECT id FROM categories WHERE id=? AND restaurant_id=? AND deleted_at IS NULL').bind(categoryId,rid).first())fail(400,'Choose a category from this restaurant.');
     const values={name,description,price:Math.round(input.price*100)/100,category_id:categoryId,image_url:validateUrl(input.image_url,'Photo URL'),is_available:bool(input.is_available,'Availability'),is_popular:bool(input.is_popular,'Popular flag')};
     const fields=Object.keys(values),iid=entityId||crypto.randomUUID();let statement;
     if(entityId){if(!Number.isInteger(input.version)||input.version<1)fail(400,'Reload the item before saving.');statement=env.DB.prepare('UPDATE menu_items SET '+fields.map(f=>f+'=?').join(',')+',version=version+1,updated_at=? WHERE id=? AND restaurant_id=? AND version=?').bind(...fields.map(f=>values[f]),now(),iid,rid,input.version);}
     else statement=env.DB.prepare('INSERT INTO menu_items(id,restaurant_id,'+fields.join(',')+') VALUES('+fields.map(()=>'?').concat(['?','?']).join(',')+')').bind(iid,rid,...fields.map(f=>values[f]));
     const log=entityId?env.DB.prepare("INSERT INTO audit_logs(restaurant_id,actor_user_id,action,entity_type,entity_id,old_data,new_data) SELECT ?,?,'UPDATE','menu_items',?,?,? WHERE changes()>0").bind(rid,identity.user.id,iid,JSON.stringify(old),JSON.stringify(values)):audit(env,identity,rid,'INSERT','menu_items',iid,null,values);
     const result=await env.DB.batch([statement,log]);if(!result[0].meta.changes)fail(409,'This item changed. Reload before saving.');return json({id:iid},entityId?200:201);
    }
   }
   if(resource==='hours'){
    if(method==='GET')return json((await env.DB.prepare('SELECT * FROM opening_hours WHERE restaurant_id=? ORDER BY weekday').bind(rid).all()).results.map(toBool));
    if(method==='PUT'){
     const input=await readJson(request);if(!Array.isArray(input.rows)||input.rows.length>7)fail(400,'Provide up to seven opening-hour rows.');
     const weekdays=new Set(),statements=[];
     for(const row of input.rows){if(!Number.isInteger(row.weekday)||row.weekday<0||row.weekday>6||weekdays.has(row.weekday))fail(400,'Each weekday must appear at most once.');weekdays.add(row.weekday);
      for(const field of ['opens_at','closes_at'])if(row[field]&&!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(row[field]))fail(400,'Use valid opening and closing times.');
      const closed=bool(row.is_closed,'Closed flag');if(!closed&&(!row.opens_at||!row.closes_at))fail(400,'Enter opening and closing times.');
      statements.push(env.DB.prepare('INSERT INTO opening_hours(id,restaurant_id,weekday,opens_at,closes_at,is_closed) VALUES(?,?,?,?,?,?) ON CONFLICT(restaurant_id,weekday) DO UPDATE SET opens_at=excluded.opens_at,closes_at=excluded.closes_at,is_closed=excluded.is_closed').bind(crypto.randomUUID(),rid,row.weekday,row.opens_at||null,row.closes_at||null,closed));
     }statements.push(audit(env,identity,rid,'UPDATE','opening_hours',rid,null,input.rows));await env.DB.batch(statements);return json({ok:true});
    }
   }
   if(resource==='feedback'){
    if(method==='GET'&&!entityId)return json((await env.DB.prepare('SELECT * FROM feedback WHERE restaurant_id=? ORDER BY created_at DESC LIMIT 1000').bind(rid).all()).results);
    if(method==='PATCH'&&entityId){const old=await env.DB.prepare('SELECT * FROM feedback WHERE id=? AND restaurant_id=?').bind(entityId,rid).first();if(!old)fail(404,'Feedback not found.');await env.DB.batch([env.DB.prepare("UPDATE feedback SET status='resolved' WHERE id=? AND restaurant_id=?").bind(entityId,rid),audit(env,identity,rid,'UPDATE','feedback',entityId,old,{status:'resolved'})]);return json({ok:true});}
   }
   if(resource==='analytics'&&method==='GET'){const rows=await env.DB.prepare('SELECT event_type,count(*) count FROM analytics_events WHERE restaurant_id=? GROUP BY event_type').bind(rid).all();return json(Object.fromEntries(rows.results.map(r=>[r.event_type,r.count])));}
   if(resource==='audit'&&method==='GET'){const rows=await env.DB.prepare('SELECT * FROM audit_logs WHERE restaurant_id=? ORDER BY created_at DESC,id DESC LIMIT 100').bind(rid).all();return json(rows.results.map(r=>({...r,old_data:decodeJSON(r.old_data),new_data:decodeJSON(r.new_data)})));}
   if(resource==='invites'&&method==='POST'&&!entityId){
    if(!identity.isAdmin)fail(403,'Only the platform administrator can invite managers.');
    const input=await readJson(request),email=str(input.email,'manager email',254,true).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.endsWith('.invalid'))fail(400,'Enter a real manager email address.');
    const code=crypto.randomUUID()+crypto.randomUUID(),hash=await digest(code),timestamp=now(),expiry=new Date(Date.now()+14*86400000).toISOString();
    await env.DB.batch([env.DB.prepare('UPDATE restaurant_invites SET expires_at=? WHERE restaurant_id=? AND used_at IS NULL').bind(timestamp,rid),env.DB.prepare('INSERT INTO restaurant_invites(id,restaurant_id,code_hash,expires_at,created_by,invitee_email) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),rid,hash,expiry,identity.user.id,email),audit(env,identity,rid,'INSERT','restaurant_invites',rid,null,{email,expires_at:expiry})]);
    return json({invite_code:code,email,expires_in_days:14},201);
   }
   if(resource==='uploads'&&method==='POST'){
    if(!env.MEDIA)fail(503,'Photo uploads need R2 activation in your Cloudflare account. Existing photos remain available.');
    const bytes=await readBytes(request,5*1024*1024),type=request.headers.get('Content-Type')?.split(';')[0];
    const signature=[...bytes.slice(0,16)],ascii=new TextDecoder().decode(bytes.slice(0,16));let ext;
    if(type==='image/jpeg'&&signature[0]===255&&signature[1]===216&&signature[2]===255)ext='jpg';
    if(type==='image/png'&&signature.slice(0,8).join(',')==='137,80,78,71,13,10,26,10')ext='png';
    if(type==='image/webp'&&ascii.startsWith('RIFF')&&ascii.slice(8,12)==='WEBP')ext='webp';
    if(type==='image/avif'&&ascii.slice(4,8)==='ftyp'&&['avif','avis'].includes(ascii.slice(8,12)))ext='avif';
    if(!ext)fail(400,'Upload a valid JPEG, PNG, WebP or AVIF photo.');
    const key=rid+'/'+crypto.randomUUID()+'.'+ext;
    await env.MEDIA.put(key,bytes,{httpMetadata:{contentType:type,cacheControl:'public, max-age=31536000, immutable'}});
    await audit(env,identity,rid,'INSERT','media',key,null,{bytes:bytes.length,type}).run();
    return json({url:'/media/'+key},201);
   }
   if(resource==='wifi'){
    if(method==='GET')return json(await env.DB.prepare('SELECT * FROM wifi_details WHERE restaurant_id=?').bind(rid).first());
    if(method==='PUT'){const input=await readJson(request);await env.DB.batch([env.DB.prepare('INSERT INTO wifi_details(restaurant_id,network_name,password_hint,is_visible) VALUES(?,?,?,?) ON CONFLICT(restaurant_id) DO UPDATE SET network_name=excluded.network_name,password_hint=excluded.password_hint,is_visible=excluded.is_visible,updated_at=CURRENT_TIMESTAMP').bind(rid,str(input.network_name,'network name',200),str(input.password_hint,'password hint',500),bool(input.is_visible,'Visibility')),audit(env,identity,rid,'UPDATE','wifi_details',rid,null,{is_visible:input.is_visible})]);return json({ok:true});}
   }
   fail(405,'Method not allowed.');
  }
  if(path.startsWith('/media/')&&['GET','HEAD'].includes(method)){
   if(!env.MEDIA)fail(404,'Photo not found.');
   const key=path.slice(7);if(!/^[a-zA-Z0-9-]+\/[a-zA-Z0-9_.-]+$/.test(key))fail(404,'Photo not found.');
   const object=await env.MEDIA.get(key);if(!object)fail(404,'Photo not found.');
   const h=new Headers(securityHeaders);object.writeHttpMetadata(h);h.set('ETag',object.httpEtag);return new Response(method==='HEAD'?null:object.body,{headers:h});
  }
  if(path.startsWith('/api/'))fail(404,'Endpoint not found.');
  if(!env.ASSETS)fail(503,'The website assets are not deployed.');
  const response=await env.ASSETS.fetch(request);
  const h=new Headers(response.headers);for(const [k,v] of Object.entries(securityHeaders))h.set(k,v);
  if(path==='/'||path.endsWith('.html'))h.set('Cache-Control','no-cache');
  return new Response(response.body,{status:response.status,headers:h});
 }
 return {async fetch(request,env){try{return await route(request,env);}catch(error){if(error instanceof HttpError)return json({error:error.message},error.status);console.error('Menu Go request failed',{name:error.name,message:error.message});return json({error:'The service is temporarily unavailable. Please try again.'},503);}}};
}
export default createApp();
