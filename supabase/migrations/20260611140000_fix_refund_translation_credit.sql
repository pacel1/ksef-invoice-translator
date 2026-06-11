-- Security + correctness fix for refund_translation_credit (see 20260520000001).
--
-- Bug 1 (correctness, money path): the function inserts a ledger row with
-- event_type = 'refund_translation', but credit_ledger's CHECK constraint
-- (20260513000006) never permitted that value. Every refund therefore raised
-- 23514 and rolled back, so a user whose translation failed *after* a credit was
-- consumed was silently never refunded. The idempotency guard, which queries for
-- prior 'refund_translation' rows, was likewise permanently dead. Widen the
-- constraint to include the value the function actually writes.
--
-- Bug 2 (exposure): the original migration only ran `revoke all ... from public`,
-- which does NOT remove Supabase's default EXECUTE grants to the anon and
-- authenticated roles. The function is SECURITY DEFINER and trusts its p_user
-- argument, so any signed-in (or anonymous) caller could invoke it via
-- /rest/v1/rpc/refund_translation_credit. Lock it down to service_role only,
-- matching the other credit functions in 20260513000010.

alter table public.credit_ledger
  drop constraint credit_ledger_event_type_check;

alter table public.credit_ledger
  add constraint credit_ledger_event_type_check
  check (event_type in ('purchase', 'consume', 'free_grant', 'refund', 'refund_translation', 'adjustment'));

revoke execute on function public.refund_translation_credit(uuid, uuid) from anon, authenticated;
