
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

  return jsonb_build_object(
    'restaurant_id', v_restaurant.id,
    'slug', v_restaurant.slug,
    'invite_code', null
  );
end;
$$;

revoke all on function public.create_restaurant_with_invite(text,text,text,text) from public, anon;
grant execute on function public.create_restaurant_with_invite(text,text,text,text) to authenticated;

