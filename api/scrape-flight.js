const {
  refreshFlightPrice,
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

    const result = await refreshFlightPrice({ origem, destino, data_ida, data_volta });
    res.status(200).json(result);
  } catch (err) {
    console.error('scrape-flight failed', err);
    const message = err.message || String(err);
    let userMessage = 'Nao foi possivel atualizar o preco agora. Tente novamente em instantes.';
    if (/Target page, context or browser has been closed|page\.goto/i.test(message)) {
      userMessage = 'Google Flights fechou a pagina durante a coleta. Tente novamente em alguns segundos.';
    } else if (/ETXTBSY|browserType\.launch: spawn/i.test(message)) {
      userMessage = 'O navegador de coleta ainda estava sendo preparado pelo servidor. Tente novamente em alguns segundos.';
    } else if (/Muitas coletas simultaneas/i.test(message)) {
      userMessage = message;
    }

    res.status(200).json({
      preco: null,
      quantidade: 0,
      error: userMessage,
      error_stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}

module.exports = handler;
module.exports.config = {
  maxDuration: 60
};
