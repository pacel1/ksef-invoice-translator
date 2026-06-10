-- Per IP-hash daily counters for the public landing demo rate limit.
-- Written only by the service role; RLS denies anon/authenticated entirely.
create table public.demo_usage (
  ip_hash text not null,
  day date not null,
  translate_count integer not null default 0,
  unlock_count integer not null default 0,
  primary key (ip_hash, day)
);

alter table public.demo_usage enable row level security;
-- No policies: anon/authenticated get no access. The service-role key bypasses RLS.

comment on table public.demo_usage is
  'Per IP-hash daily counters for the public landing demo rate limit. Written only by the service role; stores no personal data beyond a salted IP hash.';

-- Atomically increment the daily unlock counter for an IP hash and return the new value.
create or replace function public.increment_demo_unlock(p_ip_hash text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.demo_usage (ip_hash, day, unlock_count)
  values (p_ip_hash, current_date, 1)
  on conflict (ip_hash, day)
  do update set unlock_count = public.demo_usage.unlock_count + 1
  returning unlock_count into v_count;
  return v_count;
end;
$$;

revoke all on function public.increment_demo_unlock(text) from public, anon, authenticated;
grant execute on function public.increment_demo_unlock(text) to service_role;
