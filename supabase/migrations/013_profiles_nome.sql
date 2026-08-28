-- ============================================================
-- VooAlerta — Migration 008: nome do usuario em profiles
-- Rodar no Supabase: SQL Editor -> New Query -> Run
--
-- Adiciona a coluna "nome" em profiles, usada na saudacao
-- "Ola, {nome}!" das telas de Voos e Onibus. O trigger de
-- criacao de perfil passa a gravar o nome informado no cadastro
-- (raw_user_meta_data->>'nome').
-- ============================================================

alter table profiles add column if not exists nome text;

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, whatsapp, nome)
  values (new.id, new.raw_user_meta_data->>'whatsapp', new.raw_user_meta_data->>'nome')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;
