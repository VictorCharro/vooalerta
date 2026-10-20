-- ============================================================
-- VooAlerta - Migration 019: Rotas favoritas
-- Rodar no Supabase: SQL Editor -> New Query -> Run
--
-- Um alerta morre quando a data de ida passa (o card vira "Viagem
-- realizada"), mas a rota continua valendo - e hoje o usuario tem que
-- redigitar origem, destino, meta, horario e so-direto na mao pra
-- monitorar a mesma viagem de novo. Esta tabela guarda a rota SEM as
-- datas, pra recriar o alerta num clique no modal "Novo alerta".
--
-- Serve pros dois tipos de alerta:
--   tipo = 'voo'    -> origem/destino sao IATA (GRU, POA) e os slugs
--                      repetem o IATA em minusculo
--   tipo = 'onibus' -> origem/destino sao o nome legivel ("Franca") e os
--                      slugs sao os da Buser ("franca-sp")
-- Os slugs sao a chave de identidade: "Franca-SP" e "Franca-MG" tem o
-- mesmo nome legivel e precisam poder coexistir.
-- ============================================================

create table if not exists favorite_routes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade not null,
  tipo           text not null check (tipo in ('voo', 'onibus')),
  origem         text not null,           -- rotulo exibido: "GRU" ou "Franca"
  destino        text not null,
  origem_slug    text not null,           -- identidade: "gru" ou "franca-sp"
  destino_slug   text not null,
  meta           numeric(10,2) check (meta is null or meta > 0),
  horario_minimo time,                    -- so voos; null = qualquer
  so_direto      boolean not null default false,  -- so voos
  criado_em      timestamptz not null default now()
);

-- Favoritar a mesma rota de novo nao duplica: o upsert do front cai aqui
-- e atualiza a meta/horario com os do alerta mais recente.
create unique index if not exists idx_favorite_routes_unica
  on favorite_routes (user_id, tipo, origem_slug, destino_slug);

create index if not exists idx_favorite_routes_user
  on favorite_routes (user_id, tipo);

alter table favorite_routes enable row level security;

create policy "fav_select_own" on favorite_routes for select using (auth.uid() = user_id);
create policy "fav_insert_own" on favorite_routes for insert with check (auth.uid() = user_id);
create policy "fav_update_own" on favorite_routes for update using (auth.uid() = user_id);
create policy "fav_delete_own" on favorite_routes for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.favorite_routes to authenticated;
