-- ============================================================
-- VooAlerta — Migration 005: Grants para service_role (monitor backend)
-- Rodar no Supabase: SQL Editor → New Query → Run
-- ============================================================

-- Tabelas de ônibus
grant select, insert, update, delete on public.bus_alerts        to service_role;
grant select, insert, update, delete on public.bus_price_cache   to service_role;
grant select, insert, update, delete on public.bus_notifications to service_role;

-- Views de ônibus
grant select on public.bus_alerts_ativos  to service_role;
grant select on public.bus_rotas_unicas   to service_role;

-- Tabelas de voo (garantia)
grant select, insert, update, delete on public.alerts            to service_role;
grant select, insert, update, delete on public.price_cache       to service_role;
grant select, insert, update, delete on public.notifications     to service_role;
grant select on public.alerts_ativos                             to service_role;
grant select on public.rotas_unicas                              to service_role;
