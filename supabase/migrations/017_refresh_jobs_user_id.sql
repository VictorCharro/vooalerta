-- ============================================================
-- VooAlerta — Migration 017: dono do job em refresh_jobs (#134)
-- Rodar no Supabase: SQL Editor -> New Query -> Run
--
-- /api/job-status exigia login, mas buscava o job so por id: qualquer
-- usuario autenticado que tivesse um job_id conseguia ler o resultado
-- daquele job (rota, preco, link). A tabela nao tinha como saber de quem
-- era o job. Com user_id preenchido em /api/scrape-flight, a consulta
-- passa a filtrar tambem pelo dono.
--
-- Jobs antigos ficam com user_id null e simplesmente deixam de ser
-- retornados - eles duram minutos (o worker limpa os concluidos), entao
-- nao ha nada relevante pra migrar.
-- ============================================================

alter table public.refresh_jobs
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists idx_refresh_jobs_user
  on public.refresh_jobs (user_id, status);
