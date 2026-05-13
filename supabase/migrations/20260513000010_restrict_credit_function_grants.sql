-- Supabase auto-grants execute on public functions to anon and authenticated.
-- Our credit functions trust their p_user argument, so they must only be
-- callable by service_role (server-side code with the secret key).
revoke execute on function public.ensure_free_credit_for_period(uuid) from anon, authenticated;
revoke execute on function public.consume_credit(uuid, uuid)               from anon, authenticated;
revoke execute on function public.grant_paid_credits(uuid, uuid, int)      from anon, authenticated;
revoke execute on function public.refund_paid_credits(uuid, uuid, int)     from anon, authenticated;

-- handle_new_user is a trigger function, never meant to be called as RPC.
revoke execute on function public.handle_new_user() from anon, authenticated, public;
