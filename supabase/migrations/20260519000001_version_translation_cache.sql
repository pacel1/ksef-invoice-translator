alter table public.translations
  add column if not exists engine_version text;

update public.translations
set engine_version = case
  when used_ai then 'legacy-ai-v0'
  else 'legacy-passthrough-v0'
end
where engine_version is null;

alter table public.translations
  alter column engine_version set default 'free-text-v1:gpt-4.1-mini',
  alter column engine_version set not null;

alter table public.translations
  drop constraint if exists translations_invoice_id_language_bilingual_key;

alter table public.translations
  add constraint translations_invoice_id_language_bilingual_engine_version_key
  unique (invoice_id, language, bilingual, engine_version);
