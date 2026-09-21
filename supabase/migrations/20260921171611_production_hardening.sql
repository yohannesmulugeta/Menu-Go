-- Menu Go production hardening.
-- Keeps Abol Coffee content unchanged while securing access and drafting demo tenants.

begin;

-- Temporary bootstrap entry points are no longer appropriate after the platform
-- administrator has been established.
drop function if exists public.bootstrap_abol_manager();
drop function if exists public.bootstrap_platform_admin();
drop function if exists public.claim_owner_setup(text);
drop function if exists public.create_restaurant_invite(uuid);
drop table if exists public.owner_setup_codes;

-- Restrict helper functions to the roles that need them in RLS evaluation.
revoke all on function private.is_platform_admin() from public;
revoke all on function private.is_restaurant_member(uuid) from public;
revoke all on function private.write_restaurant_audit() from public;
grant usage on schema private to anon, authenticated, service_role;
grant execute on function private.is_platform_admin() to anon, authenticated, service_role;
grant execute on function private.is_restaurant_member(uuid) to anon, authenticated, service_role;

-- The original generic trigger referenced NEW.restaurant_id even for the
-- restaurants table, where that field does not exist. Read the trigger row as
-- JSON so the same function works safely for every audited table.
create or replace function private.write_restaurant_audit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  row_data jsonb;
  rid uuid;
  entity_key text;
begin
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  rid := coalesce(
    nullif(row_data->>'restaurant_id', '')::uuid,
    nullif(row_data->>'id', '')::uuid
  );
  entity_key := row_data->>'id';

  if tg_op = 'DELETE' then
    insert into public.audit_logs(
      restaurant_id, actor_user_id, action, entity_type, entity_id, old_data, new_data
    ) values (
      rid, auth.uid(), 'delete', tg_table_name, entity_key, to_jsonb(old), null
    );
    return old;
  elsif tg_op = 'INSERT' then
    insert into public.audit_logs(
      restaurant_id, actor_user_id, action, entity_type, entity_id, old_data, new_data
    ) values (
      rid, auth.uid(), 'create', tg_table_name, entity_key, null, to_jsonb(new)
    );
    return new;
  else
    insert into public.audit_logs(
      restaurant_id, actor_user_id, action, entity_type, entity_id, old_data, new_data
    ) values (
      rid, auth.uid(), 'update', tg_table_name, entity_key, to_jsonb(old), to_jsonb(new)
    );
    return new;
  end if;
end;
$function$;

revoke all on function private.write_restaurant_audit() from public, anon, authenticated;

-- Do not automatically expose future public objects to browser-facing roles.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- Existing grants were created with broad defaults. Rebuild them with least
-- privilege before rebuilding RLS policies.
revoke all privileges on table
  public.restaurants,
  public.restaurant_members,
  public.categories,
  public.menu_items,
  public.opening_hours,
  public.wifi_details,
  public.feedback,
  public.analytics_events,
  public.platform_admins,
  public.restaurant_invites,
  public.audit_logs
from anon, authenticated;

grant select on public.restaurants, public.categories, public.menu_items,
  public.opening_hours, public.wifi_details to anon;
grant insert on public.feedback, public.analytics_events to anon;

grant select, update on public.restaurants to authenticated;
grant select on public.restaurant_members, public.platform_admins,
  public.restaurant_invites, public.audit_logs to authenticated;
grant select, insert, update, delete on public.categories, public.menu_items,
  public.opening_hours, public.wifi_details to authenticated;
grant select, insert on public.analytics_events to authenticated;
grant select, insert on public.feedback to authenticated;
grant update (status) on public.feedback to authenticated;

revoke all privileges on sequence public.analytics_events_id_seq from anon, authenticated;
grant usage, select on sequence public.analytics_events_id_seq to anon, authenticated;

-- Replace overlapping policies with one explicit policy for each role/action.
do $policy_cleanup$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'restaurants','restaurant_members','categories','menu_items',
        'opening_hours','wifi_details','feedback','analytics_events',
        'platform_admins','restaurant_invites','audit_logs'
      ])
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end
$policy_cleanup$;

