const {
  supabase,
  verifyUserToken
} = require('../backend/flight_scraper');

const JOB_REUSE_WINDOW_MS = 2 * 60 * 1000; // evita criar job duplicado pra mesma rota em cliques repetidos

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
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

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { origem, destino, data_ida, data_volta } = body;

    if (!origem || !destino || !data_ida) {
      res.status(400).json({ error: 'origem, destino e data_ida sao obrigatorios' });
      return;
    }

    const dataVoltaFilter = data_volta ? `&data_volta=eq.${data_volta}` : '&data_volta=is.null';
    const janela = new Date(Date.now() - JOB_REUSE_WINDOW_MS).toISOString();

    const existentes = await supabase(
      'GET',
      `refresh_jobs?origem=eq.${origem}&destino=eq.${destino}&data_ida=eq.${data_ida}${dataVoltaFilter}&status=in.(pending,processing)&criado_em=gte.${janela}&order=criado_em.desc&limit=1`
    );

    let job = existentes[0];
    if (!job) {
      const criados = await supabase('POST', 'refresh_jobs', {
        origem,
        destino,
        data_ida,
        data_volta: data_volta || null
      });
      job = criados[0];
    }

    res.status(200).json({ job_id: job.id, status: job.status });
  } catch (err) {
    console.error('scrape-flight (enqueue) failed', err);
    res.status(200).json({ job_id: null });
  }
}

module.exports = handler;
module.exports.config = {
  maxDuration: 15
};
