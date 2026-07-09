if (process.env.VERCEL && !process.env.PLAYWRIGHT_BROWSERS_PATH) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = '0';
}

const { refreshFlightPrice, verifyUserToken } = require('../backend/flight_scraper');

module.exports = async function handler(req, res) {
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
    const result = await refreshFlightPrice(body);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
};
