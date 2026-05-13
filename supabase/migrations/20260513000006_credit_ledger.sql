create table public.credit_ledger (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  event_type          text not null check (event_type in ('purchase', 'consume', 'free_grant', 'refund', 'adjustment')),
  delta_paid          integer not null default 0,
  delta_free          integer not null default 0,
  balance_paid_after  integer not null check (balance_paid_after >= 0),
  balance_free_after  integer not null check (balance_free_after >= 0),
  invoice_id          uuid references public.invoices(id) on delete set null,
  stripe_purchase_id  uuid,
  note                text,
  created_at          timestamptz not null default now()
);

create index credit_ledger_user_created on public.credit_ledger (user_id, created_at desc);

alter table public.credit_ledger enable row level security;
