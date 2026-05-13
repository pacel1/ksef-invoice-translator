create table public.translations (
  id              uuid primary key default gen_random_uuid(),
  invoice_id      uuid not null references public.invoices(id) on delete cascade,
  language        text not null,
  bilingual       boolean not null,
  translated_data jsonb not null,
  used_ai         boolean not null,
  created_at      timestamptz not null default now(),
  unique (invoice_id, language, bilingual)
);

create index translations_invoice on public.translations (invoice_id);

alter table public.translations enable row level security;
