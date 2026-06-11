-- A paid purchase whose buyer identity could not be extracted from the
-- Stripe session gets credits anyway (fulfillment is not the problem),
-- but no faktura can be issued until an operator backfills the buyer
-- data. Persist that state so such rows are queryable instead of only
-- visible in webhook logs.
alter table public.stripe_purchases
  add column needs_manual_review boolean not null default false;

comment on column public.stripe_purchases.needs_manual_review is
  'Paid, but buyer identity missing from the Stripe session — operator must backfill buyer data and trigger faktura issuance manually.';