create policy "anon read active restaurants"
on public.restaurants for select to anon
using (status = 'active');

create policy "authenticated read restaurants"
on public.restaurants for select to authenticated
using (
  status = 'active'
  or (select private.is_restaurant_member(id))
  or (select private.is_platform_admin())
);

create policy "authorized update restaurants"
on public.restaurants for update to authenticated
using ((select private.is_restaurant_member(id)) or (select private.is_platform_admin()))
with check ((select private.is_restaurant_member(id)) or (select private.is_platform_admin()));

create policy "authenticated read memberships"
on public.restaurant_members for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_restaurant_member(restaurant_id))
  or (select private.is_platform_admin())
);

create policy "anon read active categories"
on public.categories for select to anon
using (
  is_active
  and exists (
    select 1 from public.restaurants r
    where r.id = restaurant_id and r.status = 'active'
  )
);

create policy "authenticated read categories"
on public.categories for select to authenticated
using (
  (is_active and exists (
    select 1 from public.restaurants r
    where r.id = restaurant_id and r.status = 'active'
  ))
  or (select private.is_restaurant_member(restaurant_id))
  or (select private.is_platform_admin())
);

create policy "authorized insert categories"
on public.categories for insert to authenticated
with check ((select private.is_restaurant_member(restaurant_id)) or (select private.is_platform_admin()));
create policy "authorized update categories"
on public.categories for update to authenticated
using ((select private.is_restaurant_member(restaurant_id)) or (select private.is_platform_admin()))
with check ((select private.is_restaurant_member(restaurant_id)) or (select private.is_platform_admin()));
create policy "authorized delete categories"
on public.categories for delete to authenticated
using ((select private.is_restaurant_member(restaurant_id)) or (select private.is_platform_admin()));

create policy "anon read available menu items"
on public.menu_items for select to anon
using (
  is_available
  and exists (
    select 1 from public.restaurants r
    where r.id = restaurant_id and r.status = 'active'
  )
);

create policy "authenticated read menu items"
on public.menu_items for select to authenticated
using (
  (is_available and exists (
    select 1 from public.restaurants r
    where r.id = restaurant_id and r.status = 'active'
  ))
  or (select private.is_restaurant_member(restaurant_id))
  or (select private.is_platform_admin())
);

create policy "authorized insert menu items"
on public.menu_items for insert to authenticated
with check ((select private.is_restaurant_member(restaurant_id)) or (select private.is_platform_admin()));
create policy "authorized update menu items"
on public.menu_items for update to authenticated
using ((select private.is_restaurant_member(restaurant_id)) or (select private.is_platform_admin()))
with check ((select private.is_restaurant_member(restaurant_id)) or (select private.is_platform_admin()));
create policy "authorized delete menu items"
on public.menu_items for delete to authenticated
using ((select private.is_restaurant_member(restaurant_id)) or (select private.is_platform_admin()));

create policy "anon read active opening hours"
on public.opening_hours for select to anon
using (exists (
  select 1 from public.restaurants r
  where r.id = restaurant_id and r.status = 'active'
));

create policy "authenticated read opening hours"
on public.opening_hours for select to authenticated
using (
  exists (select 1 from public.restaurants r where r.id = restaurant_id and r.status = 'active')
  or (select private.is_restaurant_member(restaurant_id))
  or (select private.is_platform_admin())
);
create policy "authorized insert opening hours"
on public.opening_hours for insert to authenticated
with check ((select private.is_restaurant_member(restaurant_id)) or (select private.is_platform_admin()));
create policy "authorized update opening hours"
on public.opening_hours for update to authenticated
using ((select private.is_restaurant_member(restaurant_id)) or (select private.is_platform_admin()))
with check ((select private.is_restaurant_member(restaurant_id)) or (select private.is_platform_admin()));
create policy "authorized delete opening hours"
on public.opening_hours for delete to authenticated
using ((select private.is_restaurant_member(restaurant_id)) or (select private.is_platform_admin()));

