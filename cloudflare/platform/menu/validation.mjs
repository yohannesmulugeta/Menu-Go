import {fail, input} from '../auth/http.mjs';
import {keys,LOCALES} from '../config/validation.mjs';

export async function menuInput(request,fields) {
  const body=await input(request,32768);
  keys(body,['revision','policy_revision',...fields],'menu changes');
  if(!Number.isSafeInteger(body.revision)||body.revision<1||!Number.isSafeInteger(body.policy_revision)||body.policy_revision<1)fail(400,'Reload the menu before saving.');
  return body;
}
export function text(value,label,max,required=false) {
  if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)||(required&&!value.trim()))fail(400,'Check '+label+'.');
  return value.trim();
}
export function integer(value,label) {
  if(!Number.isSafeInteger(value))fail(400,'Enter a whole number for '+label+'.');
  return value;
}
export function boolean(value,label) {
  if(typeof value!=='boolean')fail(400,'Choose '+label+'.');
  return Number(value);
}
export function itemValues(body) {
  const price=body.price;
  if(typeof price!=='number'||!Number.isFinite(price)||price<0||price>9999999.99||Math.abs(price*100-Math.round(price*100))>0.00001)fail(400,'Enter a non-negative price with at most two decimals.');
  if(body.category_id!==null&&(typeof body.category_id!=='string'||!body.category_id||body.category_id.length>100))fail(400,'Choose a category.');
  return {name:text(body.name,'the item name',200,true),description:text(body.description??'','the description',3000),price,category_id:body.category_id,is_available:boolean(body.is_available,'availability'),is_popular:boolean(body.is_popular,'popular status'),sort_order:integer(body.sort_order,'sort order')};
}
export function variantValues(body) {
  const price=integer(body.price_minor,'the variant price');
  if(price<0)fail(400,'Variant prices must be non-negative.');
  return {label:text(body.label,'the variant label',120,true),price_minor:price,is_active:boolean(body.is_active,'variant visibility'),sort_order:integer(body.sort_order,'sort order')};
}
export function translationValues(body,locale) {
  if(!LOCALES.includes(locale)||locale==='en')fail(400,'Choose Amharic, Oromo or Tigrinya. Edit English in the item name and description.');
  return {name:text(body.name,'the translated name',200,true),description:text(body.description??'','the translated description',3000)};
}
export function hoursValues(body,weekday) {
  if(!Number.isInteger(weekday)||weekday<0||weekday>6)fail(400,'Choose a day of the week.');
  const closed=boolean(body.is_closed,'whether the restaurant is closed');
  if(!closed&&(!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.opens_at)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.closes_at)))fail(400,'Enter opening and closing times in 24-hour format.');
  for(const value of [body.opens_at,body.closes_at])if(value!==null&&value!==''&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))fail(400,'Check the saved hours.');
  return {is_closed:closed,opens_at:body.opens_at||null,closes_at:body.closes_at||null};
}

