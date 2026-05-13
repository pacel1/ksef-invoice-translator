create table public.stripe_purchases (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null references public.profiles(id) on delete cascade,
  stripe_checkout_session_id  text unique not null,
  stripe_payment_intent_id    text unique,
  package_size                integer not null check (package_size between 5 and 100),
  unit_price_cents            integer not null check (unit_price_cents > 0),
  total_amount_cents          integer not null check (total_amount_cents > 0),
  currency                    text not null default 'pln',
  status                      text not null check (status in ('pending', 'paid', 'failed', 'refunded')),
  credits_granted             integer not null default 0 check (credits_granted >= 0),
  created_at                  timestamptz not null default now(),
  paid_at                     timestamptz
);

create index stripe_purchases_user_created on public.stripe_purchases (user_id, created_at desc);

alter table public.stripe_purchases enable row level security;

alter table public.credit_ledger
  add constraint credit_ledger_stripe_purchase_fk
  foreign key (stripe_purchase_id) references public.stripe_purchases(id) on delete set null;
