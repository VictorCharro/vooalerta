const DEFAULT_TIMEOUT_MS = 45000;
const NAVIGATION_ATTEMPTS = Number(process.env.FLIGHT_NAVIGATION_ATTEMPTS || 2);
const PRICE_SETTLE_MS = Number(process.env.FLIGHT_PRICE_SETTLE_MS || 20000);
const PRICE_STABLE_MS = Number(process.env.FLIGHT_PRICE_STABLE_MS || 5000);
const PRICE_TIMEOUT_MS = Number(process.env.FLIGHT_PRICE_TIMEOUT_MS || 30000);
const CHROMIUM_LAUNCH_ATTEMPTS = Number(process.env.CHROMIUM_LAUNCH_ATTEMPTS || 4);
const SERPAPI_TIMEOUT_MS = Number(process.env.SERPAPI_TIMEOUT_MS || 25000);
const GOOGLE_LOCK_TTL_MS = Number(process.env.GOOGLE_LOCK_TTL_MS || 45000);
const IS_VERCEL = !!process.env.VERCEL;
let vercelChromiumPathPromise;

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
  if (method === 'PATCH') headers.Prefer = 'return=representation';

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

function parseSerpApiTime(value) {
  return String(value || '').match(/(\d{1,2}:\d{2})$/)?.[1] ?? null;
}

async function buscarGoogleFlightsSerpApi(origem, destino, dataIda, dataVolta) {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) throw new Error('SERPAPI_KEY nao configurada no servidor.');

  const params = new URLSearchParams({
    engine: 'google_flights',
    departure_id: origem,
    arrival_id: destino,
    outbound_date: dataIda,
    type: dataVolta ? '1' : '2',
    travel_class: '1',
    currency: 'BRL',
    gl: 'br',
    hl: 'pt',
    deep_search: 'true',
    show_hidden: 'true',
    api_key: apiKey
  });
  if (dataVolta) params.set('return_date', dataVolta);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SERPAPI_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`https://serpapi.com/search.json?${params}`, {
      signal: controller.signal
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`SerpAPI excedeu o limite de ${Math.round(SERPAPI_TIMEOUT_MS / 1000)}s.`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`SerpAPI respondeu HTTP ${response.status}.`);
  }

  const result = await response.json();
  if (result.error) throw new Error(`SerpAPI: ${result.error}`);

  const link = result.search_metadata?.google_flights_url
    || buildGoogleFlightsUrl(origem, destino, dataIda, dataVolta);
  const flights = [
    ...(result.best_flights ?? []),
    ...(result.other_flights ?? [])
  ].map(item => {
    const segments = item.flights ?? [];
    const firstSegment = segments[0] ?? {};
    const lastSegment = segments[segments.length - 1] ?? firstSegment;
    const airlines = [...new Set(segments.map(segment => segment.airline).filter(Boolean))];
    const price = Number(item.price);

    if (!Number.isFinite(price) || price <= 0) return null;
    return {
      preco: price,
      companhia: airlines.join(', ') || item.airline || null,
      horario_partida: parseSerpApiTime(firstSegment.departure_airport?.time),
      horario_chegada: parseSerpApiTime(lastSegment.arrival_airport?.time),
      duracao_min: Number(item.total_duration) || null,
      escalas: Math.max(0, segments.length - 1),
      link
    };
  }).filter(Boolean);

  if (flights.length === 0) return [];

  const lowestPrice = Math.min(...flights.map(flight => flight.preco));
  return [
    createAdvertisedPriceFlight(lowestPrice, link),
    ...flights
  ].sort((a, b) => a.preco - b.preco);
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
  const routeRegex = new RegExp(`${origem}\\s*-\\s*${destino}`, 'i');
  if (!routeRegex.test(normalized)) return null;

  const preco = parsePrice(normalized);
  const timeMatch = normalized.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
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

