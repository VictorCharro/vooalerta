-- ============================================================
-- VooAlerta - Migration 006: reforca grants do cache de voos
-- Necessario para a Vercel Function /api/scrape-flight substituir
-- registros em price_cache usando SUPABASE_SERVICE_KEY.
-- ============================================================

grant usage on schema public to service_role;

grant select, insert, update, delete on public.price_cache to service_role;
grant select, insert, update, delete on public.alerts to service_role;
grant select, insert, update, delete on public.notifications to service_role;

grant select on public.alerts_ativos to service_role;
grant select on public.rotas_unicas to service_role;
