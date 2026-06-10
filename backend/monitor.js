// =============================================================
// VooAlerta — Monitor de Passagens
// Roda via GitHub Actions a cada hora
// =============================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SERPAPI_KEY  = process.env.SERPAPI_KEY;
const CALLMEBOT_KEY = process.env.CALLMEBOT_KEY;

// ── Helpers ───────────────────────────────────────────────────

async function supabase(method, path, body = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'resolution=merge-duplicates' : ''
    },
    body: body ? JSON.stringify(body) : null
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase ${method} ${path} → ${res.status}: ${err}`);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

async function sendWhatsApp(phone, message) {
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}&apikey=${CALLMEBOT_KEY}`;
  const res = await fetch(url);
  return res.ok;
}

async function buscarSerpapi(origem, destino, dataIda, dataVolta) {
  const params = new URLSearchParams({
    engine: 'google_flights',
    departure_id: origem,
    arrival_id: destino,
    outbound_date: dataIda,
    currency: 'BRL',
    hl: 'pt',
    api_key: SERPAPI_KEY
  });

  if (dataVolta) params.set('return_date', dataVolta);

  const res = await fetch(`https://serpapi.com/search?${params}`);
  if (!res.ok) throw new Error(`Serpapi erro: ${res.status}`);
  return res.json();
}

// ── Lógica principal ──────────────────────────────────────────

async function processarRota(rota) {
  const { origem, destino, data_ida, data_volta } = rota;
  console.log(`\n📍 Processando rota: ${origem} → ${destino} | ${data_ida}`);

  // 1. Verifica se cache é recente (menos de 6h)
  const seisHorasAtras = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const cacheRecente = await supabase(
    'GET',
    `price_cache?origem=eq.${origem}&destino=eq.${destino}&data_ida=eq.${data_ida}&atualizado_em=gte.${seisHorasAtras}&limit=1`
  );

  if (cacheRecente.length === 0) {
    // Cache desatualizado — busca no Serpapi
    console.log(`  🔍 Cache desatualizado — buscando no Serpapi...`);

    try {
      const resultado = await buscarSerpapi(origem, destino, data_ida, data_volta);
      const voos = [
        ...(resultado.best_flights ?? []),
        ...(resultado.other_flights ?? [])
      ];

      console.log(`  ✈ ${voos.length} voos encontrados`);

      const agora = new Date().toISOString();

      // Salva cada voo no cache
      for (const v of voos) {
        const voo = v.flights?.[0] ?? {};
        const partida = voo.departure_airport?.time;
        const chegada = voo.arrival_airport?.time;

        const registro = {
          origem,
          destino,
          data_ida,
          data_volta: data_volta || null,
          companhia: v.airline ?? voo.airline ?? null,
          preco: v.price ?? null,
          horario_partida: partida ? new Date(partida).toTimeString().slice(0, 5) : null,
          horario_chegada: chegada ? new Date(chegada).toTimeString().slice(0, 5) : null,
          duracao_min: v.total_duration ?? null,
          escalas: (v.flights?.length ?? 1) - 1,
          link: v.booking_token ?? null,
          atualizado_em: agora
        };

        await supabase('POST', 'price_cache', registro);
      }

      console.log(`  💾 Cache atualizado com ${voos.length} voos`);
    } catch (err) {
      console.error(`  ❌ Erro no Serpapi: ${err.message}`);
      return;
    }
  } else {
    console.log(`  ✅ Cache recente — usando dados existentes`);
  }

  // 2. Busca alertas ativos para esta rota
  const alertas = await supabase(
    'GET',
    `alerts_ativos?origem=eq.${origem}&destino=eq.${destino}&data_ida=eq.${data_ida}`
  );

  console.log(`  👥 ${alertas.length} alerta(s) para esta rota`);

  // 3. Busca voos do cache para esta rota
  const voosCache = await supabase(
    'GET',
    `price_cache?origem=eq.${origem}&destino=eq.${destino}&data_ida=eq.${data_ida}&order=preco.asc`
  );

  // 4. Processa cada alerta
  for (const alerta of alertas) {
    await processarAlerta(alerta, voosCache);
  }
}

