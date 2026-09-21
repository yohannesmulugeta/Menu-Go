-- Run public RPCs with the caller's privileges so RLS remains the authorization
-- boundary. This removes the need for exposed SECURITY DEFINER entry points.

begin;

grant insert on public.restaurants to authenticated;
grant select, insert on public.restaurant_invites to authenticated;
grant update (used_at) on public.restaurant_invites to authenticated;
grant insert on public.restaurant_members to authenticated;

create policy "platform admin insert restaurants"
on public.restaurants for insert to authenticated
with check ((select private.is_platform_admin()));

drop policy if exists "platform admin read invites" on public.restaurant_invites;
create policy "authorized read invites"
on public.restaurant_invites for select to authenticated
using (
  (select private.is_platform_admin())
  or (
    invitee_email is not null
    and lower(invitee_email) = lower(coalesce(auth.jwt()->>'email', ''))
  )
);

create policy "platform admin insert invites"
on public.restaurant_invites for insert to authenticated
with check ((select private.is_platform_admin()));

create policy "authorized consume invites"
on public.restaurant_invites for update to authenticated
using (
  (select private.is_platform_admin())
  or (
    invitee_email is not null
    and lower(invitee_email) = lower(coalesce(auth.jwt()->>'email', ''))
  )
)
with check (
  (select private.is_platform_admin())
  or (
    invitee_email is not null
    and lower(invitee_email) = lower(coalesce(auth.jwt()->>'email', ''))
  )
);

create policy "invited user creates membership"
on public.restaurant_members for insert to authenticated
with check (
  user_id = (select auth.uid())
  and role = 'manager'
  and exists (
    select 1
    from public.restaurant_invites i
    where i.restaurant_id = restaurant_members.restaurant_id
      and i.invitee_email is not null
      and lower(i.invitee_email) = lower(coalesce(auth.jwt()->>'email', ''))
      and i.used_at is null
      and i.expires_at > now()
  )
);

create or replace function public.create_restaurant_with_invite(
  p_name text,
  p_slug text,
  p_tagline text default null,
  p_address text default null
)
returns jsonb
language plpgsql
security invoker
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
security invoker
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
security invoker
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
  on conflict (restaurant_id, user_id) do nothing;

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

notify pgrst, 'reload schema';

commit;
