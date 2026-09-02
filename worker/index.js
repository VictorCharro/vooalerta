// =============================================================
// VooAlerta - Worker da fila de atualizacao manual de precos
// Roda sempre ligado (Render). Processa um job por vez de refresh_jobs,
// sem o limite de 60s da function da Vercel. Mantido acordado por um
// ping externo (UptimeRobot) no endpoint /health.
// =============================================================

const http = require('http');
const {
  refreshFlightPrice,
  supabase,
  closeSharedBrowser
} = require('../backend/flight_scraper');

const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS || 4000);
// Se o loop nao "bater o coracao" por esse tempo, o processo trava (ou
// morreu) e o /health deve reportar isso pro UptimeRobot em vez de
// responder 200 sempre (#139).
const HEALTH_STALE_MS = Number(process.env.WORKER_HEALTH_STALE_MS || POLL_INTERVAL_MS * 5);
const JOB_STALE_MS = Number(process.env.WORKER_JOB_STALE_MS || 10 * 60 * 1000);
// Tempo maximo que um job pode ficar em "processing" antes de ser considerado
// travado (worker morreu no meio: redeploy, OOM, crash do Chromium). Sem isso
// o job zumbi ficava preso pra sempre e o front pollava ate 10min a toa (#131).
const JOB_PROCESSING_TIMEOUT_MS = Number(process.env.WORKER_JOB_PROCESSING_TIMEOUT_MS || 5 * 60 * 1000);
const REAPER_INTERVAL_MS = Number(process.env.WORKER_REAPER_INTERVAL_MS || 60 * 1000);
const PORT = Number(process.env.PORT || 3000);

let processing = false;
let lastHeartbeatAt = Date.now();

// SELECT + PATCH separados nao sao atomicos: se duas instancias do worker
// rodassem ao mesmo tempo (deploy com overlap, escala manual), as duas
// podiam pegar o mesmo job pendente. O claim agora e um PATCH condicionado
// a status=eq.pending - se outra instancia ja reivindicou o job entre o
// SELECT e o PATCH, a condicao nao bate e volta um array vazio (#139).
async function reivindicarProximoJob() {
  const pendentes = await supabase(
    'GET',
    'refresh_jobs?status=eq.pending&order=criado_em.asc&limit=1'
  );
  const job = pendentes[0];
  if (!job) return null;

  const claim = await supabase('PATCH', `refresh_jobs?id=eq.${job.id}&status=eq.pending`, {
    status: 'processing',
    atualizado_em: new Date().toISOString()
  });

  return claim[0] ?? null;
}

async function marcarConcluido(id, resultado) {
  await supabase('PATCH', `refresh_jobs?id=eq.${id}`, {
    status: 'done',
    preco: resultado.preco,
    link: resultado.link,
    fontes: resultado.fontes ?? {},
    warning: resultado.warning ?? null,
    atualizado_em: new Date().toISOString()
  });
}

async function marcarErro(id, mensagem) {
  await supabase('PATCH', `refresh_jobs?id=eq.${id}`, {
    status: 'error',
    error: mensagem,
    atualizado_em: new Date().toISOString()
  });
}

async function limparJobsAntigos() {
  const limite = new Date(Date.now() - JOB_STALE_MS).toISOString();
  await supabase('DELETE', `refresh_jobs?status=in.(done,error)&atualizado_em=lt.${limite}`).catch(err => {
    console.warn('Falha ao limpar jobs antigos:', err.message);
  });
}

async function liberarJobsTravados() {
  const limite = new Date(Date.now() - JOB_PROCESSING_TIMEOUT_MS).toISOString();
  const travados = await supabase(
    'PATCH',
    `refresh_jobs?status=eq.processing&atualizado_em=lt.${limite}`,
    { status: 'error', error: 'timeout: job travado em processing (worker reiniciou no meio da coleta)', atualizado_em: new Date().toISOString() }
  ).catch(err => {
    console.warn('[worker] Falha ao liberar jobs travados:', err.message);
    return [];
  });

  if (travados.length > 0) {
    console.warn(`[worker] ${travados.length} job(s) travado(s) em processing foram liberados (timeout).`);
  }
}

async function processarJob(job) {
  console.log(`[worker] Processando job ${job.id}: ${job.origem} -> ${job.destino} | ${job.data_ida}`);

  try {
    const resultado = await refreshFlightPrice({
      origem: job.origem,
      destino: job.destino,
      data_ida: job.data_ida,
      data_volta: job.data_volta
    });
    await marcarConcluido(job.id, resultado);
    console.log(`[worker] Job ${job.id} concluido: R$ ${resultado.preco ?? '-'}`);
  } catch (err) {
    console.error(`[worker] Job ${job.id} falhou: ${err.message}`);
    await marcarErro(job.id, err.message);
  }
}

async function tick() {
  // Atualizado antes de qualquer await, mesmo no early-return: reflete que o
  // event loop/timer do processo esta vivo, que e o que o /health precisa
  // saber. Uma coleta demorada nao trava esse heartbeat.
  lastHeartbeatAt = Date.now();

  if (processing) return;
  processing = true;

  try {
    const job = await reivindicarProximoJob();
    if (job) await processarJob(job);
  } catch (err) {
    console.error('[worker] Erro no loop:', err.message);
  } finally {
    processing = false;
  }
}

console.log('[worker] Iniciando worker de refresh_jobs');
setInterval(tick, POLL_INTERVAL_MS);
tick();

setInterval(limparJobsAntigos, 30 * 60 * 1000);
limparJobsAntigos();

setInterval(liberarJobsTravados, REAPER_INTERVAL_MS);
liberarJobsTravados();

http.createServer((req, res) => {
  const stale = Date.now() - lastHeartbeatAt > HEALTH_STALE_MS;
  if (stale) {
    console.error(`[worker] /health: loop parado ha ${Date.now() - lastHeartbeatAt}ms`);
    res.writeHead(503, { 'Content-Type': 'text/plain' });
    res.end('stale');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('ok');
}).listen(PORT, () => {
  console.log(`[worker] Health check ouvindo na porta ${PORT}`);
});

// Fecha o Chromium compartilhado (#135) antes de sair, pra nao deixar o
// processo do browser orfao quando o Render reinicia/redeploya o worker.
async function shutdown(signal) {
  console.log(`[worker] Recebido ${signal}, encerrando...`);
  await closeSharedBrowser().catch(() => {});
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Sem isso, uma rejeicao de promise fora dos try/catch (ex. dentro de um
// callback do Playwright) derrubava o processo em silencio, sem log e sem
// o Render sabendo reiniciar (#139). Aqui logamos e saimos com erro pra
// deixar o restart explicito.
process.on('unhandledRejection', (reason) => {
  console.error('[worker] unhandledRejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('[worker] uncaughtException:', err);
  process.exit(1);
});
