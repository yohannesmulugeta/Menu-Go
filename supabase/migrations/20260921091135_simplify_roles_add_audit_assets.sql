
-- Simplify restaurant authentication to one restaurant role: manager.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'restaurant_members_role_check'
      and conrelid = 'public.restaurant_members'::regclass
  ) then
    alter table public.restaurant_members drop constraint restaurant_members_role_check;
  end if;
end $$;

update public.restaurant_members set role = 'manager' where role <> 'manager';
alter table public.restaurant_members
  add constraint restaurant_members_role_check check (role = 'manager');

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'restaurant_invites_role_check'
      and conrelid = 'public.restaurant_invites'::regclass
  ) then
    alter table public.restaurant_invites drop constraint restaurant_invites_role_check;
  end if;
end $$;

update public.restaurant_invites set role = 'manager' where role <> 'manager';
alter table public.restaurant_invites
  add constraint restaurant_invites_role_check check (role = 'manager');

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
      and rm.role = 'manager'
  );
$$;

-- First Menu Go account becomes platform admin only; platform admins already have RLS access to all restaurants.
create or replace function public.claim_owner_setup(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_code public.owner_setup_codes%rowtype;
begin
  if v_uid is null then
    raise exception 'You must be signed in';
  end if;

  select * into v_code
  from public.owner_setup_codes
  where code_hash = digest(trim(p_code), 'sha256')
    and used_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Invalid or expired owner setup code';
  end if;

  if exists (select 1 from public.platform_admins) and
     not exists (select 1 from public.platform_admins where user_id = v_uid) then
    raise exception 'Platform admin has already been configured';
  end if;

  insert into public.platform_admins(user_id)
  values (v_uid)
  on conflict (user_id) do nothing;

  delete from public.restaurant_members where user_id = v_uid;

  update public.owner_setup_codes
  set used_at = now()
  where id = v_code.id;

  return jsonb_build_object('ok', true, 'role', 'platform_admin');
end;
$$;

revoke all on function public.claim_owner_setup(text) from public;
grant execute on function public.claim_owner_setup(text) to authenticated;

create or replace function public.create_restaurant_with_invite(
  p_name text,
  p_slug text,
  p_tagline text default null,
  p_address text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_restaurant public.restaurants%rowtype;
  v_code text;
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
    trim(p_name),
    trim(p_slug),
    nullif(trim(coalesce(p_tagline,'')),''),
    nullif(trim(coalesce(p_address,'')),''),
    'active'
  )
  returning * into v_restaurant;

  v_code := 'MG-' || upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12));

  insert into public.restaurant_invites(restaurant_id, code_hash, role, expires_at, created_by)
  values (
    v_restaurant.id,
    digest(v_code, 'sha256'),
    'manager',
    now() + interval '14 days',
    auth.uid()
  );

  return jsonb_build_object(
    'restaurant_id', v_restaurant.id,
    'slug', v_restaurant.slug,
    'invite_code', v_code
  );
end;
$$;

create or replace function public.create_restaurant_invite(p_restaurant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_code text;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admin access required';
  end if;

  v_code := 'MG-' || upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12));

  insert into public.restaurant_invites(restaurant_id, code_hash, role, expires_at, created_by)
  values (
    p_restaurant_id,
    digest(v_code, 'sha256'),
    'manager',
    now() + interval '14 days',
    auth.uid()
  );

  return jsonb_build_object('invite_code', v_code, 'expires_in_days', 14);
end;
$$;

revoke all on function public.create_restaurant_invite(uuid) from public;
grant execute on function public.create_restaurant_invite(uuid) to authenticated;

drop function if exists public.create_restaurant_invite(uuid,text);

create or replace function public.redeem_restaurant_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.restaurant_invites%rowtype;
begin
  if v_uid is null then
    raise exception 'You must be signed in';
  end if;

  select * into v_invite
  from public.restaurant_invites
  where code_hash = digest(trim(p_code), 'sha256')
    and used_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Invalid or expired invite code';
  end if;

  insert into public.restaurant_members(restaurant_id, user_id, role)
  values (v_invite.restaurant_id, v_uid, 'manager')
  on conflict (restaurant_id, user_id) do update set role = 'manager';

  update public.restaurant_invites set used_at = now() where id = v_invite.id;

  return jsonb_build_object(
    'ok', true,
    'restaurant_id', v_invite.restaurant_id,
    'role', 'restaurant_manager'
  );
