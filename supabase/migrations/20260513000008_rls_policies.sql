-- profiles
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

-- credit_balances: read own; no writes (service-definer fns only)
create policy "credit_balances_select_own" on public.credit_balances
  for select using (auth.uid() = user_id);

-- invoices
create policy "invoices_select_own" on public.invoices
  for select using (auth.uid() = user_id);

create policy "invoices_insert_own" on public.invoices
  for insert with check (auth.uid() = user_id);

create policy "invoices_update_own" on public.invoices
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "invoices_delete_own" on public.invoices
  for delete using (auth.uid() = user_id);

-- translations: access via invoice ownership
create policy "translations_select_own" on public.translations
  for select using (
    exists (
      select 1 from public.invoices i
      where i.id = translations.invoice_id and i.user_id = auth.uid()
    )
  );

create policy "translations_insert_own" on public.translations
  for insert with check (
    exists (
      select 1 from public.invoices i
      where i.id = translations.invoice_id and i.user_id = auth.uid()
    )
  );

create policy "translations_update_own" on public.translations
  for update using (
    exists (
      select 1 from public.invoices i
      where i.id = translations.invoice_id and i.user_id = auth.uid()
    )
  );

create policy "translations_delete_own" on public.translations
  for delete using (
    exists (
      select 1 from public.invoices i
      where i.id = translations.invoice_id and i.user_id = auth.uid()
    )
  );

-- credit_ledger and stripe_purchases: read-own, no writes
create policy "credit_ledger_select_own" on public.credit_ledger
  for select using (auth.uid() = user_id);

create policy "stripe_purchases_select_own" on public.stripe_purchases
  for select using (auth.uid() = user_id);
