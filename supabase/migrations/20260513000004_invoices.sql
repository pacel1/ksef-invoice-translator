create table public.invoices (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  source_type    text not null check (source_type in ('xml', 'pdf')),
  source_hash    text not null,
  source_size    integer not null check (source_size >= 0),
  invoice_number text,
  issue_date     date,
  currency       text,
  total_gross    numeric(18, 2),
  source_data    jsonb not null,
  warnings       text[] not null default '{}',
  created_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create unique index invoices_user_hash_live
  on public.invoices (user_id, source_hash)
  where deleted_at is null;

create index invoices_user_created_at on public.invoices (user_id, created_at desc);

alter table public.invoices enable row level security;
