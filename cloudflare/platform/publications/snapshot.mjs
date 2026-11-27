import {validateConfig} from '../config/validation.mjs';

function object(columns) {
  return 'json_object('+columns.split(',').map(c=>"'"+c+"',"+c).join(',')+')';
}
function rows(table,columns,where,order) {
  return "(SELECT json_group_array(json(value)) FROM (SELECT "+object(columns)+" value FROM "+table+" WHERE "+where+" ORDER BY "+order+"))";
}
// One SQLite read captures a coherent draft. The same expression guards the write.
export const draftStateSQL=`json_object(
  'restaurant',json(${object('id,name,slug,currency,timezone,status')}),
  'config',json((SELECT ${object('schema_version,template_id,template_version,features_json,theme_json,content_settings_json,revision')} FROM restaurant_configs WHERE restaurant_id=r.id)),
  'categories',json(${rows('categories','id,name,sort_order',"restaurant_id=r.id AND deleted_at IS NULL AND is_active=1",'sort_order,id')}),
  'items',json(${rows('menu_items i','id,name,description,price,category_id,image_url,is_popular',"restaurant_id=r.id AND deleted_at IS NULL AND is_available=1 AND (category_id IS NULL OR EXISTS(SELECT 1 FROM categories c WHERE c.id=i.category_id AND c.restaurant_id=i.restaurant_id AND c.deleted_at IS NULL AND c.is_active=1))",'sort_order,id')}),
  'variants',json(${rows('menu_item_variants','id,menu_item_id,label,price_minor,is_active',"restaurant_id=r.id AND is_active=1",'sort_order,id')}),
  'translations',json(${rows('menu_item_translations','menu_item_id,locale,name,description','restaurant_id=r.id','menu_item_id,locale')}),
  'hours',json(${rows('opening_hours','weekday,opens_at,closes_at,is_closed','restaurant_id=r.id','weekday')}),
  'media',json(${rows('media_assets','id,object_key,kind,lifecycle,state,size_bytes','restaurant_id=r.id','id')}),
  'owners',json(${rows('media_item_owners','media_id,menu_item_id','restaurant_id=r.id','media_id')})
)`;

export function draftConfig(row) {
  return validateConfig({schema_version:row.schema_version,template_id:row.template_id,template_version:row.template_version,features:JSON.parse(row.features_json),theme:JSON.parse(row.theme_json),content_settings:JSON.parse(row.content_settings_json)});
}
export function snapshotData(state) {
  let timezone=null;
  try {new Intl.DateTimeFormat('en',{timeZone:state.restaurant.timezone});timezone=state.restaurant.timezone;} catch {/* Invalid legacy zones keep hours hidden. */}
  return {categories:state.categories,items:state.items,variants:state.variants,translations:state.translations,hours:state.hours,timezone};
}