async function selectLowestPricesTab(page, origem, destino) {
  const tabs = page.locator('[role="tab"]');
  let lowestPricesTab = null;

  for (let index = 0; index < await tabs.count(); index++) {
    const tab = tabs.nth(index);
    const text = normalizeText(await tab.innerText().catch(() => ''))
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    if (text.startsWith('menores precos')) {
      lowestPricesTab = tab;
      break;
    }
  }

  if (!lowestPricesTab) {
    throw new Error('Nao foi possivel localizar a aba Menores precos no Google Flights.');
  }

  await lowestPricesTab.click({ force: true });
  await page.waitForFunction(() => {
    const normalize = value => (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    return Array.from(document.querySelectorAll('[role="tab"]')).some(tab =>
      normalize(tab.innerText || tab.textContent).startsWith('menores precos')
      && tab.getAttribute('aria-selected') === 'true'
    );
  }, null, { timeout: 5000 });

  return waitForLowestPricesToSettle(page, origem, destino);
}

async function getLowestPricesSnapshot(page, origem, destino) {
  return page.evaluate(({ origem, destino }) => {
    const normalize = value => (value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
    const normalizeTab = value => normalize(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const parseVisiblePrice = value => {
      const match = normalize(value).match(/R\$\s*([\d.]+)(?:,\d{2})?/);
      return match ? Number(match[1].replace(/\./g, '')) : null;
    };
    const routePattern = new RegExp(`${origem}\\s*-\\s*${destino}`, 'i');
    const selectedTab = Array.from(document.querySelectorAll('[role="tab"]')).find(tab =>
      tab.getAttribute('aria-selected') === 'true'
      && normalizeTab(tab.innerText || tab.textContent).startsWith('menores precos')
    );
    const prices = Array.from(document.querySelectorAll('li.pIav2d'))
      .filter(row => {
        const style = window.getComputedStyle(row);
        return style.display !== 'none'
          && style.visibility !== 'hidden'
          && !row.closest('[aria-hidden="true"]');
      })
      .map(row => normalize(row.innerText || row.textContent || ''))
      .filter(text => routePattern.test(text))
      .map(parseVisiblePrice)
      .filter(price => Number.isFinite(price));

    return {
      advertisedPrice: selectedTab ? parseVisiblePrice(selectedTab.innerText || selectedTab.textContent || '') : null,
      minPrice: prices.length ? Math.min(...prices) : null,
      rowCount: prices.length,
      signature: prices.slice(0, 12).join(',')
    };
  }, { origem, destino });
}

async function waitForLowestPricesToSettle(page, origem, destino) {
  const startedAt = Date.now();
  let stableSince = null;
  let previousSignature = null;
  let lastSnapshot = null;

  while (Date.now() - startedAt < PRICE_TIMEOUT_MS) {
    const snapshot = await getLowestPricesSnapshot(page, origem, destino);
    lastSnapshot = snapshot;
    const signature = String(snapshot.advertisedPrice);
    const advertisedPriceAvailable = snapshot.advertisedPrice !== null;

    if (advertisedPriceAvailable && signature === previousSignature) {
      stableSince ??= Date.now();
    } else {
      stableSince = advertisedPriceAvailable ? Date.now() : null;
      previousSignature = signature;
    }

    const minimumDelayPassed = Date.now() - startedAt >= PRICE_SETTLE_MS;
    const stableLongEnough = stableSince !== null && Date.now() - stableSince >= PRICE_STABLE_MS;
    if (minimumDelayPassed && stableLongEnough) {
      return { advertisedPrice: snapshot.advertisedPrice };
    }

    await page.waitForTimeout(1000);
  }

  throw new Error(
    `O valor da aba Menores precos nao estabilizou em ${Math.round(PRICE_TIMEOUT_MS / 1000)}s `
    + `(ultimo valor: R$ ${lastSnapshot?.advertisedPrice ?? 'indisponivel'}).`
  );
}

function createAdvertisedPriceFlight(advertisedPrice, link) {
  return {
    preco: advertisedPrice,
    companhia: null,
    horario_partida: null,
    horario_chegada: null,
    duracao_min: null,
    escalas: null,
    link
  };
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

  const rowTexts = await page.locator('li.pIav2d').evaluateAll((nodes, route) => nodes
    .filter(node => {
      const style = window.getComputedStyle(node);
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && !node.closest('[aria-hidden="true"]');
    })
    .map(node => node.innerText || '')
    .filter(text => text.includes('R$') && text.includes(route.origem) && text.includes(route.destino)),
  { origem, destino });

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

async function buscarGoogleFlightsTodasFontes(origem, destino, dataIda, dataVolta) {
  const fontes = {};
  const warnings = [];

  try {
    const playwrightFlights = await buscarGoogleFlightsPlaywright(origem, destino, dataIda, dataVolta);
    if (playwrightFlights.length > 0) {
      fontes.playwright = {
        preco: playwrightFlights[0]?.preco ?? null,
        quantidade: playwrightFlights.length
      };
      return {
        voos: playwrightFlights.sort((a, b) => a.preco - b.preco),
        fontes,
        warning: undefined
      };
    }
    warnings.push('playwright: nenhum preco encontrado');
    console.warn('Coleta playwright indisponivel: nenhum preco encontrado');
  } catch (err) {
    const reason = String(err?.message || err).split('\n')[0];
    warnings.push(`playwright: ${reason}`);
    console.warn(`Coleta playwright indisponivel: ${reason}`);
  }

  // SerpAPI so entra como fallback: a aba "Menores precos" do Playwright e a
  // referencia real do preco anunciado pelo Google; o SerpAPI (best_flights +
  // other_flights) equivale a "Melhor opcao" e nao deve substituir esse valor
  // quando o Playwright funciona.
  try {
    const serpApiFlights = await buscarGoogleFlightsSerpApi(origem, destino, dataIda, dataVolta);
    if (serpApiFlights.length > 0) {
      fontes.serpapi = {
        preco: serpApiFlights[0]?.preco ?? null,
        quantidade: serpApiFlights.length
      };
      return {
        voos: serpApiFlights.sort((a, b) => a.preco - b.preco),
        fontes,
        warning: warnings.length ? warnings.join(' | ') : undefined
      };
    }
    warnings.push('serpapi: nenhum preco encontrado');
    console.warn('Coleta serpapi indisponivel: nenhum preco encontrado');
  } catch (err) {
    const reason = String(err?.message || err).split('\n')[0];
    warnings.push(`serpapi: ${reason}`);
    console.warn(`Coleta serpapi indisponivel: ${reason}`);
  }

  throw new Error(`Nenhuma fonte retornou precos. ${warnings.join(' | ')}`);
}

async function createStealthPage(browser) {
  const page = await browser.newPage({
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 900 },
    geolocation: { latitude: -23.5505, longitude: -46.6333 },
    permissions: ['geolocation'],
    extraHTTPHeaders: {
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
    }
  });

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en-US', 'en'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    window.chrome = { runtime: {} };
    const originalQuery = window.navigator.permissions?.query;
    if (originalQuery) {
      window.navigator.permissions.query = parameters => (
        parameters.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(parameters)
      );
    }
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

  return page;
}

function buildMaxMilhasUrl(origem, destino, dataIda, dataVolta) {
  return dataVolta
    ? `https://www.maxmilhas.com.br/busca-passagens-aereas/RT/${origem}/${destino}/${dataIda}/${dataVolta}/1/0/0/EC`
    : `https://www.maxmilhas.com.br/busca-passagens-aereas/OW/${origem}/${destino}/${dataIda}/1/0/0/EC`;
}

async function buscarMaxMilhas(origem, destino, dataIda, dataVolta) {
  const url = buildMaxMilhasUrl(origem, destino, dataIda, dataVolta);
  const browser = await launchBrowser();

  try {
    const page = await createStealthPage(browser);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: IS_VERCEL ? 30000 : DEFAULT_TIMEOUT_MS });
    await page.waitForSelector('strong', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(IS_VERCEL ? 3000 : 4000);

    const result = await page.evaluate(() => {
      const normalize = value => (value || '')
        .replace(/ /g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const parsePrice = value => {
        const match = normalize(value).match(/R\$\s*([\d.]+)(?:,\d{2})?/);
        return match ? Number(match[1].replace(/\./g, '')) : null;
      };

      const strong = Array.from(document.querySelectorAll('strong'))
        .find(el => /R\$/.test(el.textContent || ''));
      const preco = strong ? parsePrice(strong.textContent) : null;

      const airlineLabel = Array.from(document.querySelectorAll('p'))
        .find(el => /^Na\s+\S+/i.test(normalize(el.textContent)));
      const companhiaMatch = airlineLabel
        ? normalize(airlineLabel.textContent).match(/^Na\s+(\S+)/i)
        : null;

      return { preco, companhia: companhiaMatch ? companhiaMatch[1] : null };
    });

    if (!result.preco) {
      throw new Error('Nao foi possivel ler o preco na Maxmilhas.');
    }

    return [{
      preco: result.preco,
      companhia: result.companhia,
      horario_partida: null,
      horario_chegada: null,
      duracao_min: null,
      escalas: null,
      link: url
    }];
  } finally {
    await browser.close().catch(() => {});
  }
}

async function tentarAdquirirLockScrape(ttlMs = GOOGLE_LOCK_TTL_MS) {
  const agora = new Date();
  const novoLimite = new Date(agora.getTime() + ttlMs).toISOString();

  try {
    const rows = await supabase(
      'PATCH',
      `scrape_lock?id=eq.1&busy_until=lt.${agora.toISOString()}`,
      { busy_until: novoLimite }
    );
    return rows.length > 0;
  } catch (err) {
    // Se a tabela/lock nao existir ainda (migration nao aplicada) ou o
    // Supabase falhar, nao bloqueia a coleta: segue sem fila.
    console.warn(`Lock de coleta indisponivel, seguindo sem fila: ${err.message}`);
    return true;
  }
}

async function liberarLockScrape() {
  await supabase('PATCH', 'scrape_lock?id=eq.1', { busy_until: new Date().toISOString() });
}

async function buscarCacheExistente(origem, destino, dataIda, dataVolta) {
  const dataVoltaFilter = dataVolta ? `&data_volta=eq.${dataVolta}` : '&data_volta=is.null';
  return supabase(
    'GET',
    `price_cache?origem=eq.${origem}&destino=eq.${destino}&data_ida=eq.${dataIda}${dataVoltaFilter}&preco=not.is.null&order=preco.asc&limit=1`
  );
}

async function buscarTodasFontes(origem, destino, dataIda, dataVolta) {
  // Roda as fontes em sequencia (nao em paralelo): dois Chromium abertos ao
  // mesmo tempo estouram facil o limite de memoria/tempo da function na
  // Vercel, causando falha silenciosa de uma das fontes.
  const voos = [];
  const fontes = {};
  const warnings = [];

  try {
    const googleResult = await buscarGoogleFlightsTodasFontes(origem, destino, dataIda, dataVolta);
    voos.push(...googleResult.voos);
    Object.assign(fontes, googleResult.fontes);
    if (googleResult.warning) warnings.push(googleResult.warning);
  } catch (err) {
    warnings.push(`google: ${String(err?.message || err).split('\n')[0]}`);
  }

  try {
    const maxmilhasFlights = await buscarMaxMilhas(origem, destino, dataIda, dataVolta);
    if (maxmilhasFlights.length > 0) {
      voos.push(...maxmilhasFlights);
      fontes.maxmilhas = {
        preco: maxmilhasFlights[0]?.preco ?? null,
        quantidade: maxmilhasFlights.length
      };
    } else {
      warnings.push('maxmilhas: nenhum preco encontrado');
    }
  } catch (err) {
    warnings.push(`maxmilhas: ${String(err?.message || err).split('\n')[0]}`);
  }

  if (voos.length === 0) {
    throw new Error(`Nenhuma fonte retornou precos. ${warnings.join(' | ')}`);
  }

  return {
    voos: voos.sort((a, b) => a.preco - b.preco),
    fontes,
    warning: warnings.length ? warnings.join(' | ') : undefined
  };
}

async function buscarGoogleFlightsPlaywrightOnce(url, origem, destino) {
  const browser = await launchBrowser();

  try {
    const page = await createStealthPage(browser);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: IS_VERCEL ? 30000 : DEFAULT_TIMEOUT_MS });
    if (!IS_VERCEL) {
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    }
    await page.waitForTimeout(IS_VERCEL ? 2500 : 5000);
    const { advertisedPrice } = await selectLowestPricesTab(page, origem, destino);
    const flights = await collectFlightRows(page, origem, destino, url);

    if (!advertisedPrice) {
      throw new Error('Nao foi possivel ler o valor exibido na aba Menores precos.');
    }

    return [
      createAdvertisedPriceFlight(advertisedPrice, url),
      ...flights.filter(flight => flight.preco >= advertisedPrice)
    ].sort((a, b) => a.preco - b.preco);
  } finally {
    await browser.close().catch(() => {});
  }
}

async function launchBrowser() {
  if (IS_VERCEL) {
    const chromiumModule = await import('@sparticuz/chromium');
    const chromium = chromiumModule.default;
    const { chromium: playwrightChromium } = require('playwright-core');
    const executablePath = await getVercelChromiumPath(chromium);

    await waitForExecutableToSettle(executablePath);

    let lastError;
    for (let attempt = 1; attempt <= CHROMIUM_LAUNCH_ATTEMPTS; attempt++) {
      try {
        return await playwrightChromium.launch({
          args: [
            ...chromium.args,
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-setuid-sandbox',
            '--no-sandbox'
          ],
          executablePath,
          headless: chromium.headless,
          timeout: 20000
        });
      } catch (err) {
        lastError = err;
        if (!/ETXTBSY/i.test(err.message || '') || attempt === CHROMIUM_LAUNCH_ATTEMPTS) {
          throw err;
        }

        console.warn(`Chromium ocupado durante o launch (${attempt}/${CHROMIUM_LAUNCH_ATTEMPTS}); aguardando extracao terminar.`);
        await sleep(750 * attempt);
        await waitForExecutableToSettle(executablePath);
      }
    }

    throw lastError;
  }

  const { chromium } = require('playwright');
  return chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    timeout: DEFAULT_TIMEOUT_MS
  });
}

