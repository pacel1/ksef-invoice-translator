-- Defense-in-depth idempotency for credit grants.
--
-- Today the only thing preventing a double credit grant is the webhook's
-- optimistic pending->paid status flip. The grant itself runs in a separate
-- RPC/transaction with no DB-level invariant tying "one paid flip" to "one
-- grant", so a crash/retry between the flip and the grant -- or any future
-- weakening of the webhook guard -- could double-credit a user.
--
-- Add a unique partial index so each stripe_purchase can back at most one
-- 'purchase' ledger row, and rewrite grant_paid_credits to claim that row
-- atomically (under the balance row lock) and no-op on conflict. After this,
-- a double grant is impossible at the data layer regardless of the caller.

create unique index if not exists credit_ledger_purchase_grant_uniq
  on public.credit_ledger (stripe_purchase_id)
  where event_type = 'purchase';

create or replace function public.grant_paid_credits(p_user uuid, p_purchase uuid, p_amount int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance public.credit_balances%rowtype;
begin
  if p_amount <= 0 then
    raise exception 'grant_amount_must_be_positive';
  end if;

  -- Make sure the row exists and the monthly free credit has been granted before we add paid credits.
  perform public.ensure_free_credit_for_period(p_user);

  -- Lock the user's balance row to serialise concurrent grants for this user.
  select * into v_balance from public.credit_balances where user_id = p_user for update;

  -- Claim this purchase via the unique partial index. If another delivery of the
  -- same purchase already granted, the insert is skipped and we no-op -- the
  -- balance is never touched twice.
  insert into public.credit_ledger (
    user_id, event_type, delta_paid, delta_free,
    balance_paid_after, balance_free_after, stripe_purchase_id
  )
  values (
    p_user, 'purchase', p_amount, 0,
    v_balance.paid_credits + p_amount, v_balance.free_credits_remaining, p_purchase
  )
  on conflict (stripe_purchase_id) where event_type = 'purchase' do nothing;

  if not found then
    return; -- already granted for this purchase
  end if;

  update public.credit_balances
     set paid_credits = paid_credits + p_amount,
         updated_at = now()
   where user_id = p_user;
end;
$$;

revoke execute on function public.grant_paid_credits(uuid, uuid, int) from anon, authenticated;
