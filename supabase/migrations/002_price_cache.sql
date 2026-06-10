-- ============================================================
-- VooAlerta — Migration 002: Cache de preços
-- Já incluído no 001_initial_schema.sql
-- Este arquivo existe para referência e rollback se necessário
-- ============================================================

-- Para limpar cache antigo (rodar manualmente ou via cron no Supabase)
create or replace function limpar_cache_antigo()
returns void as $$
  delete from price_cache
  where atualizado_em < now() - interval '24 hours';
$$ language sql;
