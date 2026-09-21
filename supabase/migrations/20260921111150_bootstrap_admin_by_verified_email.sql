
create or replace function public.bootstrap_platform_admin()
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt()->>'email',''));
begin
  if v_uid is null then
    raise exception 'You must be signed in';
  end if;

  if v_email <> 'yohannesmulugeta084@gmail.com' then
    raise exception 'This email is not authorized for Menu Go Admin setup';
  end if;

  if exists(select 1 from public.platform_admins where user_id <> v_uid) then
    raise exception 'Menu Go Admin has already been configured';
  end if;

  insert into public.platform_admins(user_id)
  values (v_uid)
  on conflict (user_id) do nothing;

  delete from public.restaurant_members where user_id = v_uid;

  return jsonb_build_object('ok',true,'role','platform_admin');
end;
$$;

revoke all on function public.bootstrap_platform_admin() from public, anon;
grant execute on function public.bootstrap_platform_admin() to authenticated;

