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
- `SERPAPI_KEY`

### Vercel

- `SUPABASE_URL`
- `SUPABASE_KEY` (anon/public key, usada no build do Angular)
- `SUPABASE_SERVICE_KEY` ou `SUPABASE_SERVICE_ROLE_KEY` (service_role key, usada pela function `/api/scrape-flight` para gravar `price_cache`)
- `SERPAPI_KEY` (usada somente no servidor pela function `/api/scrape-flight`)
- Aliases aceitos pela API: `NEXT_PUBLIC_SUPABASE_URL`, `VITE_SUPABASE_URL`, `SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `VITE_SUPABASE_ANON_KEY`

## Monitor de Voos

### `backend/monitor.js`

- Fontes: Google Flights via Playwright e SerpAPI em paralelo (`backend/flight_scraper.js`)
- A SerpAPI usa `deep_search=true` e `show_hidden=true`; os resultados das duas fontes sao combinados e o menor preco global e salvo/exibido
- Se uma fonte falhar, a outra ainda atualiza o cache e a falha fica registrada como aviso
- Cron: `.github/workflows/monitor.yml`, atualmente a cada 3h
- Instala Chromium no GitHub Actions com `npx playwright install --with-deps chromium`
- Seleciona a aba "Menores precos" no Google Flights antes de coletar
- Confirma que a aba ficou selecionada e so aceita a lista quando o menor voo coincide com o preco anunciado nela; uma lista antiga nunca substitui o cache
- Depois do clique, monitora diretamente o valor exibido na aba "Menores precos"; espera minima `FLIGHT_PRICE_SETTLE_MS=20000`, estabilidade `FLIGHT_PRICE_STABLE_MS=5000` e limite `FLIGHT_PRICE_TIMEOUT_MS=30000`
- O valor da aba e salvo como uma linha-resumo em `price_cache`, com detalhes de voo nulos, e passa a ser a referencia principal exibida no card
- A linha-resumo e os voos detalhados sao inseridos no Supabase em um unico lote para preservar o tempo da funcao Vercel
- Reabre o Chromium e tenta novamente se o Google fechar a pagina durante a navegacao; padrao `FLIGHT_NAVIGATION_ATTEMPTS=2`
- Na Vercel, compartilha a extracao de `/tmp/chromium`, espera o executavel estabilizar e repete apenas o launch em caso de `ETXTBSY`; padrao `CHROMIUM_LAUNCH_ATTEMPTS=4`
- Reutiliza cache com menos de 3h30
- Processa notificacoes pelo cache em `price_cache`
- Mantem filtros por alerta: `horario_minimo` e `so_direto`

### `api/scrape-flight.js`

- Chamada pelo botao de atualizar na pagina de Voos
- Recebe `{ origem, destino, data_ida, data_volta }`
- Valida o usuario pelo token Supabase enviado pelo frontend
- Roda Playwright e SerpAPI em paralelo, salva os dois resultados em `price_cache` e retorna o menor preco global
- Clica na aba "Menores precos" do Google Flights antes de ler a lista
- Valida a selecao e a sincronizacao da lista com o preco anunciado na aba antes de gravar no Supabase
- Antes de ler os voos, espera o valor da aba "Menores precos" permanecer estavel e grava esse valor diretamente no cache
- Trata a corrida de extracao do Chromium na Vercel sem expor o log tecnico completo ao usuario
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