create policy "anon read visible wifi"
on public.wifi_details for select to anon
using (
  is_visible
  and exists (select 1 from public.restaurants r where r.id = restaurant_id and r.status = 'active')
);
create policy "authenticated read wifi"
on public.wifi_details for select to authenticated
using (
  (is_visible and exists (select 1 from public.restaurants r where r.id = restaurant_id and r.status = 'active'))
  or (select private.is_restaurant_member(restaurant_id))
  or (select private.is_platform_admin())
);
create policy "authorized insert wifi"
on public.wifi_details for insert to authenticated
with check ((select private.is_restaurant_member(restaurant_id)) or (select private.is_platform_admin()));
create policy "authorized update wifi"
on public.wifi_details for update to authenticated
using ((select private.is_restaurant_member(restaurant_id)) or (select private.is_platform_admin()))
with check ((select private.is_restaurant_member(restaurant_id)) or (select private.is_platform_admin()));
create policy "authorized delete wifi"
on public.wifi_details for delete to authenticated
using ((select private.is_restaurant_member(restaurant_id)) or (select private.is_platform_admin()));

create policy "public submit feedback"
on public.feedback for insert to anon, authenticated
with check (exists (
  select 1 from public.restaurants r
  where r.id = restaurant_id and r.status = 'active'
));
create policy "authorized read feedback"
on public.feedback for select to authenticated
using ((select private.is_restaurant_member(restaurant_id)) or (select private.is_platform_admin()));
create policy "authorized update feedback"
on public.feedback for update to authenticated
using ((select private.is_restaurant_member(restaurant_id)) or (select private.is_platform_admin()))
with check ((select private.is_restaurant_member(restaurant_id)) or (select private.is_platform_admin()));

create policy "public insert analytics"
on public.analytics_events for insert to anon, authenticated
with check (exists (
  select 1 from public.restaurants r
  where r.id = restaurant_id and r.status = 'active'
));
create policy "authorized read analytics"
on public.analytics_events for select to authenticated
using ((select private.is_restaurant_member(restaurant_id)) or (select private.is_platform_admin()));

create policy "platform admin read self"
on public.platform_admins for select to authenticated
using (user_id = (select auth.uid()));

create policy "platform admin read invites"
on public.restaurant_invites for select to authenticated
using ((select private.is_platform_admin()));

create policy "authorized read audit logs"
on public.audit_logs for select to authenticated
using ((select private.is_restaurant_member(restaurant_id)) or (select private.is_platform_admin()));

-- New restaurants start in draft and are activated deliberately by Menu Go Admin.
create or replace function public.create_restaurant_with_invite(
  p_name text,
  p_slug text,
  p_tagline text default null,
  p_address text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_restaurant public.restaurants%rowtype;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admin access required';
  end if;
  if char_length(trim(p_name)) < 2 then
    raise exception 'Restaurant name is required';
  end if;
  if p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Slug must use lowercase letters, numbers and hyphens';
  end if;

  insert into public.restaurants(name, slug, tagline, address, status)
  values (
    trim(p_name), trim(p_slug), nullif(trim(coalesce(p_tagline, '')), ''),
    nullif(trim(coalesce(p_address, '')), ''), 'draft'
  )
  returning * into v_restaurant;

  return jsonb_build_object('restaurant_id', v_restaurant.id, 'slug', v_restaurant.slug);
end;
$function$;

create or replace function public.create_restaurant_email_invite(
  p_restaurant_id uuid,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $function$
declare
  v_code text;
  v_email text := lower(trim(p_email));
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admin access required';
  end if;
  if not exists (select 1 from public.restaurants where id = p_restaurant_id) then
    raise exception 'Restaurant not found';
  end if;
  if char_length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$' then
    raise exception 'A valid manager email is required';
  end if;

  update public.restaurant_invites
  set used_at = now()
  where restaurant_id = p_restaurant_id and used_at is null;

  v_code := 'MG-' || upper(substr(encode(extensions.gen_random_bytes(10), 'hex'), 1, 16));
  insert into public.restaurant_invites(
    restaurant_id, code_hash, role, expires_at, created_by, invitee_email
  ) values (
    p_restaurant_id, extensions.digest(v_code, 'sha256'), 'manager',
    now() + interval '14 days', auth.uid(), v_email
  );

  return jsonb_build_object('invite_code', v_code, 'email', v_email, 'expires_in_days', 14);
end;
$function$;

create or replace function public.redeem_restaurant_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $function$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt()->>'email', ''));
  v_invite public.restaurant_invites%rowtype;
