-- ============================================================
-- VooAlerta — Migration 013: Ordem manual dos alertas (drag-and-drop)
-- Rodar no Supabase: SQL Editor -> New Query -> Run
--
-- Alertas sem "ordem" definida (null) continuam caindo por criado_em desc
-- (comportamento atual) - so passam a respeitar a ordem manual depois que
-- o usuario arrasta algum card pela primeira vez.
-- ============================================================

alter table public.alerts
  add column if not exists ordem integer;

-- Nenhuma policy nova necessaria: "update_own" (migration 001) ja cobre
-- qualquer coluna da linha do proprio usuario, incluindo "ordem".
