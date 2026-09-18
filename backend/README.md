# Backend

Coleta de preços e envio de alertas. Documentação completa em [`../doc.md`](../doc.md).

| Arquivo | Papel |
|---|---|
| `flight_scraper.js` | Coleta de voos: **MaxMilhas** primeiro, depois **Google Flights** (Playwright; SerpAPI só se o Playwright falhar). Salva em `price_cache` e escolhe o menor preço. |
| `monitor.js` | Rodada completa de voos (cron do GitHub Actions, a cada 3h): coleta cada rota, aplica os filtros de cada alerta e manda WhatsApp quando o preço fica abaixo da meta. |
| `monitor_onibus.js` | Mesma ideia pra ônibus, a partir da Buser (a cada hora). |

A atualização manual (botão ↻ do site) não roda aqui: vai pra fila `refresh_jobs` e é processada pelo worker em [`../worker/index.js`](../worker/index.js).

## Rodar manualmente

Com `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` e `SERPAPI_KEY` definidas no ambiente:

```bash
npm ci
npx playwright install chromium
node backend/monitor.js
```

No GitHub: Actions → *VooAlerta - Monitoramento de Passagens* → Run workflow.
