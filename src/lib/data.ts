import { supabase } from "./supabase";
import type { MenuItem } from "../data/demo";

export const DEMO_RESTAURANT_ID = "11111111-1111-4111-8111-111111111111";

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
};

export async function loadDemoRestaurant() {
  if (!supabase) return null;

  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .select("id,name,slug,tagline,address,google_maps_url,google_review_url,phone,currency")
    .eq("slug", "sora-table")
    .single();

  if (restaurantError) throw restaurantError;

  const { data: categories, error: categoryError } = await supabase
    .from("categories")
    .select("id,name,sort_order")
    .eq("restaurant_id", restaurant.id)
    .eq("is_active", true)
    .order("sort_order");

  if (categoryError) throw categoryError;

  const { data: items, error: itemError } = await supabase
    .from("menu_items")
    .select("id,name,description,price,image_url,is_popular,is_available,category_id,sort_order")
    .eq("restaurant_id", restaurant.id)
    .eq("is_available", true)
    .order("sort_order");

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
  };
}

export async function submitFeedback(message: string) {
  if (!supabase) throw new Error("Database is not configured.");
  const clean = message.trim();
  if (!clean) throw new Error("Please enter your feedback.");

  const { error } = await supabase.from("feedback").insert({
    restaurant_id: DEMO_RESTAURANT_ID,
    message: clean,
  });

  if (error) throw error;
  await trackEvent("feedback_submit");
}

export async function trackEvent(eventType: string, metadata: Record<string, unknown> = {}) {
  if (!supabase) return;
  await supabase.from("analytics_events").insert({
    restaurant_id: DEMO_RESTAURANT_ID,
    event_type: eventType,
    metadata,
  });
}
