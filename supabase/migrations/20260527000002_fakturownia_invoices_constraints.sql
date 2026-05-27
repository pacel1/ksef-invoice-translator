-- Follow-up to 20260527000001_fakturownia_invoices: tighten the schema per
-- code review on commit 8613989.
--
-- 1. Enforce the kind/parent_id relationship in the schema instead of relying
--    on app code. A 'vat' faktura has no parent; a 'correction' (korekta)
--    must point at the faktura it corrects.
-- 2. Pin search_path on the updated_at trigger function to match repo
--    convention (every other plpgsql function sets search_path = public).
-- 3. Partial index on parent_id for future korekta-listing queries.

alter table public.fakturownia_invoices
  add constraint fakturownia_invoices_kind_parent_id_check
  check ((kind = 'vat' and parent_id is null)
         or (kind = 'correction' and parent_id is not null));

create or replace function public.touch_fakturownia_invoices_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create index fakturownia_invoices_parent_id
  on public.fakturownia_invoices (parent_id)
  where parent_id is not null;