async function processarAlerta(alerta, voosCache) {
  console.log(`\n  🔔 Alerta: ${alerta.origem} → ${alerta.destino} | meta R$${alerta.meta}`);

  // Filtra voos pelo horário mínimo
  let voosFiltrados = voosCache.filter(v => v.preco != null);

  if (alerta.horario_minimo) {
    voosFiltrados = voosFiltrados.filter(v => {
      if (!v.horario_partida) return false;
      return v.horario_partida >= alerta.horario_minimo;
    });
    console.log(`    ⏰ Filtro horário >= ${alerta.horario_minimo}: ${voosFiltrados.length} voos`);
  }

  // Filtra só direto
  if (alerta.so_direto) {
    voosFiltrados = voosFiltrados.filter(v => v.escalas === 0);
    console.log(`    🛫 Filtro direto: ${voosFiltrados.length} voos`);
  }

  if (voosFiltrados.length === 0) {
    console.log(`    ⚠️  Nenhum voo encontrado com os filtros`);
    return;
  }

  // Pega o menor preço
  const melhorVoo = voosFiltrados[0]; // já ordenado por preco.asc
  const precoAtual = melhorVoo.preco;

  console.log(`    💰 Menor preço filtrado: R$${precoAtual} (meta: R$${alerta.meta})`);

  // Verifica se bateu a meta
  if (precoAtual > alerta.meta) {
    console.log(`    ➖ Acima da meta — sem notificação`);
    return;
  }

  // Verifica se já notificou nas últimas 6h
  const seisHorasAtras = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const notificacoesRecentes = await supabase(
    'GET',
    `notifications?alert_id=eq.${alerta.id}&enviado_em=gte.${seisHorasAtras}&limit=1`
  );

  if (notificacoesRecentes.length > 0) {
    console.log(`    ⏱️  Já notificado nas últimas 6h — pulando`);
    return;
  }

  // Envia WhatsApp
  const tipo = melhorVoo.escalas === 0 ? 'direto' : `${melhorVoo.escalas} escala(s)`;
  const horario = melhorVoo.horario_partida ?? '--:--';
  const companhia = melhorVoo.companhia ?? 'Companhia não informada';

  const mensagem = [
    `✈ ${alerta.origem} → ${alerta.destino} por R$ ${precoAtual}!`,
    ``,
    `Voo das ${horario} · ${companhia} · ${tipo}`,
    ``,
    `Sua meta era R$ ${alerta.meta}. Corre comprar! 🎉`
  ].join('\n');

  console.log(`    📱 Enviando WhatsApp para ${alerta.whatsapp}...`);
  const enviado = await sendWhatsApp(alerta.whatsapp, mensagem);

  if (!enviado) {
    console.error(`    ❌ Falha ao enviar WhatsApp`);
    return;
  }

  // Registra notificação
  await supabase('POST', 'notifications', {
    alert_id: alerta.id,
    user_id: alerta.user_id,
    preco: precoAtual
  });

  console.log(`    ✅ Notificação enviada e registrada!`);
}

// ── Entry point ───────────────────────────────────────────────

async function main() {
  console.log('🚀 VooAlerta — Iniciando monitoramento');
  console.log(`📅 ${new Date().toISOString()}`);

  // Valida variáveis de ambiente
  const vars = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'SERPAPI_KEY', 'CALLMEBOT_KEY'];
  for (const v of vars) {
    if (!process.env[v]) {
      console.error(`❌ Variável de ambiente ausente: ${v}`);
      process.exit(1);
    }
  }

  // Busca rotas únicas
  const rotas = await supabase('GET', 'rotas_unicas');
  console.log(`\n📋 ${rotas.length} rota(s) única(s) para monitorar`);

  if (rotas.length === 0) {
    console.log('Nenhum alerta ativo. Encerrando.');
    return;
  }

  // Processa cada rota
  for (const rota of rotas) {
    await processarRota(rota);
  }

  console.log('\n✅ Monitoramento concluído!');
}

main().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
