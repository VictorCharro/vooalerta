const DEFAULT_TIMEOUT_MS = 45000;
const IS_VERCEL = !!process.env.VERCEL;

function getSupabaseConfig({ serviceRole = false } = {}) {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = serviceRole ? serviceKey : (serviceKey || process.env.SUPABASE_KEY);

  if (!url || !key) {
    throw new Error(serviceRole
      ? 'SUPABASE_URL e SUPABASE_SERVICE_KEY/SUPABASE_SERVICE_ROLE_KEY sao obrigatorios para salvar o cache'
      : 'SUPABASE_URL e SUPABASE_SERVICE_KEY/SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_KEY sao obrigatorios');
  }

  return { url, key };
}

async function supabase(method, path, body = null) {
  const { url, key } = getSupabaseConfig({ serviceRole: true });
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json'
  };

  if (method === 'POST') headers.Prefer = 'resolution=merge-duplicates';

  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase ${method} ${path} -> ${res.status}: ${err}`);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

async function verifyUserToken(token) {
  const { url, key } = getSupabaseConfig();
  const res = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) return null;
  return res.json();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildGoogleFlightsUrl(origem, destino, dataIda, dataVolta) {
  const query = dataVolta
    ? `voos de ${origem} para ${destino} ida ${dataIda} volta ${dataVolta}`
    : `voos de ${origem} para ${destino} em ${dataIda}`;
  return `https://www.google.com/travel/flights?hl=pt-BR&curr=BRL&q=${encodeURIComponent(query)}`;
}

function parsePricesFromText(text) {
  const matches = [...text.matchAll(/R\$\s?([\d.]{2,})(?:,\d{2})?/g)];
  const prices = matches
    .map(match => Number(match[1].replace(/\./g, '')))
    .filter(price => Number.isFinite(price) && price > 0 && price < 100000);

  return [...new Set(prices)].sort((a, b) => a - b);
}

async function buscarGoogleFlightsPlaywright(origem, destino, dataIda, dataVolta) {
  const url = buildGoogleFlightsUrl(origem, destino, dataIda, dataVolta);
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage({
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    });

    if (IS_VERCEL) {
      await page.route('**/*', route => {
        const type = route.request().resourceType();
        if (['image', 'media', 'font', 'stylesheet'].includes(type)) {
          route.abort();
          return;
        }
        route.continue();
      });
    }

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: DEFAULT_TIMEOUT_MS });
    if (!IS_VERCEL) {
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    }
    await page.waitForTimeout(IS_VERCEL ? 2500 : 5000);

    const text = await page.locator('body').innerText({ timeout: 10000 });
    const prices = parsePricesFromText(text);

    return prices.slice(0, 12).map(preco => ({
      preco,
      companhia: null,
      horario_partida: null,
      horario_chegada: null,
      duracao_min: null,
      escalas: 0,
      link: url
    }));
  } finally {
    await browser.close();
  }
}

async function launchBrowser() {
  if (IS_VERCEL) {
    const chromiumModule = await import('@sparticuz/chromium');
    const chromium = chromiumModule.default;
    const { chromium: playwrightChromium } = require('playwright-core');

    return playwrightChromium.launch({
      args: [
        ...chromium.args,
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process'
      ],
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      timeout: 20000
    });
  }

  const { chromium } = require('playwright');
  return chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    timeout: DEFAULT_TIMEOUT_MS
  });
}

async function salvarCache(voos, origem, destino, dataIda, dataVolta) {
  const dataVoltaFilter = dataVolta ? `&data_volta=eq.${dataVolta}` : '&data_volta=is.null';
  await supabase(
    'DELETE',
    `price_cache?origem=eq.${origem}&destino=eq.${destino}&data_ida=eq.${dataIda}${dataVoltaFilter}`
  );

  const agora = new Date().toISOString();
  for (const voo of voos) {
    await supabase('POST', 'price_cache', {
      origem,
      destino,
      data_ida: dataIda,
      data_volta: dataVolta || null,
      companhia: voo.companhia,
      preco: voo.preco,
      horario_partida: voo.horario_partida,
      horario_chegada: voo.horario_chegada,
      duracao_min: voo.duracao_min,
      escalas: voo.escalas,
      link: voo.link,
      atualizado_em: agora
    });
  }
}

async function refreshFlightPrice({ origem, destino, data_ida, data_volta }) {
  if (!origem || !destino || !data_ida) {
    throw new Error('origem, destino e data_ida sao obrigatorios');
  }

  const voos = await buscarGoogleFlightsPlaywright(origem, destino, data_ida, data_volta);
  if (voos.length > 0) {
    await salvarCache(voos, origem, destino, data_ida, data_volta);
  }

  return {
    preco: voos[0]?.preco ?? null,
    quantidade: voos.length,
    link: buildGoogleFlightsUrl(origem, destino, data_ida, data_volta)
  };
}

module.exports = {
  buildGoogleFlightsUrl,
  buscarGoogleFlightsPlaywright,
  launchBrowser,
  refreshFlightPrice,
  salvarCache,
  sleep,
  supabase,
  verifyUserToken
};
