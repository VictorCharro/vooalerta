-- ============================================================
-- VooAlerta — Migration 007: RLS no cache de precos
-- Rodar no Supabase: SQL Editor -> New Query -> Run
--
-- price_cache e bus_price_cache guardavam dados publicos de preco
-- sem RLS habilitada: qualquer holder da anon key podia ler E
-- escrever/apagar essas tabelas direto pela API REST do Supabase.
-- service_role (usado pelo backend/monitor) ignora RLS, entao os
-- jobs de scraping continuam funcionando normalmente.
-- ============================================================

alter table price_cache enable row level security;

create policy "price_cache_select_public" on price_cache
  for select using (true);

alter table bus_price_cache enable row level security;

create policy "bus_price_cache_select_public" on bus_price_cache
  for select using (true);
