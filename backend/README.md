# Backend - GitHub Actions

O monitoramento de voos roda via GitHub Actions usando Playwright para coletar precos no Google Flights.

## Fluxo

```text
GitHub Actions cron
  -> backend/monitor.js
  -> backend/flight_scraper.js
  -> Google Flights via Playwright
  -> price_cache no Supabase
  -> filtros por alerta
  -> WhatsApp via CallMeBot quando preco <= meta
```

## Secrets

| Secret | Onde obter |
|---|---|
| `SUPABASE_URL` | Supabase -> Settings -> API -> Project URL |
| `SUPABASE_SERVICE_KEY` | Supabase -> Settings -> API -> service_role key |

`SERPAPI_KEY` nao e mais usado.

## Rodar manualmente

```bash
npm ci
npx playwright install chromium
node backend/monitor.js
```

No GitHub: Actions -> VooAlerta - Monitoramento de Passagens -> Run workflow.
