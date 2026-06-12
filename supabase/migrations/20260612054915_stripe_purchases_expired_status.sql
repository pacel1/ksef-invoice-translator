-- Abandoned checkout sessions need a terminal status distinct from
-- 'failed' (payment attempted and rejected) so the abuse caps and ops
-- queries can tell "never paid, walked away" from "payment failed".
-- The checkout.session.expired webhook flips pending -> expired.
--
-- Wrapped in a transaction so the table is never left without a status
-- check; 'if exists' keeps a partial/replayed apply from failing.
begin;

alter table public.stripe_purchases
  drop constraint if exists stripe_purchases_status_check;

alter table public.stripe_purchases
  add constraint stripe_purchases_status_check
  check (status in ('pending', 'paid', 'failed', 'refunded', 'expired'));

commit;
