-- Migrate the KSeF bridge from Fakturownia to iFirma. The table is empty
-- (nothing issued yet — KSEF_LIVE was never flipped), so we drop the old
-- provider-named table and recreate it provider-neutral. The dependent
-- trigger/policy/indexes drop with CASCADE; the updated_at function is
-- dropped explicitly (functions aren't owned by the table).

drop table if exists public.fakturownia_invoices cascade;
drop function if exists public.touch_fakturownia_invoices_updated_at() cascade;

create table public.ksef_invoices (
  id                   uuid primary key default gen_random_uuid(),
  stripe_purchase_id   uuid not null references public.stripe_purchases(id) on delete cascade,
  kind                 text not null check (kind in ('vat', 'correction')),
  parent_id            uuid references public.ksef_invoices(id) on delete set null,
  -- The provider's own invoice id (iFirma `Identyfikator`); null until the
  -- create call succeeds.
  provider_invoice_id  text unique,
  gov_status           text not null default 'pending'
                       check (gov_status in ('pending', 'processing', 'ok', 'send_error', 'failed')),
  gov_id               text,
  pdf_url              text,
  last_error           text,
  attempt_count        integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- A korekta must reference a parent; a vat invoice must not (carried over
  -- from the 20260527000002 constraints migration).
  constraint ksef_invoices_kind_parent_chk
    check ((kind = 'vat' and parent_id is null) or (kind = 'correction' and parent_id is not null))
);

create unique index ksef_invoices_one_vat_per_purchase
  on public.ksef_invoices (stripe_purchase_id)
  where kind = 'vat';

create index ksef_invoices_cron_scan
  on public.ksef_invoices (gov_status, created_at)
  where gov_status in ('pending', 'processing', 'failed');

create index ksef_invoices_parent_id
  on public.ksef_invoices (parent_id)
  where parent_id is not null;

alter table public.ksef_invoices enable row level security;

create policy "ksef_invoices_select_own" on public.ksef_invoices
  for select to authenticated
  using (
    exists (
      select 1 from public.stripe_purchases sp
      where sp.id = ksef_invoices.stripe_purchase_id
        and sp.user_id = (select auth.uid())
    )
  );

create or replace function public.touch_ksef_invoices_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_ksef_invoices
  before update on public.ksef_invoices
  for each row execute function public.touch_ksef_invoices_updated_at();

comment on table public.ksef_invoices is
  'Tracks provider-issued faktury and korekty for each Stripe purchase. Provider-neutral (currently iFirma). KSeF state machine: pending -> processing -> ok | send_error | failed. Driven by /api/cron/poll-ksef.';
