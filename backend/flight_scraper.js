const DEFAULT_TIMEOUT_MS = 45000;
const NAVIGATION_ATTEMPTS = Number(process.env.FLIGHT_NAVIGATION_ATTEMPTS || 2);
const PRICE_SETTLE_MS = Number(process.env.FLIGHT_PRICE_SETTLE_MS || 10000);
const IS_VERCEL = !!process.env.VERCEL;

function getSupabaseConfig({ serviceRole = false } = {}) {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE;
  const anonKey =
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;
  const key = serviceRole ? serviceKey : (serviceKey || anonKey);

  if (!url || !key) {
    throw new Error(serviceRole
      ? 'Configuracao do servidor incompleta: defina SUPABASE_URL e SUPABASE_SERVICE_KEY na Vercel para salvar o cache.'
      : 'Configuracao do servidor incompleta: defina SUPABASE_URL e SUPABASE_KEY na Vercel.');
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
    ? `${origem} to ${destino} ${dataIda} ${dataVolta}`
    : `${origem} to ${destino} ${dataIda}`;
  return `https://www.google.com/travel/flights?hl=pt-BR&curr=BRL&q=${encodeURIComponent(query)}`;
}

function normalizeText(text) {
  return (text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePrice(text) {
  const match = normalizeText(text).match(/R\$\s*([\d.]+)(?:,\d{2})?/);
  if (!match) return null;

  const price = Number(match[1].replace(/\./g, ''));
  return Number.isFinite(price) && price > 0 && price < 100000 ? price : null;
}

function parseFlightRow(text, origem, destino, link) {
  const normalized = normalizeText(text);
  const routeRegex = new RegExp(`${origem}\\s*[–-]\\s*${destino}`, 'i');
  if (!routeRegex.test(normalized)) return null;

  const preco = parsePrice(normalized);
  const timeMatch = normalized.match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/);
  if (!preco || !timeMatch) return null;

  const afterTimes = normalized.slice(timeMatch.index + timeMatch[0].length).trim();
  const durationMatch = afterTimes.match(/(\d+)h(?:\s*(\d+))?\s*min/i);
  const companhia = durationMatch
    ? afterTimes.slice(0, durationMatch.index).trim() || null
    : null;

  const duracao_min = durationMatch
    ? Number(durationMatch[1]) * 60 + Number(durationMatch[2] || 0)
    : null;

  const escalasMatch = normalized.match(/(\d+)\s+escala/i);
  const escalas = /sem escalas/i.test(normalized)
    ? 0
    : (escalasMatch ? Number(escalasMatch[1]) : null);

  return {
    preco,
    companhia,
    horario_partida: timeMatch[1],
    horario_chegada: timeMatch[2],
    duracao_min,
    escalas,
    link
  };
}

async function selectLowestPricesTab(page) {
  const target = await page.evaluate(() => {
    const normalize = value => (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    const isVisible = element => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && rect.width > 20
        && rect.height > 20;
    };

    const elements = Array.from(document.querySelectorAll('button, [role="tab"], [role="button"], div, span'));
    const candidates = elements
      .map(element => {
        const text = normalize(element.innerText || element.textContent || '');
        const rect = element.getBoundingClientRect();
        return { element, text, rect };
      })
      .filter(item => isVisible(item.element)
        && item.text.startsWith('menores precos')
        && !item.text.includes('melhor opcao'))
      .sort((a, b) => {
        const aRole = a.element.getAttribute('role') || '';
        const bRole = b.element.getAttribute('role') || '';
        const aPriority = a.element.tagName === 'BUTTON' || aRole === 'tab' || aRole === 'button' ? 0 : 1;
        const bPriority = b.element.tagName === 'BUTTON' || bRole === 'tab' || bRole === 'button' ? 0 : 1;
        if (aPriority !== bPriority) return aPriority - bPriority;
        return (a.rect.width * a.rect.height) - (b.rect.width * b.rect.height);
      });

    const candidate = candidates[0];
    if (!candidate) return null;

    return {
      x: candidate.rect.left + candidate.rect.width / 2,
      y: candidate.rect.top + candidate.rect.height / 2,
      text: candidate.text
    };
  });

  if (!target) {
    throw new Error('Nao foi possivel localizar a aba Menores precos no Google Flights.');
  }

  await page.mouse.click(target.x, target.y);
  await page.waitForTimeout(2500);
  return true;
}

async function collectFlightRows(page, origem, destino, link) {
  await page.waitForSelector('li.pIav2d', { timeout: 15000 }).catch(() => {});

  try {
    for (let i = 0; i < 4; i++) {
      await page.mouse.wheel(0, 1800);
      await page.waitForTimeout(700);
    }
  } catch (_) {
    // Some serverless/headless sessions close input channels early; collect visible rows anyway.
  }

  if (PRICE_SETTLE_MS > 0) {
    await page.waitForTimeout(PRICE_SETTLE_MS);
  }

  const rowTexts = await page.locator('li.pIav2d, li').evaluateAll((nodes, route) => nodes
    .map(node => node.innerText || '')
    .filter(text => text.includes('R$') && text.includes(route.origem) && text.includes(route.destino))
  , { origem, destino });

  const seen = new Set();
  const flights = [];

  for (const rowText of rowTexts) {
    const flight = parseFlightRow(rowText, origem, destino, link);
    if (!flight) continue;

    const key = [
      flight.horario_partida,
      flight.horario_chegada,
      flight.companhia,
      flight.preco
    ].join('|');

    if (seen.has(key)) continue;
    seen.add(key);
    flights.push(flight);
  }

  return flights.sort((a, b) => a.preco - b.preco);
}

async function buscarGoogleFlightsPlaywright(origem, destino, dataIda, dataVolta) {
  const url = buildGoogleFlightsUrl(origem, destino, dataIda, dataVolta);
  let lastError;

  for (let attempt = 1; attempt <= NAVIGATION_ATTEMPTS; attempt++) {
    try {
      return await buscarGoogleFlightsPlaywrightOnce(url, origem, destino);
    } catch (err) {
      lastError = err;
      console.warn(`Google Flights scrape attempt ${attempt}/${NAVIGATION_ATTEMPTS} failed: ${err.message}`);

      if (attempt < NAVIGATION_ATTEMPTS) {
        await sleep(1000 * attempt);
      }
    }
  }

  throw lastError;
}

async function buscarGoogleFlightsPlaywrightOnce(url, origem, destino) {
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

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: IS_VERCEL ? 30000 : DEFAULT_TIMEOUT_MS });
    if (!IS_VERCEL) {
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    }
    await page.waitForTimeout(IS_VERCEL ? 2500 : 5000);
    await selectLowestPricesTab(page);

    return await collectFlightRows(page, origem, destino, url);
  } finally {
    await browser.close().catch(() => {});
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
        '--disable-setuid-sandbox',
        '--no-sandbox'
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
  collectFlightRows,
  launchBrowser,
  parseFlightRow,
  parsePrice,
  refreshFlightPrice,
  selectLowestPricesTab,
  salvarCache,
  sleep,
  supabase,
  verifyUserToken
};
