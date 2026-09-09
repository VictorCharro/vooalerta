-- ============================================================
-- VooAlerta — Migration 002: Cache de preços
-- Rodar no Supabase: SQL Editor -> New Query -> Run
--
-- O comentario original aqui dizia "ja incluido no 001_initial_schema.sql",
-- mas isso e falso - a funcao nao esta no 001. Migration 014 recria essa
-- funcao de forma idempotente (create or replace), entao rodar essa 002
-- agora ou nao faz diferenca se a 014 ja foi aplicada.
-- ============================================================

-- Para limpar cache antigo (rodar manualmente ou via cron no Supabase)
create or replace function limpar_cache_antigo()
returns void as $$
  delete from price_cache
  where atualizado_em < now() - interval '24 hours';
$$ language sql;
