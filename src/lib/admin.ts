import { supabase } from "./supabase";

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

export function requireSupabase() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export async function signIn(email: string, password: string) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUp(email: string, password: string, emailRedirectTo?: string) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: emailRedirectTo ? { emailRedirectTo } : undefined,
  });
  if (error) throw error;
  return data;
}

export async function requestPasswordReset(email: string, redirectTo: string) {
  const client = requireSupabase();
  const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const client = requireSupabase();
  const { data, error } = await client.auth.updateUser({ password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const client = requireSupabase();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const client = requireSupabase();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthChange(callback: () => void) {
  const client = requireSupabase();
  const { data } = client.auth.onAuthStateChange(() => callback());
  return () => data.subscription.unsubscribe();
}

export async function claimOwnerSetup(code: string) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("claim_owner_setup", { p_code: code.trim() });
  if (error) throw error;
  return data;
}

export async function bootstrapPlatformAdmin() {
  const client = requireSupabase();
  const { data, error } = await client.rpc("bootstrap_platform_admin");
  if (error) throw error;
  return data;
}

export async function bootstrapAbolManager() {
  const client = requireSupabase();
  const { data, error } = await client.rpc("bootstrap_abol_manager");
  if (error) throw error;
  return data;
}

export async function redeemRestaurantInvite(code: string) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("redeem_restaurant_invite", { p_code: code.trim() });
  if (error) throw error;
  return data;
}

export async function isPlatformAdmin() {
  const client = requireSupabase();
  const { data, error } = await client.from("platform_admins").select("user_id").limit(1);
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

export async function getMyRestaurant(requestedRestaurantId?: string) {
  const client = requireSupabase();
  const { data: sessionData } = await client.auth.getSession();
  const uid = sessionData.session?.user.id;
  if (!uid) return null;

  if (requestedRestaurantId && await isPlatformAdmin()) {
    const { data: restaurant, error } = await client
      .from("restaurants")
      .select("*")
      .eq("id", requestedRestaurantId)
      .single();
    if (error) throw error;
    return { restaurant: restaurant as AdminRestaurant, role: "platform_admin" };
  }

  const { data: membership, error: membershipError } = await client
    .from("restaurant_members")
    .select("restaurant_id,role")
    .eq("user_id", uid)
    .eq("role", "manager")
    .limit(1)
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (!membership) return null;

  const { data: restaurant, error: restaurantError } = await client
    .from("restaurants")
    .select("*")
    .eq("id", membership.restaurant_id)
    .single();

  if (restaurantError) throw restaurantError;
  return { restaurant: restaurant as AdminRestaurant, role: "restaurant_manager" };
}

export async function listCategories(restaurantId: string) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("categories")
    .select("id,name,sort_order,is_active")
    .eq("restaurant_id", restaurantId)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as AdminCategory[];
}

export async function listMenuItems(restaurantId: string) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("menu_items")
    .select("id,name,description,price,image_url,is_available,is_popular,sort_order,category_id,category:categories(name)")
    .eq("restaurant_id", restaurantId)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ ...row, price: Number(row.price) })) as AdminMenuItem[];
}

export async function saveMenuItem(restaurantId: string, item: {
  id?: string;
  name: string;
  description: string;
  price: number;
  category_id: string | null;
  image_url?: string | null;
  is_available: boolean;
  is_popular: boolean;
}) {
  const client = requireSupabase();
  const payload = {
    restaurant_id: restaurantId,
    name: item.name.trim(),
    description: item.description.trim() || null,
    price: item.price,
    category_id: item.category_id,
    image_url: item.image_url || null,
    is_available: item.is_available,
    is_popular: item.is_popular,
  };

  if (item.id) {
    const { error } = await client.from("menu_items").update(payload).eq("id", item.id);
    if (error) throw error;
  } else {
    const { error } = await client.from("menu_items").insert(payload);
    if (error) throw error;
  }
}

export async function deleteMenuItem(itemId: string) {
  const client = requireSupabase();
  const { error } = await client.from("menu_items").delete().eq("id", itemId);
  if (error) throw error;
}

export async function toggleMenuItem(itemId: string, isAvailable: boolean) {
  const client = requireSupabase();
  const { error } = await client.from("menu_items").update({ is_available: isAvailable }).eq("id", itemId);
  if (error) throw error;
}