async function getVercelChromiumPath(chromium) {
  if (!vercelChromiumPathPromise) {
    vercelChromiumPathPromise = chromium.executablePath().catch(err => {
      vercelChromiumPathPromise = undefined;
      throw err;
    });
  }

  return vercelChromiumPathPromise;
}

async function waitForExecutableToSettle(executablePath) {
  const { stat } = require('node:fs/promises');
  let previousSize = -1;
  let stableChecks = 0;

  for (let check = 0; check < 8; check++) {
    try {
      const { size } = await stat(executablePath);
      stableChecks = size > 0 && size === previousSize ? stableChecks + 1 : 0;
      previousSize = size;
      if (stableChecks >= 2) return;
    } catch (_) {
      stableChecks = 0;
      previousSize = -1;
    }

    await sleep(250);
  }
}

async function salvarCache(voos, origem, destino, dataIda, dataVolta) {
  const dataVoltaFilter = dataVolta ? `&data_volta=eq.${dataVolta}` : '&data_volta=is.null';
  await supabase(
    'DELETE',
    `price_cache?origem=eq.${origem}&destino=eq.${destino}&data_ida=eq.${dataIda}${dataVoltaFilter}`
  );

  if (voos.length === 0) return;

  const agora = new Date().toISOString();
  const rows = voos.map(voo => ({
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
  }));

  await supabase('POST', 'price_cache', rows);
}

