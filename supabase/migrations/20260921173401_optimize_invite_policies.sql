begin;

drop policy if exists "authorized read invites" on public.restaurant_invites;
create policy "authorized read invites"
on public.restaurant_invites for select to authenticated
using (
  (select private.is_platform_admin())
  or (
    invitee_email is not null
    and lower(invitee_email) = lower(coalesce((select auth.jwt()->>'email'), ''))
  )
);

drop policy if exists "authorized consume invites" on public.restaurant_invites;
create policy "authorized consume invites"
on public.restaurant_invites for update to authenticated
using (
  (select private.is_platform_admin())
  or (
    invitee_email is not null
    and lower(invitee_email) = lower(coalesce((select auth.jwt()->>'email'), ''))
  )
)
with check (
  (select private.is_platform_admin())
  or (
    invitee_email is not null
    and lower(invitee_email) = lower(coalesce((select auth.jwt()->>'email'), ''))
  )
);

drop policy if exists "invited user creates membership" on public.restaurant_members;
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
      and lower(i.invitee_email) = lower(coalesce((select auth.jwt()->>'email'), ''))
      and i.used_at is null
      and i.expires_at > now()
  )
);

notify pgrst, 'reload schema';

commit;
