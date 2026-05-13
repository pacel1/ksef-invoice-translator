create or replace function public.ensure_free_credit_for_period(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_period date := date_trunc('month', now())::date;
  v_balance        public.credit_balances%rowtype;
  v_inserted       bigint;
begin
  -- First-time creation: row arrives with the monthly free credit already granted.
  insert into public.credit_balances (user_id, free_credits_remaining, free_credits_period_start)
  values (p_user, 1, v_current_period)
  on conflict (user_id) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted = 1 then
    insert into public.credit_ledger (user_id, event_type, delta_paid, delta_free, balance_paid_after, balance_free_after, note)
    values (p_user, 'free_grant', 0, 1, 0, 1, 'initial monthly free credit');
    return;
  end if;

  -- Row already existed: roll over only if a new month has started.
  select * into v_balance from public.credit_balances where user_id = p_user for update;

  if v_balance.free_credits_period_start < v_current_period then
    update public.credit_balances
       set free_credits_remaining = 1,
           free_credits_period_start = v_current_period,
           updated_at = now()
     where user_id = p_user
     returning * into v_balance;

    insert into public.credit_ledger (user_id, event_type, delta_paid, delta_free, balance_paid_after, balance_free_after, note)
    values (p_user, 'free_grant', 0, 1, v_balance.paid_credits, v_balance.free_credits_remaining, 'monthly free credit');
  end if;
end;
$$;

create or replace function public.consume_credit(p_user uuid, p_invoice uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance public.credit_balances%rowtype;
  v_delta_free int := 0;
  v_delta_paid int := 0;
begin
  perform public.ensure_free_credit_for_period(p_user);

  select * into v_balance from public.credit_balances where user_id = p_user for update;

  if v_balance.free_credits_remaining > 0 then
    v_delta_free := -1;
  elsif v_balance.paid_credits > 0 then
    v_delta_paid := -1;
  else
    raise exception 'insufficient_credit' using errcode = 'P0001';
  end if;

  update public.credit_balances
     set free_credits_remaining = free_credits_remaining + v_delta_free,
         paid_credits = paid_credits + v_delta_paid,
         updated_at = now()
   where user_id = p_user
  returning * into v_balance;

  insert into public.credit_ledger (user_id, event_type, delta_paid, delta_free, balance_paid_after, balance_free_after, invoice_id)
  values (p_user, 'consume', v_delta_paid, v_delta_free, v_balance.paid_credits, v_balance.free_credits_remaining, p_invoice);
end;
$$;

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

  update public.credit_balances
     set paid_credits = paid_credits + p_amount,
         updated_at = now()
   where user_id = p_user
  returning * into v_balance;

  insert into public.credit_ledger (user_id, event_type, delta_paid, delta_free, balance_paid_after, balance_free_after, stripe_purchase_id)
  values (p_user, 'purchase', p_amount, 0, v_balance.paid_credits, v_balance.free_credits_remaining, p_purchase);
end;
$$;

create or replace function public.refund_paid_credits(p_user uuid, p_purchase uuid, p_amount int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance public.credit_balances%rowtype;
  v_apply   int;
begin
  if p_amount <= 0 then
    raise exception 'refund_amount_must_be_positive';
  end if;

  perform public.ensure_free_credit_for_period(p_user);

  select * into v_balance from public.credit_balances where user_id = p_user for update;
  v_apply := least(p_amount, v_balance.paid_credits);

  update public.credit_balances
     set paid_credits = paid_credits - v_apply,
         updated_at = now()
   where user_id = p_user
  returning * into v_balance;

  insert into public.credit_ledger (user_id, event_type, delta_paid, delta_free, balance_paid_after, balance_free_after, stripe_purchase_id, note)
  values (
    p_user,
    'refund',
    -v_apply,
    0,
    v_balance.paid_credits,
    v_balance.free_credits_remaining,
    p_purchase,
    case when v_apply < p_amount then format('clamped: requested %s, applied %s', p_amount, v_apply) else null end
  );
end;
$$;

revoke all on function public.ensure_free_credit_for_period(uuid) from public;
revoke all on function public.consume_credit(uuid, uuid) from public;
revoke all on function public.grant_paid_credits(uuid, uuid, int) from public;
revoke all on function public.refund_paid_credits(uuid, uuid, int) from public;

grant execute on function public.ensure_free_credit_for_period(uuid) to service_role;
grant execute on function public.consume_credit(uuid, uuid) to service_role;
grant execute on function public.grant_paid_credits(uuid, uuid, int) to service_role;
grant execute on function public.refund_paid_credits(uuid, uuid, int) to service_role;
