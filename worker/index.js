// =============================================================
// VooAlerta - Worker da fila de atualizacao manual de precos
// Roda sempre ligado (Render). Processa um job por vez de refresh_jobs,
// sem o limite de 60s da function da Vercel. Mantido acordado por um
// ping externo (UptimeRobot) no endpoint /health.
// =============================================================

const http = require('http');
const {
  refreshFlightPrice,
  supabase
} = require('../backend/flight_scraper');

const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS || 4000);
const JOB_STALE_MS = Number(process.env.WORKER_JOB_STALE_MS || 10 * 60 * 1000);
const PORT = Number(process.env.PORT || 3000);

let processing = false;

async function pegarProximoJob() {
  const jobs = await supabase(
    'GET',
    'refresh_jobs?status=eq.pending&order=criado_em.asc&limit=1'
  );
  return jobs[0] ?? null;
}

async function marcarProcessando(id) {
  await supabase('PATCH', `refresh_jobs?id=eq.${id}`, {
    status: 'processing',
    atualizado_em: new Date().toISOString()
  });
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

async function processarJob(job) {
  console.log(`[worker] Processando job ${job.id}: ${job.origem} -> ${job.destino} | ${job.data_ida}`);
  await marcarProcessando(job.id);

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
  if (processing) return;
  processing = true;

  try {
    const job = await pegarProximoJob();
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

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('ok');
}).listen(PORT, () => {
  console.log(`[worker] Health check ouvindo na porta ${PORT}`);
});
