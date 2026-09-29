const fs = require('fs');
const path = require('path');

const envDir = path.join(__dirname, '..', 'src', 'environments');
const files = ['environment.ts', 'environment.prod.ts'];

if (files.every(file => fs.existsSync(path.join(envDir, file)))) {
  process.exit(0);
}

if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
  require('./generate-env');
  process.exit(0);
}

console.error(`Configuração local do Supabase não encontrada.
Defina SUPABASE_URL e SUPABASE_KEY (chave pública anon/publishable) no PowerShell:

  $env:SUPABASE_URL = 'https://seu-projeto.supabase.co'
  $env:SUPABASE_KEY = 'sua-chave-publica'
  node scripts/generate-env.js
  npm start

Nunca use SUPABASE_SERVICE_KEY ou uma chave secret/service_role no frontend.`);
process.exit(1);
