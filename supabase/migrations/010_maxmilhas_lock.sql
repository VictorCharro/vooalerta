-- ============================================================
-- VooAlerta — Migration 010: Lock separado pra Maxmilhas
-- Rodar no Supabase: SQL Editor -> New Query -> Run
--
-- O lock global (migration 008/009) bloqueava a Maxmilhas junto com o
-- Google, mesmo ela sendo rapida e raramente instavel. Agora cada fonte
-- tem seu proprio cadeado: busy_until continua sendo o do Google,
-- maxmilhas_busy_until e o novo, so da Maxmilhas.
-- ============================================================

alter table public.scrape_lock
  add column if not exists maxmilhas_busy_until timestamptz not null default now();

grant select, update on public.scrape_lock to service_role;
