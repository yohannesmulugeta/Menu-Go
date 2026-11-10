import { api } from "./api";
import type { MenuItem } from "../data/demo";
import type { Json } from "./database.types";

export type RestaurantRecord = {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  address: string | null;
  google_maps_url: string | null;
  google_review_url: string | null;
  phone: string | null;
  currency: string;
  cover_image_url: string | null;
  logo_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  facebook_url: string | null;
  youtube_url: string | null;
  telegram_url: string | null;
  whatsapp_url: string | null;
  linkedin_url: string | null;
  website_url: string | null;
};

export type WifiRecord = {
  network_name: string | null;
  password_hint: string | null;
  is_visible: boolean;
};

export async function loadRestaurantBySlug(slug: string) {
  const data = await api<any>(`/api/restaurants/${encodeURIComponent(slug)}`);
  const categoryMap = new Map<string,string>(data.categories.map((c:any) => [c.id,c.name]));
  const items: MenuItem[] = data.items.map((item:any) => ({
    id:item.id, name:item.name, description:item.description || "", price:Number(item.price),
    category:categoryMap.get(item.category_id) || "Other", image:item.image_url || "",
    popular:item.is_popular, available:item.is_available,
  }));
  return {
    restaurant:data.restaurant as RestaurantRecord,
    categories:[...(items.some(i=>i.popular)?["Popular"]:[]), ...data.categories.map((c:any)=>c.name), ...(items.some(i=>i.category==="Other")?["Other"]:[])],
    items, hours:data.hours,
  };
}

export async function submitFeedback(restaurantId:string,message:string) {
  await api(`/api/restaurants/${encodeURIComponent(restaurantId)}/feedback`,"POST",{message});
  await trackEvent(restaurantId,"feedback_submit");
}

export async function trackEvent(restaurantId:string,eventType:string,metadata:Json={}) {
  // Analytics is best-effort and never blocks viewing a menu or sending feedback.
  try { await api(`/api/restaurants/${encodeURIComponent(restaurantId)}/events`,"POST",{event_type:eventType,metadata}); }
  catch { /* The menu remains usable if analytics is rate-limited or offline. */ }
}
