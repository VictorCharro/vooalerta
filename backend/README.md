# Backend - GitHub Actions

O monitoramento de voos roda via GitHub Actions usando Playwright e SerpAPI em paralelo para coletar precos no Google Flights.

## Fluxo

```text
GitHub Actions cron
  -> backend/monitor.js
  -> backend/flight_scraper.js
  -> Google Flights via Playwright + SerpAPI
  -> combina as duas fontes e escolhe o menor preco
  -> price_cache no Supabase
  -> filtros por alerta
  -> WhatsApp via CallMeBot quando preco <= meta
```

## Secrets

| Secret | Onde obter |
|---|---|
| `SUPABASE_URL` | Supabase -> Settings -> API -> Project URL |
| `SUPABASE_SERVICE_KEY` | Supabase -> Settings -> API -> service_role key |
| `SERPAPI_KEY` | SerpAPI -> Dashboard -> API Key |

As duas fontes sao consultadas em toda coleta. Se uma falhar, a outra ainda pode atualizar o cache.

## Rodar manualmente

```bash
npm ci
npx playwright install chromium
node backend/monitor.js
```

No GitHub: Actions -> VooAlerta - Monitoramento de Passagens -> Run workflow.
