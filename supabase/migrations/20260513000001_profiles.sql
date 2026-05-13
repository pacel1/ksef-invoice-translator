create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  display_name text,
  locale       text not null default 'pl' check (locale in ('pl', 'en')),
  created_at   timestamptz not null default now()
);

comment on table public.profiles is 'One row per authenticated user; mirrors auth.users for app-level fields.';

alter table public.profiles enable row level security;
