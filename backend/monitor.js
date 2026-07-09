// =============================================================
// VooAlerta - Monitor de Passagens
// Roda via GitHub Actions e coleta Google Flights com Playwright.
// =============================================================

const {
  refreshFlightPrice,
  sleep,
  supabase
} = require('./flight_scraper');

async function sendWhatsApp(phone, message, callmebotKey) {
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}&apikey=${callmebotKey}`;
  const res = await fetch(url);
  return res.ok;
}

async function processarRota(rota) {
  const { origem, destino, data_ida, data_volta } = rota;
  console.log(`\nProcessando rota: ${origem} -> ${destino} | ${data_ida}`);

  const cacheLimite = new Date(Date.now() - 3.5 * 60 * 60 * 1000).toISOString();
  const dataVoltaFilter = data_volta ? `&data_volta=eq.${data_volta}` : '&data_volta=is.null';
  const cacheRecente = await supabase(
    'GET',
    `price_cache?origem=eq.${origem}&destino=eq.${destino}&data_ida=eq.${data_ida}${dataVoltaFilter}&atualizado_em=gte.${cacheLimite}&limit=1`
  );

  if (cacheRecente.length > 0) {
    console.log('  Cache recente (< 3h30) - usando dados existentes');
  } else {
    try {
      console.log('  Buscando no Google Flights com Playwright...');
      const result = await refreshFlightPrice({ origem, destino, data_ida, data_volta });
      console.log(`  Cache atualizado: ${result.quantidade} preco(s), menor R$ ${result.preco ?? '-'}`);
    } catch (err) {
      console.error(`  Erro na coleta Playwright: ${err.message}`);
    }
  }

  const alertas = await supabase(
    'GET',
    `alerts_ativos?origem=eq.${origem}&destino=eq.${destino}&data_ida=eq.${data_ida}`
  );
  console.log(`  ${alertas.length} alerta(s) para esta rota`);

  const voosCache = await supabase(
    'GET',
    `price_cache?origem=eq.${origem}&destino=eq.${destino}&data_ida=eq.${data_ida}${dataVoltaFilter}&order=preco.asc`
  );

  for (const alerta of alertas) {
    await processarAlerta(alerta, voosCache);
  }
}

async function processarAlerta(alerta, voosCache) {
  console.log(`\n  Alerta: ${alerta.origem} -> ${alerta.destino} | meta R$${alerta.meta}`);

  let voosFiltrados = voosCache.filter(v => v.preco != null);

  if (alerta.horario_minimo) {
    voosFiltrados = voosFiltrados.filter(v => {
      if (!v.horario_partida) return true;
      return v.horario_partida >= alerta.horario_minimo;
    });
    console.log(`    Filtro horario >= ${alerta.horario_minimo}: ${voosFiltrados.length} voos`);
  }

  if (alerta.so_direto) {
    voosFiltrados = voosFiltrados.filter(v => v.escalas === 0 || v.escalas === null);
    console.log(`    Filtro direto: ${voosFiltrados.length} voos`);
  }

  if (voosFiltrados.length === 0) {
    console.log('    Nenhum voo com os filtros');
    return;
  }

  const melhorVoo = voosFiltrados[0];
  const precoAtual = melhorVoo.preco;
  console.log(`    Menor preco: R$${precoAtual} (meta: R$${alerta.meta})`);

  if (precoAtual > alerta.meta) {
    console.log('    Acima da meta - sem notificacao');
    return;
  }

  const seisHorasAtras = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const notificacoesRecentes = await supabase(
    'GET',
    `notifications?alert_id=eq.${alerta.id}&enviado_em=gte.${seisHorasAtras}&limit=1`
  );

  if (notificacoesRecentes.length > 0) {
    console.log('    Ja notificado nas ultimas 6h - pulando');
    return;
  }

  const tipo = melhorVoo.escalas === 0 ? 'direto' : `${melhorVoo.escalas ?? 0} escala(s)`;
  const horario = melhorVoo.horario_partida ?? '--:--';
  const companhia = melhorVoo.companhia ?? 'Companhia nao informada';
  const googleFlightsUrl = melhorVoo.link || `https://www.google.com/travel/flights?hl=pt-BR&q=${encodeURIComponent(`voos de ${alerta.origem} para ${alerta.destino} em ${alerta.data_ida}`)}`;

  const mensagem = [
    `${alerta.origem} -> ${alerta.destino} por R$ ${precoAtual}!`,
    '',
    `Voo das ${horario} - ${companhia} - ${tipo}`,
    '',
    `Sua meta era R$ ${alerta.meta}. Corre comprar!`,
    '',
    googleFlightsUrl
  ].join('\n');

  console.log(`    Enviando WhatsApp para ${alerta.whatsapp}...`);
  const enviado = await sendWhatsApp(alerta.whatsapp, mensagem, alerta.callmebot_key);

  if (!enviado) {
    console.error('    Falha ao enviar WhatsApp');
    return;
  }

  await supabase('POST', 'notifications', {
    alert_id: alerta.id,
    user_id: alerta.user_id,
    preco: precoAtual
  });

  console.log('    Notificacao enviada e registrada');
}

async function main() {
  console.log('VooAlerta - Iniciando monitoramento');
  console.log(new Date().toISOString());

  const rotas = await supabase('GET', 'rotas_unicas');
  console.log(`\n${rotas.length} rota(s) unica(s) para monitorar`);

  if (rotas.length === 0) {
    console.log('Nenhum alerta ativo. Encerrando.');
    return;
  }

  for (const rota of rotas) {
    await processarRota(rota);
    await sleep(2000);
  }

  const hoje = new Date().toISOString().split('T')[0];
  await supabase('DELETE', `price_cache?data_ida=lt.${hoje}`);
  console.log('\nCache de datas passadas removido');
  console.log('\nMonitoramento concluido');
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
