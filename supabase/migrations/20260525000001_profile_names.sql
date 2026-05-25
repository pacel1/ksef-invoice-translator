-- Capture first/last name on profiles so PDF "Zweryfikowane przez …"
-- can show a human name (an MF requirement for accepted translated
-- documents). The optional `display_name` stays for backward compat —
-- it's the soft fallback in the renderer until the user fills both
-- name parts.

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name  text;

comment on column public.profiles.first_name is
  'Verifier first name shown on translated documents (MF requirement).';
comment on column public.profiles.last_name is
  'Verifier last name shown on translated documents (MF requirement).';
