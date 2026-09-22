-- ============================================================
-- VooAlerta — Migration 018: historico de precos por rota (#149)
-- Rodar no Supabase: SQL Editor -> New Query -> Run
--
-- price_cache guarda so a foto do momento (salvarCache substitui as
-- linhas da rota a cada coleta), entao o historico se perdia. Esta
-- tabela e append-only: uma linha por coleta bem-sucedida, com o menor
-- preco observado e a fonte que venceu.
--
-- Volume e pequeno: o cron roda a cada 3h, entao sao ~8 linhas por rota
-- por dia. A granularidade fina permite derivar depois o minimo diario,
-- media movel, variacao percentual, etc.
-- ============================================================

create table if not exists price_history (
  id           uuid primary key default gen_random_uuid(),
  origem       char(3) not null,
  destino      char(3) not null,
  data_ida     date not null,
  data_volta   date,
  preco        numeric(10,2) not null,
  fonte        text,
  coletado_em  timestamptz not null default now()
);

create index if not exists idx_price_history_rota
  on price_history (origem, destino, data_ida, data_volta, coletado_em desc);

alter table price_history enable row level security;

-- Mesma politica do price_cache: preco e dado publico, leitura liberada,
-- escrita so via service_role (que ignora RLS).
create policy "price_history_select_public" on price_history
  for select using (true);

grant select, insert, delete on public.price_history to service_role;
