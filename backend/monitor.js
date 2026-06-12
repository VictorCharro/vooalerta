// =============================================================
// VooAlerta — Monitor de Passagens
// Roda via GitHub Actions a cada hora
// Busca: SerpAPI (Google Flights)
// =============================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SERPAPI_KEY  = process.env.SERPAPI_KEY;

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

async function sendWhatsApp(phone, message, callmebotKey) {
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}&apikey=${callmebotKey}`;
  const res = await fetch(url);
  return res.ok;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── SerpAPI ───────────────────────────────────────────────────

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
  if (!res.ok) throw new Error(`SerpAPI erro: ${res.status}`);
  const resultado = await res.json();

  const voos = [
    ...(resultado.best_flights ?? []),
    ...(resultado.other_flights ?? [])
  ];

  return voos.map(v => {
    const voo = v.flights?.[0] ?? {};
    const partida = voo.departure_airport?.time;
    const chegada  = voo.arrival_airport?.time;
    return {
      preco:           v.price ?? null,
      companhia:       v.airline ?? voo.airline ?? null,
      horario_partida: partida ? new Date(partida).toTimeString().slice(0, 5) : null,
      horario_chegada: chegada  ? new Date(chegada).toTimeString().slice(0, 5) : null,
      duracao_min:     v.total_duration ?? null,
      escalas:         (v.flights?.length ?? 1) - 1,
      link:            v.booking_token ?? null
    };
  });
}

// ── Salva voos no cache ───────────────────────────────────────

async function salvarCache(voos, origem, destino, dataIda, dataVolta) {
  // Limpa entradas antigas da rota antes de inserir as novas
  const dataVoltaFilter = dataVolta
    ? `&data_volta=eq.${dataVolta}`
    : '&data_volta=is.null';
  await supabase(
    'DELETE',
    `price_cache?origem=eq.${origem}&destino=eq.${destino}&data_ida=eq.${dataIda}${dataVoltaFilter}`
  );

  const agora = new Date().toISOString();
  for (const v of voos) {
    await supabase('POST', 'price_cache', {
      origem, destino, data_ida: dataIda,
      data_volta: dataVolta || null,
      companhia:       v.companhia,
      preco:           v.preco,
      horario_partida: v.horario_partida,
      horario_chegada: v.horario_chegada,
      duracao_min:     v.duracao_min,
      escalas:         v.escalas,
      link:            v.link ?? null,
      atualizado_em:   agora
    });
  }
  console.log(`  💾 Cache atualizado com ${voos.length} voos`);
}

// ── Lógica principal ──────────────────────────────────────────

async function processarRota(rota) {
  const { origem, destino, data_ida, data_volta } = rota;
  console.log(`\n📍 Processando rota: ${origem} → ${destino} | ${data_ida}`);

  // Usa cache se tiver menos de 3h30 (coletas a cada 4h)
  const seisHorasAtras = new Date(Date.now() - 3.5 * 60 * 60 * 1000).toISOString();
  const cacheRecente = await supabase(
    'GET',
    `price_cache?origem=eq.${origem}&destino=eq.${destino}&data_ida=eq.${data_ida}&atualizado_em=gte.${seisHorasAtras}&limit=1`
  );

  if (cacheRecente.length > 0) {
    console.log(`  ✅ Cache recente (< 6h) — usando dados existentes`);
  } else {
    console.log(`  🔍 Buscando no SerpAPI...`);
    try {
      const voos = await buscarSerpapi(origem, destino, data_ida, data_volta);
      console.log(`  ✈ ${voos.length} voos encontrados`);
      if (voos.length > 0) {
        await salvarCache(voos, origem, destino, data_ida, data_volta);
      }
    } catch (err) {
      console.error(`  ❌ SerpAPI erro: ${err.message}`);
    }
  }

  // Busca alertas e voos do cache para processar notificações
  const alertas = await supabase(
    'GET',
    `alerts_ativos?origem=eq.${origem}&destino=eq.${destino}&data_ida=eq.${data_ida}`
  );
  console.log(`  👥 ${alertas.length} alerta(s) para esta rota`);

  const voosCache = await supabase(
    'GET',
    `price_cache?origem=eq.${origem}&destino=eq.${destino}&data_ida=eq.${data_ida}&order=preco.asc`
  );

  for (const alerta of alertas) {
    await processarAlerta(alerta, voosCache);
  }
}

async function processarAlerta(alerta, voosCache) {
  console.log(`\n  🔔 Alerta: ${alerta.origem} → ${alerta.destino} | meta R$${alerta.meta}`);

  let voosFiltrados = voosCache.filter(v => v.preco != null);

  if (alerta.horario_minimo) {
    voosFiltrados = voosFiltrados.filter(v => {
      if (!v.horario_partida) return false;
      return v.horario_partida >= alerta.horario_minimo;
    });
    console.log(`    ⏰ Filtro horário >= ${alerta.horario_minimo}: ${voosFiltrados.length} voos`);
  }

  if (alerta.so_direto) {
    voosFiltrados = voosFiltrados.filter(v => v.escalas === 0);
    console.log(`    🛫 Filtro direto: ${voosFiltrados.length} voos`);
  }

  if (voosFiltrados.length === 0) {
    console.log(`    ⚠️  Nenhum voo com os filtros`);
    return;
  }

  const melhorVoo  = voosFiltrados[0];
  const precoAtual = melhorVoo.preco;
  console.log(`    💰 Menor preço: R$${precoAtual} (meta: R$${alerta.meta})`);

  if (precoAtual > alerta.meta) {
    console.log(`    ➖ Acima da meta — sem notificação`);
    return;
  }

  // Anti-spam: não notifica o mesmo alerta mais de 1x a cada 6h
  const seisHorasAtras = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const notificacoesRecentes = await supabase(
    'GET',
    `notifications?alert_id=eq.${alerta.id}&enviado_em=gte.${seisHorasAtras}&limit=1`
  );

  if (notificacoesRecentes.length > 0) {
    console.log(`    ⏱️  Já notificado nas últimas 6h — pulando`);
    return;
  }

  const tipo      = melhorVoo.escalas === 0 ? 'direto' : `${melhorVoo.escalas} escala(s)`;
  const horario   = melhorVoo.horario_partida ?? '--:--';
  const companhia = melhorVoo.companhia ?? 'Companhia não informada';

  const googleFlightsUrl = (() => {
    const base  = 'https://www.google.com/travel/flights?hl=pt-BR&q=';
    const query = `voos de ${alerta.origem} para ${alerta.destino} em ${alerta.data_ida}`;
    return base + encodeURIComponent(query);
  })();

  const mensagem = [
    `✈ ${alerta.origem} → ${alerta.destino} por R$ ${precoAtual}!`,
    ``,
    `Voo das ${horario} · ${companhia} · ${tipo}`,
    ``,
    `Sua meta era R$ ${alerta.meta}. Corre comprar! 🎉`,
    ``,
    `🔗 ${googleFlightsUrl}`
  ].join('\n');

  console.log(`    📱 Enviando WhatsApp para ${alerta.whatsapp}...`);
  const enviado = await sendWhatsApp(alerta.whatsapp, mensagem, alerta.callmebot_key);

  if (!enviado) {
    console.error(`    ❌ Falha ao enviar WhatsApp`);
    return;
  }

  await supabase('POST', 'notifications', {
    alert_id: alerta.id,
    user_id:  alerta.user_id,
    preco:    precoAtual
  });

  console.log(`    ✅ Notificação enviada e registrada!`);
}

// ── Entry point ───────────────────────────────────────────────

// Cron dispara às 12,16,20,0 UTC = 9h,13h,17h,21h BRT
const CRON_HOURS_UTC = [12, 16, 20, 0];
const MONTHLY_BUDGET = 250;

async function main() {
  console.log('🚀 VooAlerta — Iniciando monitoramento');
  console.log(`📅 ${new Date().toISOString()}`);

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_KEY ausente');
    process.exit(1);
  }

  if (!SERPAPI_KEY) {
    console.error('❌ SERPAPI_KEY ausente');
    process.exit(1);
  }

  const rotas = await supabase('GET', 'rotas_unicas');
  console.log(`\n📋 ${rotas.length} rota(s) única(s) para monitorar`);

  if (rotas.length === 0) {
    console.log('Nenhum alerta ativo. Encerrando.');
    return;
  }

  // Calcula quantas execuções por dia cabem no orçamento mensal
  const runsPerDay = Math.min(
    CRON_HOURS_UTC.length,
    Math.floor(MONTHLY_BUDGET / rotas.length / 30)
  ) || 1;

  const allowedHours = CRON_HOURS_UTC.slice(0, runsPerDay);
  const currentHourUTC = new Date().getUTCHours();

  console.log(`💰 Orçamento: ${MONTHLY_BUDGET} buscas/mês | ${rotas.length} rota(s) → ${runsPerDay} coleta(s)/dia`);
  console.log(`🕐 Horários permitidos (UTC): ${allowedHours.join('h, ')}h`);

  if (!allowedHours.includes(currentHourUTC)) {
    console.log(`⏭  Hora atual (${currentHourUTC}h UTC) fora do orçamento — encerrando`);
    return;
  }

  for (const rota of rotas) {
    await processarRota(rota);
    await sleep(1000);
  }

  const hoje = new Date().toISOString().split('T')[0];
  await supabase('DELETE', `price_cache?data_ida=lt.${hoje}`);
  console.log('\n🧹 Cache de datas passadas removido');
  console.log('\n✅ Monitoramento concluído!');
}

main().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
