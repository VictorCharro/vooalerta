const {
  supabase,
  verifyUserToken
} = require('../backend/flight_scraper');

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Metodo nao permitido' });
    return;
  }

  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const user = token ? await verifyUserToken(token) : null;
    if (!user?.id) {
      res.status(401).json({ error: 'Nao autenticado' });
      return;
    }

    const jobId = req.query?.job_id;
    if (!jobId) {
      res.status(400).json({ error: 'job_id e obrigatorio' });
      return;
    }

    const jobs = await supabase('GET', `refresh_jobs?id=eq.${jobId}&limit=1`);
    const job = jobs[0];
    if (!job) {
      res.status(404).json({ error: 'Job nao encontrado' });
      return;
    }

    res.status(200).json({
      status: job.status,
      preco: job.preco,
      link: job.link,
      fontes: job.fontes,
      warning: job.warning,
      error: job.status === 'error'
        ? 'Nao foi possivel atualizar o preco agora. Tente novamente em instantes.'
        : undefined
    });
  } catch (err) {
    console.error('job-status failed', err);
    res.status(200).json({ status: 'error', error: 'Nao foi possivel consultar a atualizacao agora.' });
  }
}

module.exports = handler;
module.exports.config = {
  maxDuration: 10
};
