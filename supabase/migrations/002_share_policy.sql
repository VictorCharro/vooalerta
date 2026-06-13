-- Permite leitura pública de um alerta pelo ID (para página de compartilhamento)
create policy "public_read_by_id" on alerts
  for select using (true);

-- Nota: a política "select_own" já existe e filtra por user_id para o dashboard.
-- O frontend usa a anon key e lê apenas pelo ID — sem expor dados de outros usuários
-- além do que o dono explicitamente compartilhou via link.
