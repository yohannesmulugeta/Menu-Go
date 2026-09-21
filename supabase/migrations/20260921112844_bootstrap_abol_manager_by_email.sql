
create or replace function public.bootstrap_abol_manager()
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt()->>'email',''));
  v_restaurant_id uuid := '77777777-7777-4777-8777-777777777777'::uuid;
begin
  if v_uid is null then
    raise exception 'You must be signed in';
  end if;

  if v_email <> 'yohannesmulugeta084+abol@gmail.com' then
    raise exception 'This email is not authorized for Abol manager setup';
  end if;

  insert into public.restaurant_members(restaurant_id,user_id,role)
  values (v_restaurant_id,v_uid,'manager')
  on conflict (restaurant_id,user_id) do update set role='manager';

  delete from public.platform_admins where user_id=v_uid;

  return jsonb_build_object('ok',true,'role','restaurant_manager','restaurant_id',v_restaurant_id);
end;
$$;

revoke all on function public.bootstrap_abol_manager() from public, anon;
grant execute on function public.bootstrap_abol_manager() to authenticated;

