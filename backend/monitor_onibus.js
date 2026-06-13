// =============================================================
// VooAlerta — Monitor de Ônibus (Buser)
// Roda via GitHub Actions a cada hora
// Scraping: meta tag product:price:amount da página do Buser
// =============================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

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

// ── Scraping do Buser ─────────────────────────────────────────

async function buscarPrecoBuser(origemSlug, destinoSlug, dataIda, dataVolta) {
  let url = `https://www.buser.com.br/onibus/${origemSlug}/${destinoSlug}?ida=${dataIda}`;
  if (dataVolta) url += `&volta=${dataVolta}`;

  console.log(`  🌐 GET ${url}`);

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9',
    }
  });

  if (!res.ok) {
    throw new Error(`Buser retornou ${res.status}`);
  }

  const html = await res.text();

  // Extrai o menor preço da meta tag SSR — mais confiável que parsear JS obfuscado
  const match = html.match(/<meta[^>]+property="product:price:amount"[^>]+content="([\d.]+)"/);
  if (!match) {
    console.log(`  ⚠️  Meta tag de preço não encontrada (rota pode não existir no Buser)`);
    return null;
  }

  return parseFloat(match[1]);
}

// ── Cache ─────────────────────────────────────────────────────

async function salvarCache(origemSlug, destinoSlug, dataIda, dataVolta, preco) {
  const dataVoltaFilter = dataVolta
    ? `&data_volta=eq.${dataVolta}`
    : '&data_volta=is.null';

  await supabase(
    'DELETE',
    `bus_price_cache?origem_slug=eq.${origemSlug}&destino_slug=eq.${destinoSlug}&data_ida=eq.${dataIda}${dataVoltaFilter}`
  );

  await supabase('POST', 'bus_price_cache', {
    origem_slug:   origemSlug,
    destino_slug:  destinoSlug,
    data_ida:      dataIda,
    data_volta:    dataVolta || null,
    preco,
    atualizado_em: new Date().toISOString()
  });

  console.log(`  💾 Cache salvo: R$ ${preco}`);
}

// ── Processamento ─────────────────────────────────────────────

async function processarRota(rota) {
  const { origem_slug, destino_slug, data_ida, data_volta } = rota;
  console.log(`\n📍 ${origem_slug} → ${destino_slug} | ${data_ida}`);

  // Usa cache se tiver menos de 3h30
  const limite = new Date(Date.now() - 3.5 * 60 * 60 * 1000).toISOString();
  const dataVoltaFilter = data_volta
    ? `&data_volta=eq.${data_volta}`
    : '&data_volta=is.null';

  const cacheRecente = await supabase(
    'GET',
    `bus_price_cache?origem_slug=eq.${origem_slug}&destino_slug=eq.${destino_slug}&data_ida=eq.${data_ida}${dataVoltaFilter}&atualizado_em=gte.${limite}&limit=1`
  );

  let preco;

  if (cacheRecente.length > 0) {
    preco = cacheRecente[0].preco;
    console.log(`  ✅ Cache recente — preço R$ ${preco}`);
  } else {
    console.log(`  🔍 Raspando Buser...`);
    try {
      preco = await buscarPrecoBuser(origem_slug, destino_slug, data_ida, data_volta);
      if (preco !== null) {
        await salvarCache(origem_slug, destino_slug, data_ida, data_volta, preco);
      }
    } catch (err) {
      console.error(`  ❌ Erro no scraping: ${err.message}`);
      return;
    }
  }

  if (preco === null) return;

  // Busca alertas desta rota
  const alertas = await supabase(
    'GET',
    `bus_alerts_ativos?origem_slug=eq.${origem_slug}&destino_slug=eq.${destino_slug}&data_ida=eq.${data_ida}`
  );
  console.log(`  👥 ${alertas.length} alerta(s) para esta rota`);

  for (const alerta of alertas) {
    await processarAlerta(alerta, preco);
  }
}

async function processarAlerta(alerta, preco) {
  console.log(`\n  🔔 Alerta ${alerta.origem} → ${alerta.destino} | meta R$${alerta.meta} | atual R$${preco}`);

  if (preco > alerta.meta) {
    console.log(`  ➖ Acima da meta — sem notificação`);
    return;
  }

  // Anti-spam: não notifica mais de 1x a cada 6h
  const seisHorasAtras = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const recentes = await supabase(
    'GET',
    `bus_notifications?alert_id=eq.${alerta.id}&enviado_em=gte.${seisHorasAtras}&limit=1`
  );

  if (recentes.length > 0) {
    console.log(`  ⏱️  Já notificado nas últimas 6h — pulando`);
    return;
  }

  const busUrl = `https://www.buser.com.br/onibus/${alerta.origem_slug}/${alerta.destino_slug}?ida=${alerta.data_ida}${alerta.data_volta ? '&volta=' + alerta.data_volta : ''}`;

  const mensagem = [
    `🚌 ${alerta.origem} → ${alerta.destino} por R$ ${preco}!`,
    ``,
    `Sua meta era R$ ${alerta.meta}. Corre reservar! 🎉`,
    ``,
    `🔗 ${busUrl}`
  ].join('\n');

  console.log(`  📱 Enviando WhatsApp para ${alerta.whatsapp}...`);
  const enviado = await sendWhatsApp(alerta.whatsapp, mensagem, alerta.callmebot_key);

  if (!enviado) {
    console.error(`  ❌ Falha ao enviar WhatsApp`);
    return;
  }

  await supabase('POST', 'bus_notifications', {
    alert_id: alerta.id,
    user_id:  alerta.user_id,
    preco
  });

  console.log(`  ✅ Notificação enviada!`);
}

// ── Entry point ───────────────────────────────────────────────

async function main() {
  console.log('🚌 VooAlerta — Monitor de Ônibus');
  console.log(`📅 ${new Date().toISOString()}`);

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_KEY ausente');
    process.exit(1);
  }

  const rotas = await supabase('GET', 'bus_rotas_unicas');
  console.log(`\n📋 ${rotas.length} rota(s) de ônibus para monitorar`);

  if (rotas.length === 0) {
    console.log('Nenhum alerta de ônibus ativo. Encerrando.');
    return;
  }

  for (const rota of rotas) {
    await processarRota(rota);
    await sleep(2000); // respeita rate limit do Buser
  }

  const hoje = new Date().toISOString().split('T')[0];
  await supabase('DELETE', `bus_price_cache?data_ida=lt.${hoje}`);
  console.log('\n🧹 Cache de datas passadas removido');
  console.log('\n✅ Monitoramento de ônibus concluído!');
}

main().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
