
create schema if not exists private;

create or replace function private.is_restaurant_member(target_restaurant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.restaurant_members rm
    where rm.restaurant_id = target_restaurant
      and rm.user_id = (select auth.uid())
  );
$$;

grant usage on schema private to anon, authenticated;
grant execute on function private.is_restaurant_member(uuid) to anon, authenticated;

drop policy if exists "public read active restaurants" on public.restaurants;
create policy "public read active restaurants"
on public.restaurants for select
using (status = 'active' or private.is_restaurant_member(id));

drop policy if exists "members update restaurant" on public.restaurants;
create policy "members update restaurant"
on public.restaurants for update
using (private.is_restaurant_member(id))
with check (private.is_restaurant_member(id));

drop policy if exists "members read memberships" on public.restaurant_members;
create policy "members read memberships"
on public.restaurant_members for select
using (user_id = (select auth.uid()) or private.is_restaurant_member(restaurant_id));

drop policy if exists "public read active categories" on public.categories;
create policy "public read active categories"
on public.categories for select
using (
  exists (select 1 from public.restaurants r where r.id = restaurant_id and r.status = 'active')
  or private.is_restaurant_member(restaurant_id)
);

drop policy if exists "members manage categories" on public.categories;
create policy "members manage categories"
on public.categories for all
using (private.is_restaurant_member(restaurant_id))
with check (private.is_restaurant_member(restaurant_id));

drop policy if exists "public read available menu items" on public.menu_items;
create policy "public read available menu items"
on public.menu_items for select
using (
  (is_available = true and exists (
    select 1 from public.restaurants r where r.id = restaurant_id and r.status = 'active'
  ))
  or private.is_restaurant_member(restaurant_id)
);

drop policy if exists "members manage menu items" on public.menu_items;
create policy "members manage menu items"
on public.menu_items for all
using (private.is_restaurant_member(restaurant_id))
with check (private.is_restaurant_member(restaurant_id));

drop policy if exists "public read opening hours" on public.opening_hours;
create policy "public read opening hours"
on public.opening_hours for select
using (
  exists (select 1 from public.restaurants r where r.id = restaurant_id and r.status = 'active')
  or private.is_restaurant_member(restaurant_id)
);

drop policy if exists "members manage opening hours" on public.opening_hours;
create policy "members manage opening hours"
on public.opening_hours for all
using (private.is_restaurant_member(restaurant_id))
with check (private.is_restaurant_member(restaurant_id));

drop policy if exists "public read visible wifi details" on public.wifi_details;
create policy "public read visible wifi details"
on public.wifi_details for select
using (is_visible = true or private.is_restaurant_member(restaurant_id));

drop policy if exists "members manage wifi details" on public.wifi_details;
create policy "members manage wifi details"
on public.wifi_details for all
using (private.is_restaurant_member(restaurant_id))
with check (private.is_restaurant_member(restaurant_id));

drop policy if exists "members read feedback" on public.feedback;
create policy "members read feedback"
on public.feedback for select
using (private.is_restaurant_member(restaurant_id));

drop policy if exists "members update feedback" on public.feedback;
create policy "members update feedback"
on public.feedback for update
using (private.is_restaurant_member(restaurant_id))
with check (private.is_restaurant_member(restaurant_id));

drop policy if exists "members read analytics" on public.analytics_events;
create policy "members read analytics"
on public.analytics_events for select
using (private.is_restaurant_member(restaurant_id));

create index if not exists idx_restaurant_members_user on public.restaurant_members(user_id);

drop function if exists public.is_restaurant_member(uuid);

