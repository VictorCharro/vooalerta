-- ============================================================
-- VooAlerta — Migration 003
-- Cria tabela profiles e corrige view alerts_ativos
-- ============================================================

-- 1. Tabela profiles
create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  whatsapp      text,
  callmebot_key text,
  criado_em     timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "select_own_profile" on profiles for select using (auth.uid() = id);
create policy "insert_own_profile" on profiles for insert with check (auth.uid() = id);
create policy "update_own_profile" on profiles for update using (auth.uid() = id);

grant select, insert, update on public.profiles to authenticated;

-- 2. Trigger para criar perfil automaticamente ao cadastrar usuário
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, whatsapp)
  values (new.id, new.raw_user_meta_data->>'whatsapp')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 3. Corrige view alerts_ativos para incluir callmebot_key via join com profiles
create or replace view alerts_ativos as
  select
    a.id,
    a.user_id,
    a.origem,
    a.destino,
    a.data_ida::text       as data_ida,
    a.data_volta::text     as data_volta,
    a.meta,
    a.horario_minimo::text as horario_minimo,
    a.so_direto,
    a.whatsapp,
    p.callmebot_key
  from alerts a
  join profiles p on p.id = a.user_id
  where a.ativo = true
    and a.data_ida >= current_date;
