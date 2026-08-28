-- ============================================================
-- VooAlerta — Migration 008: Fila (lock) para coleta de precos
-- Rodar no Supabase: SQL Editor -> New Query -> Run
--
-- Varios cliques de refresh simultaneos abrem varios Chromium ao mesmo
-- tempo (Google Flights e Maxmilhas), o que pode derrubar a function na
-- Vercel inteira por timeout/memoria, nao so falhar uma fonte. Essa tabela
-- guarda um cadeado de linha unica: so uma coleta completa roda por vez.
-- Quem nao consegue o lock nao abre navegador nenhum — recebe na hora o
-- ultimo preco em cache pra rota, sem erro tecnico visivel pro usuario.
-- ============================================================

create table if not exists scrape_lock (
  id smallint primary key default 1,
  busy_until timestamptz not null default now(),
  constraint scrape_lock_single_row check (id = 1)
);

insert into scrape_lock (id, busy_until)
values (1, now())
on conflict (id) do nothing;

alter table scrape_lock enable row level security;
-- Sem policies publicas: so service_role (que ignora RLS) le/escreve.

grant select, update on public.scrape_lock to service_role;
