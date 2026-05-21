-- Drop the (user_id, source_hash) live unique index on invoices so a
-- user can upload the same file multiple times. Each upload now creates
-- its own invoice row with its own translation row(s), shows up as a
-- distinct entry in history with its own timestamp, and consumes credit
-- on the translate step (no cross-row translation cache).
--
-- Companion change in code: lib/invoice/upload-service.ts stops the
-- early-return dedupe lookup and always inserts. The pre-upload
-- "Already uploaded" warning is now computed from a COUNT of OTHER
-- rows with the same source_hash for the user (see
-- app/api/upload-batch/route.ts), so the user is still warned before
-- clicking Dalej — they're just no longer prevented from creating a
-- new row.

drop index if exists public.invoices_user_hash_live;
create index invoices_user_hash on public.invoices (user_id, source_hash) where deleted_at is null;
