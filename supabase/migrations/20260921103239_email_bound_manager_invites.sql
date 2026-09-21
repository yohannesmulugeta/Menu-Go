
alter table public.restaurant_invites
  add column if not exists invitee_email text;

alter table public.restaurant_invites
  alter column role set default 'manager';

create index if not exists idx_restaurant_invites_email
  on public.restaurant_invites(lower(invitee_email))
  where invitee_email is not null and used_at is null;

create or replace function public.create_restaurant_email_invite(
  p_restaurant_id uuid,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_code text;
  v_email text := lower(trim(p_email));
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admin access required';
  end if;

  if v_email = '' or position('@' in v_email) < 2 then
    raise exception 'A valid manager email is required';
  end if;

  update public.restaurant_invites
  set used_at = now()
  where restaurant_id = p_restaurant_id
    and lower(invitee_email) = v_email
    and used_at is null;

  v_code := 'MG-' || upper(substr(encode(gen_random_bytes(10), 'hex'), 1, 16));

  insert into public.restaurant_invites(
    restaurant_id, code_hash, role, expires_at, created_by, invitee_email
  )
  values (
    p_restaurant_id,
    digest(v_code, 'sha256'),
    'manager',
    now() + interval '14 days',
    auth.uid(),
    v_email
  );

  return jsonb_build_object(
    'invite_code', v_code,
    'email', v_email,
    'expires_in_days', 14
  );
end;
$$;

revoke all on function public.create_restaurant_email_invite(uuid,text) from public, anon;
grant execute on function public.create_restaurant_email_invite(uuid,text) to authenticated;

create or replace function public.redeem_restaurant_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt()->>'email',''));
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
    raise exception 'Invalid or expired invitation';
  end if;

  if v_invite.invitee_email is not null
     and lower(v_invite.invitee_email) <> v_email then
    raise exception 'This invitation was sent to a different email address';
  end if;

  insert into public.restaurant_members(restaurant_id, user_id, role)
  values (v_invite.restaurant_id, v_uid, 'manager')
  on conflict (restaurant_id, user_id) do update set role = 'manager';

  update public.restaurant_invites
  set used_at = now()
  where id = v_invite.id;

  return jsonb_build_object(
    'ok', true,
    'restaurant_id', v_invite.restaurant_id,
    'role', 'restaurant_manager'
  );
end;
$$;

revoke all on function public.redeem_restaurant_invite(text) from public, anon;
grant execute on function public.redeem_restaurant_invite(text) to authenticated;

