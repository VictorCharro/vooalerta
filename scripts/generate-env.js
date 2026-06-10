// Gera os arquivos de environment a partir das variáveis de ambiente
// Usado no build do Vercel (SUPABASE_URL e SUPABASE_KEY devem estar configurados)

const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL e SUPABASE_KEY são obrigatórios');
  process.exit(1);
}

const envDir = path.join(__dirname, '..', 'src', 'environments');
fs.mkdirSync(envDir, { recursive: true });

const content = `export const environment = {
  production: true,
  supabaseUrl: '${supabaseUrl}',
  supabaseKey: '${supabaseKey}'
};
`;

fs.writeFileSync(path.join(envDir, 'environment.ts'), content);
fs.writeFileSync(path.join(envDir, 'environment.prod.ts'), content);

console.log('✅ environment.ts gerado com sucesso');
