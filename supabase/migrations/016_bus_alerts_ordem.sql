-- ============================================================
-- VooAlerta — Migration 016: Ordem manual dos alertas de ônibus
-- Rodar no Supabase: SQL Editor -> New Query -> Run
--
-- Mesmo padrão da migration 013 (alerts), agora pra bus_alerts, pra a
-- tela de Ônibus ganhar o mesmo drag-and-drop que a de Voos.
-- ============================================================

alter table public.bus_alerts
  add column if not exists ordem integer;

-- Nenhuma policy nova necessaria: "bus_update_own" (migration 004) ja
-- cobre qualquer coluna da linha do proprio usuario, incluindo "ordem".
