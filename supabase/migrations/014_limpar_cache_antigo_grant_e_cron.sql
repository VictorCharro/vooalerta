-- ============================================================
-- VooAlerta — Migration 014: Agendar limpeza do price_cache (#140)
-- Rodar no Supabase: SQL Editor -> New Query -> Run
--
-- limpar_cache_antigo() (migration 002) existia mas nunca era chamada -
-- price_cache so era limpo de datas de viagem que ja passaram
-- (backend/monitor.js), entao rotas com data futura acumulavam linhas
-- pra sempre a cada coleta. Essa migration garante o grant explicito pra
-- service_role chamar a funcao via RPC (/rest/v1/rpc/limpar_cache_antigo)
-- e tenta agendar via pg_cron, se a extensao estiver disponivel no
-- projeto. O acionamento garantido, sem depender de pg_cron, e o
-- monitor.js chamando o RPC ao final de cada execucao (ja agendado via
-- GitHub Actions).
-- ============================================================

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