function cacheRowParaResposta(row) {
  return {
    preco: row.preco,
    quantidade: 1,
    link: row.link ?? undefined,
    fontes: {},
    warning: 'fila ocupada: retornado o ultimo preco coletado'
  };
}

async function refreshFlightPrice({ origem, destino, data_ida, data_volta }) {
  if (!origem || !destino || !data_ida) {
    throw new Error('origem, destino e data_ida sao obrigatorios');
  }

  // So uma coleta completa (Google + Maxmilhas) roda por vez. Se outro
  // refresh ja esta em andamento, nao abre navegador nenhum: devolve na
  // hora o ultimo preco em cache pra essa rota, se houver.
  const lockAdquirido = await tentarAdquirirLockScrape();
  if (!lockAdquirido) {
    const cache = await buscarCacheExistente(origem, destino, data_ida, data_volta).catch(() => []);
    if (cache.length > 0) return cacheRowParaResposta(cache[0]);
    throw new Error('Muitas coletas simultaneas no momento. Tente novamente em instantes.');
  }

  try {
    const result = await buscarTodasFontes(origem, destino, data_ida, data_volta);
    const voos = result.voos;
    if (voos.length > 0) {
      await salvarCache(voos, origem, destino, data_ida, data_volta);
    }

    return {
      preco: voos[0]?.preco ?? null,
      quantidade: voos.length,
      link: voos[0]?.link ?? buildGoogleFlightsUrl(origem, destino, data_ida, data_volta),
      fontes: result.fontes,
      warning: result.warning
    };
  } catch (err) {
    // Se as duas fontes falharem de vez, cai pro ultimo preco em cache em
    // vez de propagar um erro tecnico pro usuario.
    const cache = await buscarCacheExistente(origem, destino, data_ida, data_volta).catch(() => []);
    if (cache.length > 0) return cacheRowParaResposta(cache[0]);
    throw err;
  } finally {
    await liberarLockScrape().catch(() => {});
  }
}

module.exports = {
  buildGoogleFlightsUrl,
  buildMaxMilhasUrl,
  buscarGoogleFlightsPlaywright,
  buscarGoogleFlightsSerpApi,
  buscarGoogleFlightsTodasFontes,
  buscarMaxMilhas,
  buscarTodasFontes,
  collectFlightRows,
  buscarCacheExistente,
  createAdvertisedPriceFlight,
  createStealthPage,
  getLowestPricesSnapshot,
  launchBrowser,
  getVercelChromiumPath,
  liberarLockScrape,
  parseFlightRow,
  parsePrice,
  parseSerpApiTime,
  refreshFlightPrice,
  selectLowestPricesTab,
  salvarCache,
  tentarAdquirirLockScrape,
  sleep,
  supabase,
  waitForLowestPricesToSettle,
  waitForExecutableToSettle,
  verifyUserToken
};
