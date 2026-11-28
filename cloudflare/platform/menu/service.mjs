import {restaurantAccess} from '../config/access.mjs';
import {response,fail} from '../auth/http.mjs';
import {menuMetadata,ownedItem} from './access.mjs';
import {mutateMenu} from './mutations.mjs';

const itemColumns='i.id,i.name,i.description,i.price,i.category_id,i.image_url,i.is_available,i.is_popular,i.sort_order,i.version,c.name category_name,c.is_active category_active,c.deleted_at category_deleted_at';
export async function menuRoute(request,env) {
  const url=new URL(request.url),match=/^\/api\/restaurants\/([^/]+)\/menu\/(categories|items|hours)(?:\/([^/]+))?(?:\/(variants|translations))?(?:\/([^/]+))?$/.exec(url.pathname);
  if(!match)return null;
  const tenant=decodeURIComponent(match[1]),parts=match.slice(2).map(value=>value?decodeURIComponent(value):value);
  const db=env.DB,access=await restaurantAccess(request,db,tenant),meta=await menuMetadata(db,access);
  if(request.method!=='GET')return mutateMenu(request,db,access,meta,parts);
  const [kind,entityId,detail]=parts;
  if(kind==='hours'&&!entityId) {
    const rows=await db.prepare('SELECT weekday,opens_at,closes_at,is_closed FROM opening_hours WHERE restaurant_id=? ORDER BY weekday').bind(tenant).all();
    return response({...meta,timezone:access.restaurant.timezone,hours:rows.results});
  }
  if(kind==='items'&&entityId&&!detail) {
    await ownedItem(db,tenant,entityId);
    const item=await db.prepare('SELECT '+itemColumns+' FROM menu_items i LEFT JOIN categories c ON c.id=i.category_id AND c.restaurant_id=i.restaurant_id WHERE i.id=? AND i.restaurant_id=? AND i.deleted_at IS NULL').bind(entityId,tenant).first();
    if(!item)fail(404,'Menu item not found.');
    const variants=await db.prepare('SELECT id,label,price_minor,sort_order,is_active FROM menu_item_variants WHERE restaurant_id=? AND menu_item_id=? ORDER BY sort_order,id').bind(tenant,entityId).all();
    const translations=await db.prepare('SELECT locale,name,description FROM menu_item_translations WHERE restaurant_id=? AND menu_item_id=? ORDER BY locale').bind(tenant,entityId).all();
    return response({...meta,item,variants:variants.results,translations:translations.results});
  }
  if(entityId||detail||!['categories','items'].includes(kind))return response({error:'Not found.'},404);
  const offset=Number(url.searchParams.get('offset')||0),search=(url.searchParams.get('search')||'').trim();
  if(!Number.isSafeInteger(offset)||offset<0||search.length>120)fail(400,'Check the menu search and page.');
  const pattern='%'+search.replace(/[\\%_]/g,'\\$&')+'%';
  const query=kind==='categories'
    ?"SELECT id,name,sort_order,is_active FROM categories WHERE restaurant_id=? AND deleted_at IS NULL AND name LIKE ? ESCAPE '\\' ORDER BY sort_order,id LIMIT 51 OFFSET ?"
    :"SELECT "+itemColumns+" FROM menu_items i LEFT JOIN categories c ON c.id=i.category_id AND c.restaurant_id=i.restaurant_id WHERE i.restaurant_id=? AND i.deleted_at IS NULL AND i.name LIKE ? ESCAPE '\\' ORDER BY i.sort_order,i.id LIMIT 51 OFFSET ?";
  const rows=await db.prepare(query).bind(tenant,pattern,offset).all();
  return response({...meta,[kind]:rows.results.slice(0,50),next_offset:rows.results.length>50?offset+50:null});
}