begin
  if v_uid is null or v_email = '' then
    raise exception 'A verified sign-in is required';
  end if;

  select * into v_invite
  from public.restaurant_invites
  where code_hash = extensions.digest(trim(p_code), 'sha256')
    and used_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Invalid or expired invitation';
  end if;
  if v_invite.invitee_email is null or lower(v_invite.invitee_email) <> v_email then
    raise exception 'This invitation was sent to a different email address';
  end if;

  insert into public.restaurant_members(restaurant_id, user_id, role)
  values (v_invite.restaurant_id, v_uid, 'manager')
  on conflict (restaurant_id, user_id) do update set role = 'manager';

  update public.restaurant_invites set used_at = now() where id = v_invite.id;
  return jsonb_build_object('ok', true, 'restaurant_id', v_invite.restaurant_id, 'role', 'restaurant_manager');
end;
$function$;

revoke all on function public.create_restaurant_with_invite(text,text,text,text) from public, anon;
revoke all on function public.create_restaurant_email_invite(uuid,text) from public, anon;
revoke all on function public.redeem_restaurant_invite(text) from public, anon;
grant execute on function public.create_restaurant_with_invite(text,text,text,text) to authenticated, service_role;
grant execute on function public.create_restaurant_email_invite(uuid,text) to authenticated, service_role;
grant execute on function public.redeem_restaurant_invite(text) to authenticated, service_role;

-- Platform admins and the assigned restaurant manager may manage image files.
drop policy if exists "restaurant members upload menu images" on storage.objects;
drop policy if exists "restaurant members update menu images" on storage.objects;
drop policy if exists "restaurant members delete menu images" on storage.objects;

create policy "authorized upload menu images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'menu-images'
  and (
    private.is_restaurant_member(((storage.foldername(name))[1])::uuid)
    or private.is_platform_admin()
  )
);
create policy "authorized update menu images"
on storage.objects for update to authenticated
using (
  bucket_id = 'menu-images'
  and (
    private.is_restaurant_member(((storage.foldername(name))[1])::uuid)
    or private.is_platform_admin()
  )
)
with check (
  bucket_id = 'menu-images'
  and (
    private.is_restaurant_member(((storage.foldername(name))[1])::uuid)
    or private.is_platform_admin()
  )
);
create policy "authorized delete menu images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'menu-images'
  and (
    private.is_restaurant_member(((storage.foldername(name))[1])::uuid)
    or private.is_platform_admin()
  )
);

-- Keep Abol Coffee live; the other tenants are retained as drafts for demos.
update public.restaurants
set status = 'draft', updated_at = now()
where slug in ('sora-table', 'addis-harvest');

update public.restaurants
set status = 'active'
where slug = 'abol-coffee';

-- Create a clearly non-deliverable placeholder invite. The platform admin can
-- replace it with the real manager email from the dashboard before handover.
update public.restaurant_invites
set used_at = now()
where restaurant_id = '77777777-7777-4777-8777-777777777777'::uuid
  and used_at is null;

insert into public.restaurant_invites(
  restaurant_id, code_hash, role, expires_at, invitee_email
)
select
  '77777777-7777-4777-8777-777777777777'::uuid,
  extensions.digest(encode(extensions.gen_random_bytes(16), 'hex'), 'sha256'),
  'manager', now() + interval '14 days',
  'abol.manager.' || substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 8) || '@example.invalid'
where exists (
  select 1 from public.restaurants
  where id = '77777777-7777-4777-8777-777777777777'::uuid
);

notify pgrst, 'reload schema';

commit;
