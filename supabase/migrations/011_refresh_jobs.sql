-- ============================================================
-- VooAlerta — Migration 011: Fila de atualizacao de precos (refresh_jobs)
-- Rodar no Supabase: SQL Editor -> New Query -> Run
--
-- Substitui o lock por linha unica (scrape_lock) por uma fila de verdade:
-- o botao de atualizar so cria um job aqui; quem processa e um worker
-- separado (Render), sempre ligado, sem o limite de 60s da function da
-- Vercel. scrape_lock deixa de ser usado no codigo (pode ficar orfa no
-- banco, sem problema).
-- ============================================================

create table if not exists refresh_jobs (
  id            uuid primary key default gen_random_uuid(),
  origem        char(3) not null,
  destino       char(3) not null,
  data_ida      date not null,
  data_volta    date,
  status        text not null default 'pending' check (status in ('pending', 'processing', 'done', 'error')),
  preco         numeric(10,2),
  link          text,
  fontes        jsonb,
  warning       text,
  error         text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_refresh_jobs_status
  on refresh_jobs (status, criado_em);

create index if not exists idx_refresh_jobs_rota
  on refresh_jobs (origem, destino, data_ida, data_volta, status);

alter table refresh_jobs enable row level security;
-- Sem policies publicas: so service_role (que ignora RLS) le/escreve.
-- O frontend nunca fala direto com essa tabela, so via /api/scrape-flight
-- e /api/job-status, que rodam com a service_role key.

grant select, insert, update on public.refresh_jobs to service_role;
