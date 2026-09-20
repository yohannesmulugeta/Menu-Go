import { supabase } from "./supabase";
import type { MenuItem } from "../data/demo";

export type RestaurantRecord = {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
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
  if (!supabase) return null;

  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .select("id,name,slug,tagline,address,google_maps_url,google_review_url,phone,currency,cover_image_url,logo_url,instagram_url,tiktok_url,facebook_url,youtube_url,telegram_url,whatsapp_url,linkedin_url,website_url")
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  if (restaurantError) throw restaurantError;

  const [{ data: categories, error: categoryError }, { data: items, error: itemError }, { data: hours }] =
    await Promise.all([
      supabase
        .from("categories")
        .select("id,name,sort_order")
        .eq("restaurant_id", restaurant.id)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("menu_items")
        .select("id,name,description,price,image_url,is_popular,is_available,category_id,sort_order")
        .eq("restaurant_id", restaurant.id)
        .eq("is_available", true)
        .order("sort_order"),
      supabase
        .from("opening_hours")
        .select("weekday,opens_at,closes_at,is_closed")
        .eq("restaurant_id", restaurant.id)
        .order("weekday")
    ]);

  if (categoryError) throw categoryError;
  if (itemError) throw itemError;

  const categoryMap = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const mappedItems: MenuItem[] = (items ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description ?? "",
    price: Number(item.price),
    category: categoryMap.get(item.category_id) ?? "Other",
    image: item.image_url ?? "",
    popular: item.is_popular,
    available: item.is_available,
  }));

  return {
    restaurant: restaurant as RestaurantRecord,
    categories: ["Popular", ...(categories ?? []).map((c) => c.name)],
    items: mappedItems,
    hours: hours ?? [],
  };
}

export async function submitFeedback(restaurantId: string, message: string) {
  if (!supabase) throw new Error("Database is not configured.");
  const clean = message.trim();
  if (!clean) throw new Error("Please enter your feedback.");

  const { error } = await supabase.from("feedback").insert({
    restaurant_id: restaurantId,
    message: clean,
  });

  if (error) throw error;
  await trackEvent(restaurantId, "feedback_submit");
}

export async function trackEvent(
  restaurantId: string,
  eventType: string,
  metadata: Record<string, unknown> = {}
) {
  if (!supabase) return;
  await supabase.from("analytics_events").insert({
    restaurant_id: restaurantId,
    event_type: eventType,
    metadata,
  });
}
