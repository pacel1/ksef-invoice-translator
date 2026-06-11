-- Index the ksef_invoices -> stripe_purchases foreign key. It is filtered on
-- directly by the webhook (charge.refunded korekta lookup) and the cron, and is
-- joined in the ksef_invoices RLS SELECT policy, but only a partial unique index
-- (where kind='vat') covered it -- correction rows and the policy join did
-- sequential scans. A plain b-tree on the FK fixes that.
create index if not exists ksef_invoices_stripe_purchase_id
  on public.ksef_invoices (stripe_purchase_id);
