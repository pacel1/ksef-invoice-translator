-- Stripe → KSeF bridge: track every Fakturownia-issued faktura corresponding
-- to a Stripe purchase, plus korekty on refund. Fakturownia owns the legal
-- artifact; we own the link back to our payment row.

create table public.fakturownia_invoices (
  id                       uuid primary key default gen_random_uuid(),
  stripe_purchase_id       uuid not null references public.stripe_purchases(id) on delete cascade,
  kind                     text not null check (kind in ('vat', 'correction')),
  -- Self-reference for korekty pointing at the original faktura row.
  -- Null for `kind='vat'`; required for `kind='correction'`.
  parent_id                uuid references public.fakturownia_invoices(id) on delete set null,
  -- Fakturownia's own invoice id; null until first successful API response.
  fakturownia_id           text unique,
  -- KSeF state machine.
  gov_status               text not null default 'pending'
                           check (gov_status in ('pending', 'processing', 'ok', 'send_error', 'failed')),
  -- KSeF reference number; null until KSeF accepts the document.
  gov_id                   text,
  -- Fakturownia-rendered PDF link (signed URL with public access).
  pdf_url                  text,
  -- Last error message from a failed Fakturownia or KSeF call (for ops triage).
  last_error               text,
  -- Free-form attempt counter so the cron can back off / give up.
  attempt_count            integer not null default 0,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- A stripe purchase has at most ONE 'vat' faktura. Korekty are unbounded.
create unique index fakturownia_invoices_one_vat_per_purchase
  on public.fakturownia_invoices (stripe_purchase_id)
  where kind = 'vat';

-- Index for the cron scan: pick up pending and processing rows ordered by age.
create index fakturownia_invoices_cron_scan
  on public.fakturownia_invoices (gov_status, created_at)
  where gov_status in ('pending', 'processing', 'failed');

alter table public.fakturownia_invoices enable row level security;

-- Users can read their own faktura rows (joined via stripe_purchases.user_id).
create policy "fakturownia_invoices_select_own" on public.fakturownia_invoices
  for select to authenticated
  using (
    exists (
      select 1 from public.stripe_purchases sp
      where sp.id = fakturownia_invoices.stripe_purchase_id
        and sp.user_id = (select auth.uid())
    )
  );

-- Service role (webhook + cron) does writes; no insert/update/delete from authenticated.

-- Trigger to keep updated_at fresh.
create or replace function public.touch_fakturownia_invoices_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_fakturownia_invoices
  before update on public.fakturownia_invoices
  for each row execute function public.touch_fakturownia_invoices_updated_at();

-- Add business identity columns to stripe_purchases so the cron can build the
-- faktura without re-fetching from Stripe. Populated by the checkout-completed
-- webhook handler from Stripe's session.customer_details.
alter table public.stripe_purchases
  add column buyer_nip           text,
  add column buyer_eu_vat        text,
  add column buyer_business_name text,
  add column buyer_email         text,
  add column buyer_address_line1 text,
  add column buyer_address_line2 text,
  add column buyer_postal_code   text,
  add column buyer_city          text,
  add column buyer_country       text;

comment on table public.fakturownia_invoices is
  'Tracks Fakturownia-issued faktury and korekty for each Stripe purchase. KSeF state machine: pending -> processing -> ok | send_error | failed. The cron at /api/cron/poll-ksef drives state transitions.';