end;
$$;

-- Audit log.
create table if not exists public.audit_logs (
  id bigint generated by default as identity primary key,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('create','update','delete')),
  entity_type text not null,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_restaurant_created
  on public.audit_logs(restaurant_id, created_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists "restaurant managers read audit" on public.audit_logs;
create policy "restaurant managers read audit"
on public.audit_logs for select
to authenticated
using (private.is_restaurant_member(restaurant_id));

drop policy if exists "platform admins read audit" on public.audit_logs;
create policy "platform admins read audit"
on public.audit_logs for select
to authenticated
using (private.is_platform_admin());

create or replace function private.write_restaurant_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
  entity text := tg_table_name;
  entity_key text;
begin
  if tg_op = 'DELETE' then
    rid := case when tg_table_name = 'restaurants' then old.id else old.restaurant_id end;
    entity_key := old.id::text;
    insert into public.audit_logs(restaurant_id,actor_user_id,action,entity_type,entity_id,old_data,new_data)
    values (rid,auth.uid(),'delete',entity,entity_key,to_jsonb(old),null);
    return old;
  elsif tg_op = 'INSERT' then
    rid := case when tg_table_name = 'restaurants' then new.id else new.restaurant_id end;
    entity_key := new.id::text;
    insert into public.audit_logs(restaurant_id,actor_user_id,action,entity_type,entity_id,old_data,new_data)
    values (rid,auth.uid(),'create',entity,entity_key,null,to_jsonb(new));
    return new;
  else
    rid := case when tg_table_name = 'restaurants' then new.id else new.restaurant_id end;
    entity_key := new.id::text;
    insert into public.audit_logs(restaurant_id,actor_user_id,action,entity_type,entity_id,old_data,new_data)
    values (rid,auth.uid(),'update',entity,entity_key,to_jsonb(old),to_jsonb(new));
    return new;
  end if;
end;
$$;

drop trigger if exists audit_restaurants on public.restaurants;
create trigger audit_restaurants
after insert or update or delete on public.restaurants
for each row execute function private.write_restaurant_audit();

drop trigger if exists audit_menu_items on public.menu_items;
create trigger audit_menu_items
after insert or update or delete on public.menu_items
for each row execute function private.write_restaurant_audit();

drop trigger if exists audit_categories on public.categories;
create trigger audit_categories
after insert or update or delete on public.categories
for each row execute function private.write_restaurant_audit();

drop trigger if exists audit_opening_hours on public.opening_hours;
create trigger audit_opening_hours
after insert or update or delete on public.opening_hours
for each row execute function private.write_restaurant_audit();

-- Dedicated restaurant asset bucket.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'restaurant-assets',
  'restaurant-assets',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp','image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "manager upload restaurant assets" on storage.objects;
create policy "manager upload restaurant assets"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'restaurant-assets'
  and (
    private.is_restaurant_member(((storage.foldername(name))[1])::uuid)
    or private.is_platform_admin()
  )
);

drop policy if exists "manager update restaurant assets" on storage.objects;
create policy "manager update restaurant assets"
on storage.objects for update
to authenticated
using (
  bucket_id = 'restaurant-assets'
  and (
    private.is_restaurant_member(((storage.foldername(name))[1])::uuid)
    or private.is_platform_admin()
  )
)
with check (
  bucket_id = 'restaurant-assets'
  and (
    private.is_restaurant_member(((storage.foldername(name))[1])::uuid)
    or private.is_platform_admin()
  )
);

drop policy if exists "manager delete restaurant assets" on storage.objects;
create policy "manager delete restaurant assets"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'restaurant-assets'
  and (
    private.is_restaurant_member(((storage.foldername(name))[1])::uuid)
    or private.is_platform_admin()
  )
);

