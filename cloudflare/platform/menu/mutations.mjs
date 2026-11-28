import {response,fail} from '../auth/http.mjs';
import {menuInput,text,integer,boolean,itemValues,variantValues,translationValues,hoursValues} from './validation.mjs';
import {editable,commitMenu,ownedItem} from './access.mjs';

export async function mutateMenu(request,db,access,meta,parts) {
  const [kind,entityId,detail,detailId]=parts,tenant=access.restaurant.id;
  const create=request.method==='POST';
  let plan,body;
  if(kind==='categories'&&!detail) {
    if(!['POST','PATCH'].includes(request.method)||create===!!entityId)return response({error:'Method not allowed.'},405,{Allow:entityId?'PATCH':'POST'});
    body=await menuInput(request,['name','sort_order','is_active']);
    editable(meta,'menu.categories');
    const name=text(body.name,'the category name',120,true),order=integer(body.sort_order,'sort order'),active=boolean(body.is_active,'category visibility'),id=entityId||crypto.randomUUID();
    if(entityId&&!await db.prepare('SELECT 1 FROM categories WHERE id=? AND restaurant_id=? AND deleted_at IS NULL').bind(id,tenant).first())fail(404,'Category not found.');
    plan=create?{
      sql:'INSERT INTO categories(id,restaurant_id,name,sort_order,is_active) SELECT ?,?,?,?,? WHERE changes()=1',
      params:[id,tenant,name,order,active],action:'menu.category_created',id
    }:{
      sql:'UPDATE categories SET name=?,sort_order=?,is_active=? WHERE id=? AND restaurant_id=? AND deleted_at IS NULL AND changes()=1',
      params:[name,order,active,id,tenant],guard:'EXISTS(SELECT 1 FROM categories WHERE id=? AND restaurant_id=? AND deleted_at IS NULL)',guardParams:[id,tenant],action:'menu.category_saved',id
    };
  } else if(kind==='items'&&!detail) {
    if(!['POST','PATCH'].includes(request.method)||create===!!entityId)return response({error:'Method not allowed.'},405,{Allow:entityId?'PATCH':'POST'});
    body=await menuInput(request,['name','description','price','category_id','is_available','is_popular','sort_order','version']);
    const old=entityId?await ownedItem(db,tenant,entityId):null,item=itemValues(body),id=entityId||crypto.randomUUID();
    if(old&&body.version!==old.version)fail(409,'This item changed. Reload before saving.');
    editable(meta,'menu.descriptions',item.description!==(old?.description||''));
    editable(meta,'menu.popular',item.is_popular!==(old?.is_popular||0));
    editable(meta,'menu.categories',item.category_id!==(old?.category_id||null));
    if(item.category_id&&!await db.prepare('SELECT 1 FROM categories WHERE id=? AND restaurant_id=? AND (deleted_at IS NULL OR id=?)').bind(item.category_id,tenant,old?.category_id||null).first())fail(400,'Choose a category from this restaurant.');
    const categoryGuard='(? IS NULL OR EXISTS(SELECT 1 FROM categories WHERE id=? AND restaurant_id=? AND (deleted_at IS NULL OR id=?)))';
    const categoryParams=[item.category_id,item.category_id,tenant,old?.category_id||null];
    const values=[item.name,item.description||null,item.price,item.category_id,item.is_available,item.is_popular,item.sort_order];
    plan=create?{
      sql:'INSERT INTO menu_items(id,restaurant_id,name,description,price,category_id,is_available,is_popular,sort_order) SELECT ?,?,?,?,?,?,?,?,? WHERE changes()=1',
      params:[id,tenant,...values],guard:categoryGuard,guardParams:categoryParams,action:'menu.item_created',id
    }:{
      sql:'UPDATE menu_items SET name=?,description=?,price=?,category_id=?,is_available=?,is_popular=?,sort_order=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND restaurant_id=? AND deleted_at IS NULL AND changes()=1',
      params:[...values,id,tenant],guard:'EXISTS(SELECT 1 FROM menu_items WHERE id=? AND restaurant_id=? AND version=? AND deleted_at IS NULL) AND '+categoryGuard,
      guardParams:[id,tenant,body.version,...categoryParams],action:'menu.item_saved',id
    };
  } else if(kind==='items'&&detail==='variants') {
    if(!entityId||!['POST','PATCH'].includes(request.method)||create===!!detailId)return response({error:'Method not allowed.'},405,{Allow:detailId?'PATCH':'POST'});
    await ownedItem(db,tenant,entityId);
    body=await menuInput(request,['label','price_minor','sort_order','is_active']);editable(meta,'menu.variants');
    const value=variantValues(body),id=detailId||crypto.randomUUID();
    if(detailId&&!await db.prepare('SELECT 1 FROM menu_item_variants WHERE id=? AND restaurant_id=? AND menu_item_id=?').bind(id,tenant,entityId).first())fail(404,'Variant not found.');
    const itemGuard='EXISTS(SELECT 1 FROM menu_items WHERE id=? AND restaurant_id=? AND deleted_at IS NULL)';
    plan=create?{
      sql:'INSERT INTO menu_item_variants(id,restaurant_id,menu_item_id,label,price_minor,sort_order,is_active) SELECT ?,?,?,?,?,?,? WHERE changes()=1',
      params:[id,tenant,entityId,value.label,value.price_minor,value.sort_order,value.is_active],guard:itemGuard,guardParams:[entityId,tenant],action:'menu.variant_created',id
    }:{
      sql:'UPDATE menu_item_variants SET label=?,price_minor=?,sort_order=?,is_active=? WHERE id=? AND restaurant_id=? AND menu_item_id=? AND changes()=1',
      params:[value.label,value.price_minor,value.sort_order,value.is_active,id,tenant,entityId],
      guard:itemGuard+' AND EXISTS(SELECT 1 FROM menu_item_variants WHERE id=? AND restaurant_id=? AND menu_item_id=?)',guardParams:[entityId,tenant,id,tenant,entityId],action:'menu.variant_saved',id
    };
  } else if(kind==='items'&&detail==='translations'&&detailId) {
    if(request.method!=='PATCH')return response({error:'Method not allowed.'},405,{Allow:'PATCH'});
    await ownedItem(db,tenant,entityId);body=await menuInput(request,['name','description']);editable(meta,'guest.language');
    const value=translationValues(body,detailId);
    plan={
      sql:'INSERT INTO menu_item_translations(restaurant_id,menu_item_id,locale,name,description) SELECT ?,?,?,?,? WHERE changes()=1 ON CONFLICT(restaurant_id,menu_item_id,locale) DO UPDATE SET name=excluded.name,description=excluded.description',
      params:[tenant,entityId,detailId,value.name,value.description||null],guard:'EXISTS(SELECT 1 FROM menu_items WHERE id=? AND restaurant_id=? AND deleted_at IS NULL)',guardParams:[entityId,tenant],action:'menu.translation_saved',id:entityId
    };
  } else if(kind==='hours'&&entityId&&!detail) {
    if(request.method!=='PATCH')return response({error:'Method not allowed.'},405,{Allow:'PATCH'});
    body=await menuInput(request,['opens_at','closes_at','is_closed']);editable(meta,'guest.hours');
    const weekday=/^[0-6]$/.test(entityId)?Number(entityId):-1,value=hoursValues(body,weekday);
    plan={
      sql:'INSERT INTO opening_hours(id,restaurant_id,weekday,opens_at,closes_at,is_closed) SELECT ?,?,?,?,?,? WHERE changes()=1 ON CONFLICT(restaurant_id,weekday) DO UPDATE SET opens_at=excluded.opens_at,closes_at=excluded.closes_at,is_closed=excluded.is_closed',
      params:[crypto.randomUUID(),tenant,weekday,value.opens_at,value.closes_at,value.is_closed],action:'menu.hours_saved',id:String(weekday)
    };
  } else return response({error:'Not found.'},404);
  return response(await commitMenu(db,access,meta,body,plan),create?201:200);
}

