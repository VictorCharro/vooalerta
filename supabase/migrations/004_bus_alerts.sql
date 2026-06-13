-- ============================================================
-- VooAlerta — Migration 004: Alertas de Ônibus (Buser)
-- Rodar no Supabase: SQL Editor → New Query → Run
-- ============================================================

-- 1. Alertas de ônibus
create table if not exists bus_alerts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  origem        text not null,           -- nome legível, ex: "Franca"
  origem_slug   text not null,           -- ex: "franca-sp"
  destino       text not null,           -- nome legível, ex: "São Paulo"
  destino_slug  text not null,           -- ex: "sao-paulo-sp"
  data_ida      date not null,
  data_volta    date,
  meta          numeric(10,2) not null check (meta > 0),
  whatsapp      text not null,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now()
);

alter table bus_alerts enable row level security;

create policy "bus_select_own" on bus_alerts for select using (auth.uid() = user_id);
create policy "bus_insert_own" on bus_alerts for insert with check (auth.uid() = user_id);
create policy "bus_update_own" on bus_alerts for update using (auth.uid() = user_id);
create policy "bus_delete_own" on bus_alerts for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.bus_alerts to authenticated;

create index if not exists idx_bus_alerts_user   on bus_alerts(user_id);
create index if not exists idx_bus_alerts_ativo  on bus_alerts(ativo) where ativo = true;

-- 2. Cache de preços de ônibus
create table if not exists bus_price_cache (
  id            uuid primary key default gen_random_uuid(),
  origem_slug   text not null,
  destino_slug  text not null,
  data_ida      date not null,
  data_volta    date,
  preco         numeric(10,2),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_bus_cache_rota
  on bus_price_cache (origem_slug, destino_slug, data_ida);

create index if not exists idx_bus_cache_atualizado
  on bus_price_cache (atualizado_em);

-- 3. Notificações de ônibus (anti-spam)
create table if not exists bus_notifications (
  id          uuid primary key default gen_random_uuid(),
  alert_id    uuid references bus_alerts(id) on delete cascade not null,
  user_id     uuid references auth.users(id) on delete cascade not null,
  preco       numeric(10,2),
  enviado_em  timestamptz not null default now()
);

create index if not exists idx_bus_notif_alert
  on bus_notifications (alert_id, enviado_em desc);

alter table bus_notifications enable row level security;
create policy "bus_select_own_notif" on bus_notifications for select using (auth.uid() = user_id);
grant select on public.bus_notifications to authenticated;

-- 4. View para o monitor — alertas ativos com join no perfil
create or replace view bus_alerts_ativos as
  select
    a.id,
    a.user_id,
    a.origem,
    a.origem_slug,
    a.destino,
    a.destino_slug,
    a.data_ida::text  as data_ida,
    a.data_volta::text as data_volta,
    a.meta,
    a.whatsapp,
    p.callmebot_key
  from bus_alerts a
  join profiles p on p.id = a.user_id
  where a.ativo = true
    and a.data_ida >= current_date;

-- 5. View de rotas únicas de ônibus
create or replace view bus_rotas_unicas as
  select distinct
    origem_slug,
    destino_slug,
    data_ida::text  as data_ida,
    data_volta::text as data_volta
  from bus_alerts
  where ativo = true
    and data_ida >= current_date;
