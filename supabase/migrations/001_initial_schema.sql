-- ============================================================
-- VooAlerta — Schema completo
-- Rodar no Supabase: SQL Editor → New Query → Run
-- ============================================================

-- 1. Tabela de alertas
create table if not exists alerts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  origem          char(3) not null,
  destino         char(3) not null,
  data_ida        date not null,
  data_volta      date,
  meta            numeric(10,2) not null check (meta > 0),
  horario_minimo  time,           -- ex: 17:00 — null = qualquer horário
  so_direto       boolean not null default false,
  whatsapp        text not null,
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now()
);

-- RLS
alter table alerts enable row level security;

create policy "select_own" on alerts for select using (auth.uid() = user_id);
create policy "insert_own" on alerts for insert with check (auth.uid() = user_id);
create policy "update_own" on alerts for update using (auth.uid() = user_id);
create policy "delete_own" on alerts for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.alerts to authenticated;

-- 2. Cache de preços — salva todos os voos de uma rota
create table if not exists price_cache (
  id              uuid primary key default gen_random_uuid(),
  origem          char(3) not null,
  destino         char(3) not null,
  data_ida        date not null,
  data_volta      date,
  companhia       text,
  preco           numeric(10,2),
  horario_partida time,
  horario_chegada time,
  duracao_min     int,
  escalas         smallint default 0,
  link            text,
  atualizado_em   timestamptz not null default now()
);

create index if not exists idx_price_cache_rota
  on price_cache (origem, destino, data_ida);

create index if not exists idx_price_cache_atualizado
  on price_cache (atualizado_em);

-- 3. Notificações enviadas — controla intervalo de 6h anti-spam
create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  alert_id    uuid references alerts(id) on delete cascade not null,
  user_id     uuid references auth.users(id) on delete cascade not null,
  preco       numeric(10,2),
  enviado_em  timestamptz not null default now()
);

create index if not exists idx_notifications_alert
  on notifications (alert_id, enviado_em desc);

-- RLS notifications
alter table notifications enable row level security;
create policy "select_own_notifications" on notifications for select using (auth.uid() = user_id);
grant select on public.notifications to authenticated;

-- 4. View para o n8n — alertas ativos com data futura
create or replace view alerts_ativos as
  select
    a.id,
    a.user_id,
    a.origem,
    a.destino,
    a.data_ida::text    as data_ida,
    a.data_volta::text  as data_volta,
    a.meta,
    a.horario_minimo::text as horario_minimo,
    a.so_direto,
    a.whatsapp
  from alerts a
  where a.ativo = true
    and a.data_ida >= current_date;

-- 5. View de rotas únicas — o n8n busca uma vez por rota
create or replace view rotas_unicas as
  select distinct
    a.origem,
    a.destino,
    a.data_ida::text   as data_ida,
    a.data_volta::text as data_volta
  from alerts a
  where a.ativo = true
    and a.data_ida >= current_date;

-- 6. Indexes de performance
create index if not exists idx_alerts_user_id on alerts(user_id);
create index if not exists idx_alerts_ativo   on alerts(ativo) where ativo = true;
