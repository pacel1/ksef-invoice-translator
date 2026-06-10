-- Sprint C (upload lane): pdf render counter + translate counters (per IP and global).
-- The global counter lives in the same table under the sentinel ip_hash '__global__'.

alter table public.demo_usage
  add column pdf_count integer not null default 0;

-- Atomically increment the daily translate counter for an IP hash AND the global
-- daily counter, returning both new values in one row.
create or replace function public.increment_demo_translate(p_ip_hash text)
returns table (ip_count integer, global_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip integer;
  v_global integer;
begin
  insert into public.demo_usage (ip_hash, day, translate_count)
  values (p_ip_hash, current_date, 1)
  on conflict (ip_hash, day)
  do update set translate_count = public.demo_usage.translate_count + 1
  returning translate_count into v_ip;

  insert into public.demo_usage (ip_hash, day, translate_count)
  values ('__global__', current_date, 1)
  on conflict (ip_hash, day)
  do update set translate_count = public.demo_usage.translate_count + 1
  returning translate_count into v_global;

  return query select v_ip, v_global;
end;
$$;

revoke all on function public.increment_demo_translate(text) from public, anon, authenticated;
grant execute on function public.increment_demo_translate(text) to service_role;

-- Atomically increment the daily pdf-render counter for an IP hash.
create or replace function public.increment_demo_pdf(p_ip_hash text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.demo_usage (ip_hash, day, pdf_count)
  values (p_ip_hash, current_date, 1)
  on conflict (ip_hash, day)
  do update set pdf_count = public.demo_usage.pdf_count + 1
  returning pdf_count into v_count;
  return v_count;
end;
$$;

revoke all on function public.increment_demo_pdf(text) from public, anon, authenticated;
grant execute on function public.increment_demo_pdf(text) to service_role;
