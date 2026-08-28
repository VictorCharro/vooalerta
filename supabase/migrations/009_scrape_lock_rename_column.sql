-- ============================================================
-- VooAlerta — Migration 009: Corrige coluna do scrape_lock
-- Rodar no Supabase: SQL Editor -> New Query -> Run
--
-- A migration 008 original criou scrape_lock com a coluna
-- google_busy_until (lock so do Google). O codigo atual usa um lock
-- global de coleta (busy_until), entao essa migration renomeia a coluna
-- pra quem ja rodou a versao antiga. E um no-op seguro se a tabela ja
-- tiver sido criada com busy_until (versao nova do 008).
-- ============================================================

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'scrape_lock' and column_name = 'google_busy_until'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'scrape_lock' and column_name = 'busy_until'
  ) then
    alter table public.scrape_lock rename column google_busy_until to busy_until;
  end if;
end $$;

grant select, update on public.scrape_lock to service_role;
