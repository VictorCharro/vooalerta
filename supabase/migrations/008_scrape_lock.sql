-- ============================================================
-- VooAlerta — Migration 008: Fila (lock) para coleta no Google Flights
-- Rodar no Supabase: SQL Editor -> New Query -> Run
--
-- Varios cliques de refresh simultaneos abrem varios Chromium ao mesmo
-- tempo contra o Google Flights, que passa a nao responder / bloquear.
-- Essa tabela guarda um cadeado de linha unica: quem consegue avancar
-- google_busy_until pode raspar o Google; quem nao consegue pula o
-- Google e usa so a Maxmilhas, sem erro visivel pro usuario.
-- ============================================================

create table if not exists scrape_lock (
  id smallint primary key default 1,
  google_busy_until timestamptz not null default now(),
  constraint scrape_lock_single_row check (id = 1)
);

insert into scrape_lock (id, google_busy_until)
values (1, now())
on conflict (id) do nothing;

alter table scrape_lock enable row level security;
-- Sem policies publicas: so service_role (que ignora RLS) le/escreve.

grant select, update on public.scrape_lock to service_role;