export async function saveCategory(restaurantId: string, name: string, id?: string) {
  const client = requireSupabase();
  if (id) {
    const { error } = await client.from("categories").update({ name: name.trim() }).eq("id", id);
    if (error) throw error;
  } else {
    const { data: countData } = await client
      .from("categories")
      .select("id")
      .eq("restaurant_id", restaurantId);
    const { error } = await client.from("categories").insert({
      restaurant_id: restaurantId,
      name: name.trim(),
      sort_order: (countData?.length ?? 0) + 1,
    });
    if (error) throw error;
  }
}

export async function deleteCategory(id: string) {
  const client = requireSupabase();
  const { error } = await client.from("categories").delete().eq("id", id);
  if (error) throw error;
}

export async function updateRestaurant(restaurantId: string, updates: Partial<AdminRestaurant>) {
  const client = requireSupabase();
  const { error } = await client.from("restaurants").update(updates).eq("id", restaurantId);
  if (error) throw error;
}

export async function listFeedback(restaurantId: string) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("feedback")
    .select("id,message,rating,status,created_at")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function resolveFeedback(id: string) {
  const client = requireSupabase();
  const { error } = await client.from("feedback").update({ status: "resolved" }).eq("id", id);
  if (error) throw error;
}

export async function getAnalytics(restaurantId: string) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("analytics_events")
    .select("event_type")
    .eq("restaurant_id", restaurantId);
  if (error) throw error;
  const rows = data ?? [];
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.event_type] = (counts[row.event_type] ?? 0) + 1;
  return counts;
}

export async function uploadMenuImage(restaurantId: string, file: File) {
  const client = requireSupabase();
  if (file.size > 5 * 1024 * 1024) throw new Error("Image must be under 5 MB.");
  const safe = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
  const path = `${restaurantId}/${Date.now()}-${safe}`;
  const { error } = await client.storage.from("menu-images").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = client.storage.from("menu-images").getPublicUrl(path);
  return data.publicUrl;
}

export async function listPlatformRestaurants() {
  const client = requireSupabase();
  const { data, error } = await client
    .from("restaurants")
    .select("id,name,slug,tagline,address,status,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createRestaurantWithInvite(input: {
  name: string;
  slug: string;
  tagline?: string;
  address?: string;
}) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("create_restaurant_with_invite", {
    p_name: input.name.trim(),
    p_slug: input.slug.trim(),
    p_tagline: input.tagline?.trim() || null,
    p_address: input.address?.trim() || null,
  });
  if (error) throw error;
  return data as { restaurant_id: string; slug: string; invite_code: string };
}

export async function createRestaurantInvite(restaurantId: string, email?: string) {
  const client = requireSupabase();
  if (email) {
    const { data, error } = await client.rpc("create_restaurant_email_invite", {
      p_restaurant_id: restaurantId,
      p_email: email.trim().toLowerCase(),
    });
    if (error) throw error;
    return data as { invite_code: string; email: string; expires_in_days: number };
  }

  const { data, error } = await client.rpc("create_restaurant_invite", {
    p_restaurant_id: restaurantId,
  });
  if (error) throw error;
  return data as { invite_code: string; expires_in_days: number; email?: string };
}

export async function listOpeningHours(restaurantId: string) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("opening_hours")
    .select("id,weekday,opens_at,closes_at,is_closed")
    .eq("restaurant_id", restaurantId)
    .order("weekday");
  if (error) throw error;
  return data ?? [];
}

export async function saveOpeningHours(restaurantId: string, rows: Array<{
  weekday: number;
  opens_at: string | null;
  closes_at: string | null;
  is_closed: boolean;
}>) {
  const client = requireSupabase();
  const payload = rows.map(row => ({ ...row, restaurant_id: restaurantId }));
  const { error } = await client
    .from("opening_hours")
    .upsert(payload, { onConflict: "restaurant_id,weekday" });
  if (error) throw error;
}

export async function listAuditLogs(restaurantId: string) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("audit_logs")
    .select("id,action,entity_type,entity_id,old_data,new_data,created_at")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function uploadRestaurantAsset(restaurantId: string, file: File, kind: "logo" | "cover") {
  const client = requireSupabase();
  if (file.size > 5 * 1024 * 1024) throw new Error("Image must be under 5 MB.");
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${restaurantId}/${kind}-${Date.now()}.${ext}`;
  const { error } = await client.storage.from("restaurant-assets").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = client.storage.from("restaurant-assets").getPublicUrl(path);
  return data.publicUrl;
}
