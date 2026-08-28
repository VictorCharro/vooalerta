-- ============================================================
-- VooAlerta — Migration 012: Grant DELETE em refresh_jobs
-- Rodar no Supabase: SQL Editor -> New Query -> Run
--
-- A migration 011 esqueceu de conceder DELETE pro service_role. O worker
-- usa DELETE pra limpar jobs done/error antigos (WORKER_JOB_STALE_MS).
-- ============================================================

grant delete on public.refresh_jobs to service_role;
