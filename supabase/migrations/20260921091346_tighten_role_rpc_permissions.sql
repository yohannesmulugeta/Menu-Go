
revoke execute on function public.claim_owner_setup(text) from anon;
revoke execute on function public.create_restaurant_invite(uuid) from anon;
revoke execute on function public.create_restaurant_with_invite(text,text,text,text) from anon;
revoke execute on function public.redeem_restaurant_invite(text) from anon;

grant execute on function public.claim_owner_setup(text) to authenticated;
grant execute on function public.create_restaurant_invite(uuid) to authenticated;
grant execute on function public.create_restaurant_with_invite(text,text,text,text) to authenticated;
grant execute on function public.redeem_restaurant_invite(text) to authenticated;

create index if not exists idx_audit_logs_actor on public.audit_logs(actor_user_id);
create index if not exists idx_restaurant_invites_created_by on public.restaurant_invites(created_by);

