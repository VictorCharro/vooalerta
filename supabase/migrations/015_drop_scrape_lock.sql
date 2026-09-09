-- ============================================================
-- VooAlerta — Migration 015: Remove a tabela orfa scrape_lock (#142)
-- Rodar no Supabase: SQL Editor -> New Query -> Run
--
-- scrape_lock foi criada nas migrations 008/009/010 pra travar coletas
-- simultaneas. Foi substituida pela fila de verdade em refresh_jobs
-- (migration 011) - o codigo do lock (tentarAdquirirLock, liberarLock,
-- adquirirLockComEspera) ja foi removido de backend/flight_scraper.js.
-- A tabela ficou orfa no banco desde entao; migrations 008/009/010
-- passam a ser historicas/obsoletas.
-- ============================================================

drop table if exists public.scrape_lock;
