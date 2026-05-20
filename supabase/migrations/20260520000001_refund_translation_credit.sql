-- Tłumacz redesign: refund a single per-invoice translation charge.
--
-- Companion to the credit-shift introduced in PR #C — when /api/translate
-- consumes a credit and then the OpenAI call fails after retries, we need
-- to reverse the consume cleanly. The existing refund_paid_credits is keyed
-- on stripe_purchase_id, not invoice_id, so we add a dedicated function.
--
-- Behavior: find the most recent 'consume' ledger row for (p_user, p_invoice)
-- and emit an opposite-sign 'refund' row plus update credit_balances. The
-- refund is idempotent — calling twice for the same invoice no-ops the
-- second call because there's no consume to reverse.

create or replace function public.refund_translation_credit(p_user uuid, p_invoice uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consume public.credit_ledger%rowtype;
  v_balance public.credit_balances%rowtype;
  v_refund_count int;
begin
  if p_user is null or p_invoice is null then
    raise exception 'refund_translation_credit: user and invoice are required';
  end if;

  -- Already refunded? Idempotency guard — if a previous refund row exists
  -- for this (user, invoice) pair, return false without changing state.
  select count(*) into v_refund_count
    from public.credit_ledger
   where user_id = p_user
     and invoice_id = p_invoice
     and event_type = 'refund_translation';
  if v_refund_count > 0 then
    return false;
  end if;

  -- Find the most recent consume row for this (user, invoice). If none,
  -- there's nothing to refund — return false. This handles legacy invoices
  -- where the credit was consumed at upload time (event_type = 'consume'
  -- still applies; only the trigger location changed).
  select * into v_consume
    from public.credit_ledger
   where user_id = p_user
     and invoice_id = p_invoice
     and event_type = 'consume'
     and (delta_free < 0 or delta_paid < 0)
   order by created_at desc
   limit 1;

  if not found then
    return false;
  end if;

  -- Lock the balance row before updating to avoid a race with concurrent
  -- consume/refund/grant calls on the same user.
  select * into v_balance from public.credit_balances where user_id = p_user for update;
  if not found then
    -- Should never happen — consume would have created the row. Be defensive.
    raise exception 'refund_translation_credit: missing credit_balances row for user %', p_user;
  end if;

  -- Restore the bucket the consume hit. delta_free was negative on the
  -- consume row, so the refund's delta is the absolute value. Same for paid.
  update public.credit_balances
     set free_credits_remaining = free_credits_remaining + abs(v_consume.delta_free),
         paid_credits           = paid_credits + abs(v_consume.delta_paid),
         updated_at             = now()
   where user_id = p_user
  returning * into v_balance;

  insert into public.credit_ledger (
    user_id, event_type, delta_paid, delta_free,
    balance_paid_after, balance_free_after, invoice_id, note
  ) values (
    p_user,
    'refund_translation',
    abs(v_consume.delta_paid),
    abs(v_consume.delta_free),
    v_balance.paid_credits,
    v_balance.free_credits_remaining,
    p_invoice,
    'translation engine failure'
  );

  return true;
end;
$$;

revoke all on function public.refund_translation_credit(uuid, uuid) from public;
grant execute on function public.refund_translation_credit(uuid, uuid) to service_role;
