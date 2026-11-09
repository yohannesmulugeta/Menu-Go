import { api, adminPath } from "./api";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

function validateImage(file: File) {
  if (file.size > 5 * 1024 * 1024) throw new Error("Image must be under 5 MB.");
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error("Use a JPEG, PNG, WebP or AVIF image.");
}

function validateOptionalUrl(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") return;
  if (typeof value !== "string") throw new Error(`${label} must be a valid URL.`);
  if (/^\/(media|migrated-media)\//.test(value)) return;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be a complete URL beginning with https:// or http://.`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`${label} must use https:// or http://.`);
  }
}

export type AdminMenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  is_popular: boolean;
  sort_order: number;
  category_id: string | null;
  category?: { name: string } | null;
  version?: number;
};

export type AdminCategory = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

export type AdminRestaurant = {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  phone: string | null;
  address: string | null;
  google_maps_url: string | null;
  google_review_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  facebook_url: string | null;
  youtube_url: string | null;
  telegram_url: string | null;
  whatsapp_url: string | null;
  linkedin_url: string | null;
  website_url: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  currency: string;
  status: string;
};

type Session = {user:{id:string,email:string},platform_admin:boolean};
const itemOwners = new Map<string,string>();
const categoryOwners = new Map<string,string>();
const feedbackOwners = new Map<string,string>();
const itemVersions = new Map<string,number>();
const owner = (map:Map<string,string>,id:string) => {
  const restaurantId=map.get(id);
  if(!restaurantId)throw new Error("Reload this dashboard before editing.");
  return restaurantId;
};
export async function signIn() {
  window.location.assign("/api/auth/login?returnTo="+encodeURIComponent("/#/login"));
}
export async function signOut() {
  itemOwners.clear();categoryOwners.clear();feedbackOwners.clear();itemVersions.clear();
  window.location.assign("/cdn-cgi/access/logout");
}
export async function getSession(){return api<Session|null>("/api/session");}
export function onAuthChange(callback:()=>void) {
  window.addEventListener("focus",callback);
  window.addEventListener("pageshow",callback);
  return ()=>{window.removeEventListener("focus",callback);window.removeEventListener("pageshow",callback);};
}
export async function isPlatformAdmin(){return Boolean((await getSession())?.platform_admin);}
export async function getMyRestaurant(requestedRestaurantId?:string){
  return api<{restaurant:AdminRestaurant,role:string}|null>("/api/admin/my-restaurant"+(requestedRestaurantId?"?restaurant_id="+encodeURIComponent(requestedRestaurantId):""));
}
export async function redeemRestaurantInvite(code:string){return api("/api/invites/redeem","POST",{code});}
export async function listCategories(restaurantId:string){
  const rows=await api<AdminCategory[]>(adminPath(restaurantId,"categories"));
  rows.forEach(c=>categoryOwners.set(c.id,restaurantId));return rows;
}
export async function listMenuItems(restaurantId:string){
  const rows=await api<AdminMenuItem[]>(adminPath(restaurantId,"items"));
  rows.forEach(i=>{itemOwners.set(i.id,restaurantId);itemVersions.set(i.id,i.version || 1);});return rows;
}
export async function saveMenuItem(restaurantId:string,item:{id?:string,name:string,description:string,price:number,category_id:string|null,image_url?:string|null,is_available:boolean,is_popular:boolean}){
  return api(adminPath(restaurantId,"items",item.id),item.id?"PUT":"POST",{...item,...(item.id?{version:itemVersions.get(item.id)}:{})});
}
export async function deleteMenuItem(itemId:string){return api(adminPath(owner(itemOwners,itemId),"items",itemId),"DELETE");}
export async function toggleMenuItem(itemId:string,isAvailable:boolean){return api(adminPath(owner(itemOwners,itemId),"items",itemId),"PATCH",{is_available:isAvailable});}
export async function saveCategory(restaurantId:string,name:string,id?:string){return api(adminPath(restaurantId,"categories",id),id?"PUT":"POST",{name});}
export async function deleteCategory(id:string){return api(adminPath(owner(categoryOwners,id),"categories",id),"DELETE");}
export async function updateRestaurant(restaurantId:string,updates:Partial<AdminRestaurant>){
  for(const [key,value] of Object.entries(updates))if(key.endsWith("_url"))validateOptionalUrl(value,key);
  return api(adminPath(restaurantId),"PATCH",updates);
}
export async function listFeedback(restaurantId:string){
  const rows=await api<any[]>(adminPath(restaurantId,"feedback"));rows.forEach(f=>feedbackOwners.set(f.id,restaurantId));return rows;
}
export async function resolveFeedback(id:string){return api(adminPath(owner(feedbackOwners,id),"feedback",id),"PATCH",{});}
export async function getAnalytics(restaurantId:string){return api<Record<string,number>>(adminPath(restaurantId,"analytics"));}
export async function listPlatformRestaurants(){return api<any[]>("/api/admin/restaurants");}
export async function createRestaurantWithInvite(input:{name:string,slug:string,tagline?:string,address?:string}){
  return api<{restaurant_id:string,slug:string}>("/api/admin/restaurants","POST",input);
}
export async function createRestaurantInvite(restaurantId:string,email:string){
  return api<{invite_code:string,email:string,expires_in_days:number}>(adminPath(restaurantId,"invites"),"POST",{email});
}
export async function listOpeningHours(restaurantId:string){return api<any[]>(adminPath(restaurantId,"hours"));}
export async function saveOpeningHours(restaurantId:string,rows:Array<{weekday:number,opens_at:string|null,closes_at:string|null,is_closed:boolean}>){return api(adminPath(restaurantId,"hours"),"PUT",{rows});}
export async function listAuditLogs(restaurantId:string){return api<any[]>(adminPath(restaurantId,"audit"));}
async function upload(restaurantId:string,file:File){
  validateImage(file);
  const response=await fetch(adminPath(restaurantId,"uploads"),{method:"POST",credentials:"same-origin",headers:{"Content-Type":file.type,"X-Menu-Request":"1"},body:file});
  const data=await response.json();if(!response.ok)throw new Error(data.error || "Photo upload failed.");
  return new URL(data.url,window.location.origin).href;
}
export async function uploadMenuImage(restaurantId:string,file:File){return upload(restaurantId,file);}
export async function uploadRestaurantAsset(restaurantId:string,file:File,kind:"logo"|"cover"){void kind;return upload(restaurantId,file);}
