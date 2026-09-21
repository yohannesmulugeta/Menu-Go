
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.owner_setup_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash bytea not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.restaurant_invites (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  code_hash bytea not null unique,
  role text not null default 'admin' check (role in ('owner','admin','editor','viewer')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;
alter table public.owner_setup_codes enable row level security;
alter table public.restaurant_invites enable row level security;

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins pa
    where pa.user_id = (select auth.uid())
  );
$$;

create policy "platform admins read self"
on public.platform_admins for select
to authenticated
using (user_id = (select auth.uid()));

create policy "platform admins manage restaurants"
on public.restaurants for all
to authenticated
using (private.is_platform_admin())
with check (private.is_platform_admin());

create policy "platform admins manage memberships"
on public.restaurant_members for all
to authenticated
using (private.is_platform_admin())
with check (private.is_platform_admin());

create policy "platform admins manage categories"
on public.categories for all
to authenticated
using (private.is_platform_admin())
with check (private.is_platform_admin());

create policy "platform admins manage menu items"
on public.menu_items for all
to authenticated
using (private.is_platform_admin())
with check (private.is_platform_admin());

create policy "platform admins manage hours"
on public.opening_hours for all
to authenticated
using (private.is_platform_admin())
with check (private.is_platform_admin());

create policy "platform admins manage wifi"
on public.wifi_details for all
to authenticated
using (private.is_platform_admin())
with check (private.is_platform_admin());

create policy "platform admins read feedback"
on public.feedback for select
to authenticated
using (private.is_platform_admin());

create policy "platform admins update feedback"
on public.feedback for update
to authenticated
using (private.is_platform_admin())
with check (private.is_platform_admin());

create policy "platform admins read analytics"
on public.analytics_events for select
to authenticated
using (private.is_platform_admin());

create policy "platform admins read invites"
on public.restaurant_invites for select
to authenticated
using (private.is_platform_admin());

create or replace function public.claim_owner_setup(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_code public.owner_setup_codes%rowtype;
  v_demo uuid := '11111111-1111-4111-8111-111111111111';
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
    raise exception 'Platform owner has already been configured';
  end if;

  insert into public.platform_admins(user_id)
  values (v_uid)
  on conflict (user_id) do nothing;

  insert into public.restaurant_members(restaurant_id, user_id, role)
  values (v_demo, v_uid, 'owner')
  on conflict (restaurant_id, user_id) do update set role = 'owner';

  update public.owner_setup_codes
  set used_at = now()
  where id = v_code.id;

  return jsonb_build_object('ok', true, 'restaurant_id', v_demo);
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
  values (trim(p_name), trim(p_slug), nullif(trim(coalesce(p_tagline,'')),''), nullif(trim(coalesce(p_address,'')),''), 'active')
  returning * into v_restaurant;

  v_code := 'MG-' || upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12));

  insert into public.restaurant_invites(restaurant_id, code_hash, role, expires_at, created_by)
  values (
    v_restaurant.id,
    digest(v_code, 'sha256'),
    'owner',
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

revoke all on function public.create_restaurant_with_invite(text,text,text,text) from public;
grant execute on function public.create_restaurant_with_invite(text,text,text,text) to authenticated;

create or replace function public.create_restaurant_invite(
  p_restaurant_id uuid,
  p_role text default 'admin'
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_code text;
begin
  if not (private.is_platform_admin() or private.is_restaurant_member(p_restaurant_id)) then
    raise exception 'Not allowed';
  end if;

  if p_role not in ('owner','admin','editor','viewer') then
    raise exception 'Invalid role';
  end if;

  v_code := 'MG-' || upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12));

  insert into public.restaurant_invites(restaurant_id, code_hash, role, expires_at, created_by)
  values (p_restaurant_id, digest(v_code, 'sha256'), p_role, now() + interval '14 days', auth.uid());

  return jsonb_build_object('invite_code', v_code, 'expires_in_days', 14);
end;
$$;

revoke all on function public.create_restaurant_invite(uuid,text) from public;
grant execute on function public.create_restaurant_invite(uuid,text) to authenticated;

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
  values (v_invite.restaurant_id, v_uid, v_invite.role)
  on conflict (restaurant_id, user_id) do update set role = excluded.role;

  update public.restaurant_invites set used_at = now() where id = v_invite.id;

  return jsonb_build_object('ok', true, 'restaurant_id', v_invite.restaurant_id, 'role', v_invite.role);
end;
$$;

revoke all on function public.redeem_restaurant_invite(text) from public;
grant execute on function public.redeem_restaurant_invite(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-images',
  'menu-images',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp','image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "restaurant members upload menu images" on storage.objects;
create policy "restaurant members upload menu images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'menu-images'
  and private.is_restaurant_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "restaurant members update menu images" on storage.objects;
create policy "restaurant members update menu images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'menu-images'
  and private.is_restaurant_member(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'menu-images'
  and private.is_restaurant_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "restaurant members delete menu images" on storage.objects;
create policy "restaurant members delete menu images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'menu-images'
  and private.is_restaurant_member(((storage.foldername(name))[1])::uuid)
);

create index if not exists idx_restaurant_invites_restaurant on public.restaurant_invites(restaurant_id);

