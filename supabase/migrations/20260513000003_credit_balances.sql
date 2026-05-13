create table public.credit_balances (
  user_id                   uuid primary key references public.profiles(id) on delete cascade,
  paid_credits              integer not null default 0 check (paid_credits >= 0),
  free_credits_remaining    integer not null default 0 check (free_credits_remaining >= 0),
  free_credits_period_start date    not null default date_trunc('month', now())::date,
  updated_at                timestamptz not null default now()
);

comment on table public.credit_balances is 'Denormalized current balance; ground truth lives in credit_ledger.';

alter table public.credit_balances enable row level security;
