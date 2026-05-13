-- 1. Cover the two foreign keys on credit_ledger to avoid sequential scans
--    when invoices/stripe_purchases are deleted/updated.
create index if not exists credit_ledger_invoice_id on public.credit_ledger (invoice_id);
create index if not exists credit_ledger_stripe_purchase_id on public.credit_ledger (stripe_purchase_id);

-- 2. Wrap auth.uid() in (select ...) so Postgres evaluates it once per query
--    instead of once per row. Recreate each policy.

-- profiles
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own" on public.profiles
  for select using ((select auth.uid()) = id);

create policy "profiles_update_own" on public.profiles
  for update using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- credit_balances
drop policy if exists "credit_balances_select_own" on public.credit_balances;

create policy "credit_balances_select_own" on public.credit_balances
  for select using ((select auth.uid()) = user_id);

-- invoices
drop policy if exists "invoices_select_own" on public.invoices;
drop policy if exists "invoices_insert_own" on public.invoices;
drop policy if exists "invoices_update_own" on public.invoices;
drop policy if exists "invoices_delete_own" on public.invoices;

create policy "invoices_select_own" on public.invoices
  for select using ((select auth.uid()) = user_id);

create policy "invoices_insert_own" on public.invoices
  for insert with check ((select auth.uid()) = user_id);

create policy "invoices_update_own" on public.invoices
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "invoices_delete_own" on public.invoices
  for delete using ((select auth.uid()) = user_id);

-- translations
drop policy if exists "translations_select_own" on public.translations;
drop policy if exists "translations_insert_own" on public.translations;
drop policy if exists "translations_update_own" on public.translations;
drop policy if exists "translations_delete_own" on public.translations;

create policy "translations_select_own" on public.translations
  for select using (
    exists (
      select 1 from public.invoices i
      where i.id = translations.invoice_id and i.user_id = (select auth.uid())
    )
  );

create policy "translations_insert_own" on public.translations
  for insert with check (
    exists (
      select 1 from public.invoices i
      where i.id = translations.invoice_id and i.user_id = (select auth.uid())
    )
  );

create policy "translations_update_own" on public.translations
  for update using (
    exists (
      select 1 from public.invoices i
      where i.id = translations.invoice_id and i.user_id = (select auth.uid())
    )
  );

create policy "translations_delete_own" on public.translations
  for delete using (
    exists (
      select 1 from public.invoices i
      where i.id = translations.invoice_id and i.user_id = (select auth.uid())
    )
  );

-- credit_ledger
drop policy if exists "credit_ledger_select_own" on public.credit_ledger;

create policy "credit_ledger_select_own" on public.credit_ledger
  for select using ((select auth.uid()) = user_id);

-- stripe_purchases
drop policy if exists "stripe_purchases_select_own" on public.stripe_purchases;

create policy "stripe_purchases_select_own" on public.stripe_purchases
  for select using ((select auth.uid()) = user_id);
