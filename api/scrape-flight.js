const {
  buildGoogleFlightsUrl,
  buscarGoogleFlightsPlaywright,
  salvarCache,
  verifyUserToken
} = require('../backend/flight_scraper');

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

    const voos = await buscarGoogleFlightsPlaywright(origem, destino, data_ida, data_volta);
    let warning = null;

    if (voos.length > 0) {
      try {
        await salvarCache(voos, origem, destino, data_ida, data_volta);
      } catch (err) {
        warning = `Preco coletado, mas nao foi salvo no cache: ${err.message || String(err)}`;
      }
    }

    res.status(200).json({
      preco: voos[0]?.preco ?? null,
      quantidade: voos.length,
      link: buildGoogleFlightsUrl(origem, destino, data_ida, data_volta),
      warning
    });
  } catch (err) {
    console.error('scrape-flight failed', err);
    res.status(200).json({
      preco: null,
      quantidade: 0,
      error: err.message || String(err),
      error_stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}

module.exports = handler;
module.exports.config = {
  maxDuration: 60
};
