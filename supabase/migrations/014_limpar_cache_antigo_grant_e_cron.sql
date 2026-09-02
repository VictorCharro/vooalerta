-- ============================================================
-- VooAlerta — Migration 014: Agendar limpeza do price_cache (#140)
-- Rodar no Supabase: SQL Editor -> New Query -> Run
--
-- A migration 002 tinha o comentario "ja incluido no 001_initial_schema.sql",
-- mas a funcao nunca foi criada de fato (nao esta no 001) - so existia o
-- arquivo de referencia. Essa migration cria (create or replace, idempotente)
-- limpar_cache_antigo(), da o grant explicito pra service_role chamar via
-- RPC (/rest/v1/rpc/limpar_cache_antigo) e tenta agendar via pg_cron, se a
-- extensao estiver disponivel no projeto. O acionamento garantido, sem
-- depender de pg_cron, e o monitor.js chamando o RPC ao final de cada
-- execucao (ja agendado via GitHub Actions).
-- ============================================================

create or replace function public.limpar_cache_antigo()
returns void as $$
  delete from price_cache
  where atualizado_em < now() - interval '24 hours';
$$ language sql;

grant execute on function public.limpar_cache_antigo() to service_role;

do $$
begin
  create extension if not exists pg_cron;

  perform cron.schedule(
    'limpar_price_cache_antigo',
    '0 * * * *', -- a cada hora
    $cron$select public.limpar_cache_antigo();$cron$
  );
exception when others then
  -- pg_cron pode nao estar disponivel/habilitado no plano do projeto.
  -- Nao e bloqueante: monitor.js chama o mesmo RPC ao final de cada rodada.
  raise notice 'pg_cron indisponivel, seguindo so com a chamada do monitor.js: %', sqlerrm;
end $$;
