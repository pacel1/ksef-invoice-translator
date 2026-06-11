-- Per IP-hash daily counter for the public contact-form rate limit.
-- Written only by the service role; RLS denies anon/authenticated entirely.
-- Mirrors the demo_usage pattern (20260610073405_demo_usage.sql).
create table public.contact_usage (
  ip_hash text not null,
  day date not null,
  message_count integer not null default 0,
  primary key (ip_hash, day)
);

alter table public.contact_usage enable row level security;
-- No policies: anon/authenticated get no access. The service-role key bypasses RLS.

comment on table public.contact_usage is
  'Per IP-hash daily counter for the public contact-form rate limit. Written only by the service role; stores no personal data beyond a salted IP hash.';

-- Atomically increment the daily contact-message counter for an IP hash AND the
-- global daily counter, returning both new values in one row. The global counter
-- is the daily circuit breaker bounding worst-case email spend (forwarded-for
-- headers are client-influenced, so per-IP caps alone are best effort).
-- Mirrors increment_demo_translate (20260610092354_demo_translate_pdf_counters.sql).
create or replace function public.increment_contact_message(p_ip_hash text)
returns table (ip_count integer, global_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip integer;
  v_global integer;
begin
  insert into public.contact_usage (ip_hash, day, message_count)
  values (p_ip_hash, current_date, 1)
  on conflict (ip_hash, day)
  do update set message_count = public.contact_usage.message_count + 1
  returning message_count into v_ip;

  insert into public.contact_usage (ip_hash, day, message_count)
  values ('__global__', current_date, 1)
  on conflict (ip_hash, day)
  do update set message_count = public.contact_usage.message_count + 1
  returning message_count into v_global;

  return query select v_ip, v_global;
end;
$$;

revoke all on function public.increment_contact_message(text) from public, anon, authenticated;
grant execute on function public.increment_contact_message(text) to service_role;
