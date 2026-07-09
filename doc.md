# VooAlerta - doc.md

Documentacao de referencia do projeto. Atualizar sempre que houver mudancas estruturais.

## Visao Geral

Aplicacao de alertas de preco para voos e onibus (Buser). O usuario cadastra uma rota + meta de preco e recebe notificacao no WhatsApp quando o preco cai abaixo da meta.

- Frontend: Angular 17 standalone, Supabase JS client
- Backend: Node.js scripts via GitHub Actions e Vercel Functions
- Banco: Supabase (Postgres + RLS + Realtime)
- Notificacoes: CallMeBot
- Producao: https://viagemalerta.vercel.app

## Estrutura Principal

```text
vooalerta/
├── api/
│   └── scrape-flight.js              # Atualizacao manual de voos via Playwright
├── backend/
│   ├── flight_scraper.js             # Google Flights Playwright -> Supabase
│   ├── monitor.js                    # Monitor de voos
│   └── monitor_onibus.js             # Monitor de onibus (Buser)
├── src/app/
│   ├── core/services/supabase.service.ts
│   ├── features/voos/voos.component.ts
│   ├── features/onibus/onibus.component.ts
│   └── shared/
├── supabase/functions/scrape-buser/  # Atualizacao manual de onibus
└── supabase/migrations/
```

## Rotas Angular

| Path | Componente | Guard |
|---|---|---|
| `/` | redireciona para `/voos` | - |
| `/voos` | VoosComponent | authGuard |
| `/dashboard` | redireciona para `/voos` | - |
| `/onibus` | OnibusComponent | authGuard |
| `/login` | LoginComponent | guestGuard |
| `/register` | RegisterComponent | guestGuard |
| `/share/:id` | ShareComponent | - |
| `/**` | redireciona para `/voos` | - |

## Banco de Dados

### Voos

- `alerts`: alertas do usuario (origem IATA, destino IATA, datas, meta, filtros, WhatsApp, ativo)
- `price_cache`: precos coletados no Google Flights via Playwright
- `notifications`: controle anti-spam de 6h por alerta
- `profiles`: WhatsApp + CallMeBot key por usuario

### Onibus

- `bus_alerts`: alertas do usuario (origem/destino nome + slug Buser)
- `bus_price_cache`: preco minimo raspado do Buser por rota/data
- `bus_notifications`: controle anti-spam de 6h por alerta

### Views

- `alerts_ativos`: alertas de voo ativos com `callmebot_key`
- `rotas_unicas`: rotas unicas de voo para o monitor
- `bus_alerts_ativos`: alertas de onibus ativos com `callmebot_key`
- `bus_rotas_unicas`: rotas unicas de onibus para o monitor

## Secrets Necessarios

### GitHub Actions

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

### Vercel

- `SUPABASE_URL`
- `SUPABASE_KEY` (anon/public key, usada no build do Angular)
- `SUPABASE_SERVICE_KEY` ou `SUPABASE_SERVICE_ROLE_KEY` (service_role key, usada pela function `/api/scrape-flight` para gravar `price_cache`)

Nao usar mais `SERPAPI_KEY`.

## Monitor de Voos

### `backend/monitor.js`

- Fonte: Google Flights via Playwright (`backend/flight_scraper.js`)
- Cron: `.github/workflows/monitor.yml`, atualmente a cada 3h
- Instala Chromium no GitHub Actions com `npx playwright install --with-deps chromium`
- Seleciona a aba "Menores precos" no Google Flights antes de coletar
- Espera os precos do Google Flights assentarem antes de coletar; padrao `FLIGHT_PRICE_SETTLE_MS=10000`
- Reutiliza cache com menos de 3h30
- Processa notificacoes pelo cache em `price_cache`
- Mantem filtros por alerta: `horario_minimo` e `so_direto`

### `api/scrape-flight.js`

- Chamada pelo botao de atualizar na pagina de Voos
- Recebe `{ origem, destino, data_ida, data_volta }`
- Valida o usuario pelo token Supabase enviado pelo frontend
- Roda Playwright server-side, salva em `price_cache` e retorna `{ preco: number | null }`
- Clica na aba "Menores precos" do Google Flights antes de ler a lista
- Antes de ler os voos, aguarda o delay de precos (`FLIGHT_PRICE_SETTLE_MS`) para o Google concluir a consulta em fornecedores
- Cooldown no frontend: 10 minutos por rota, chave `flight_refresh_{orig}_{dest}_{data}_{volta}`

## Monitor de Onibus

### `backend/monitor_onibus.js`

- Fonte: scraping de `buser.com.br/onibus/{origem-slug}/{destino-slug}?ida={data}`
- Extrai preco da meta tag `product:price:amount`
- Reutiliza cache com menos de 3h30
- Sleep de 2s entre rotas

### `supabase/functions/scrape-buser/`

- Chamada pelo botao de atualizar na pagina de Onibus
- Recebe `{ origem_slug, destino_slug, data_ida, data_volta }`
- Salva em `bus_price_cache`
- Cooldown no frontend: 10 minutos por rota, chave `bus_refresh_{orig}_{dest}_{data}`

## Design System

Todas as paginas usam variaveis CSS de `src/styles/theme.css`.

Principais tokens:

```css
--color-accent: #7c6dfa;
--color-green:  #2dd4a0;
--color-red:    #f0605a;
--color-bg-2:   #111118;
--color-bg-3:   #18181f;
```

Classes globais reutilizaveis em `components.css`: `btn-primary`, `btn-ghost`, `btn-icon`, `spinner`, `error-box`, `success-box`, `form-hint`, `toggle`.

## Convencoes

- Componentes standalone, sem NgModules
- Path aliases: `@core/`, `@features/`, `@shared/`, `@env/`
- WhatsApp sempre salvo com prefixo `55`; remover prefixo ao exibir
- Slugs do Buser seguem `{cidade-normalizada}-{uf}`, exemplo `sao-paulo-sp`
- Alertas de voo e onibus sao separados em tabelas, servicos e componentes
