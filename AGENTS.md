# VooAlerta — AGENTS.md

Documento de referência para o Codex. Atualizar sempre que houver mudanças estruturais.

---

## Visão geral

Aplicação de alertas de preço para **voos** e **ônibus (Buser)**. O usuário cadastra uma rota + meta de preço e recebe notificação no WhatsApp quando o preço cai abaixo da meta.

- **Frontend:** Angular 17 standalone, Supabase JS client
- **Backend:** Node.js scripts rodando via GitHub Actions (cron)
- **Banco:** Supabase (Postgres + RLS + Realtime)
- **Notificações:** CallMeBot (WhatsApp gratuito)
- **Produção:** [viagemalerta.vercel.app](https://viagemalerta.vercel.app)

---

## Estrutura de arquivos

```
vooalerta/
├── src/
│   └── app/
│       ├── app.routes.ts                  # Rotas Angular
│       ├── app.config.ts
│       ├── core/
│       │   ├── guards/auth.guard.ts       # authGuard + guestGuard
│       │   ├── models/
│       │   │   ├── alert.model.ts         # Interface Alert (voos)
│       │   │   └── user.model.ts
│       │   └── services/
│       │       └── supabase.service.ts    # Toda comunicação com Supabase
│       ├── features/
│       │   ├── auth/
│       │   │   ├── login/
│       │   │   └── register/
│       │   ├── voos/
│       │   │   ├── voos.component.ts      # Página de alertas de VOO
│       │   │   └── voos.component.css
│       │   ├── onibus/
│       │   │   ├── onibus.component.ts    # Página de alertas de ÔNIBUS
│       │   │   └── onibus.component.css
│       │   └── share/
│       │       └── share.component.ts     # Página pública de compartilhamento
│       └── shared/
│           ├── components/
│           │   ├── airport-search/        # Autocomplete de aeroportos
│           │   ├── date-picker/
│           │   ├── time-picker/
│           │   └── sidebar/               # Sidebar + modal de perfil (compartilhado)
│           └── data/airports.ts           # Lista de aeroportos (IATA)
├── styles/
│   ├── theme.css       # Variáveis CSS (cores, espaçamentos, radius)
│   ├── base.css
│   ├── components.css  # btn-primary, btn-ghost, btn-icon, inputs, error-box, etc.
│   └── main.css
├── backend/
│   ├── flight_scraper.js   # Coleta Google Flights via Playwright + cache Supabase
│   ├── monitor.js          # Monitor de VOOS — Playwright → Supabase → CallMeBot
│   └── monitor_onibus.js   # Monitor de ÔNIBUS — scraping Buser → Supabase → CallMeBot
├── .github/workflows/
│   ├── monitor.yml         # Cron voos: a cada 3h
│   └── monitor_onibus.yml  # Cron ônibus: 9h30, 13h30, 17h30, 21h30 BRT
└── supabase/migrations/
    ├── 001_initial_schema.sql   # alerts, price_cache, notifications, views
    ├── 002_price_cache.sql      # função limpar_cache_antigo
    ├── 003_profiles_and_fix_view.sql  # profiles, trigger new user, fix alerts_ativos
    ├── 004_bus_alerts.sql       # bus_alerts, bus_price_cache, bus_notifications, views
    └── 005_grants_service_role.sql  # grants select/insert/update/delete para service_role em todas as tabelas e views
```

---

## Rotas Angular

| Path | Componente | Guard |
|---|---|---|
| `/` | redireciona para `/voos` | — |
| `/voos` | VoosComponent | authGuard |
| `/dashboard` | redireciona para `/voos` | — |
| `/onibus` | OnibusComponent | authGuard |
| `/login` | LoginComponent | guestGuard |
| `/register` | RegisterComponent | guestGuard |
| `/share/:id` | ShareComponent | — |
| `/**` | redireciona para `/voos` | — |

---

## Banco de dados (Supabase)

### Tabelas de voo
- **`alerts`** — alertas do usuário (origem IATA, destino IATA, data_ida, data_volta, meta, horario_minimo, so_direto, whatsapp, ativo)
- **`price_cache`** — voos encontrados pelo Playwright no Google Flights (preco, companhia, horario_partida, escalas, etc.)
- **`notifications`** — controle anti-spam 6h por alerta
- **`profiles`** — whatsapp + callmebot_key por usuário

### Tabelas de ônibus (separadas, sem conflito)
- **`bus_alerts`** — alertas do usuário (origem/destino nome + slug Buser, meta, whatsapp)
- **`bus_price_cache`** — preço mínimo raspado do Buser por rota/data
- **`bus_notifications`** — controle anti-spam 6h por alerta

### Views
- `alerts_ativos` — alertas de voo ativos com callmebot_key (join profiles)
- `rotas_unicas` — rotas únicas de voo para o monitor
- `bus_alerts_ativos` — alertas de ônibus ativos com callmebot_key
- `bus_rotas_unicas` — rotas únicas de ônibus para o monitor

### Secrets GitHub Actions necessários
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

### Variáveis Vercel necessárias
- `SUPABASE_URL`
- `SUPABASE_KEY` — anon/public key usada no build do Angular
- `SUPABASE_SERVICE_KEY` ou `SUPABASE_SERVICE_ROLE_KEY` — service_role key usada pela function `/api/scrape-flight` para gravar `price_cache`
- Aliases aceitos pela API: `NEXT_PUBLIC_SUPABASE_URL`, `VITE_SUPABASE_URL`, `SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `VITE_SUPABASE_ANON_KEY`

---

## Monitores (backend)

### `monitor.js` — Voos
- Fonte: Google Flights via Playwright (`backend/flight_scraper.js`)
- Agendamento: controlado **só pelo cron** (`monitor.yml`, atualmente a cada 3h). O script coleta sempre que é executado — não há gate de orçamento interno.
- Não usa mais `SERPAPI_KEY`.
- Seleciona a aba "Menores preços" no Google Flights antes de coletar.
- Confirma que a aba ficou selecionada e só aceita a lista quando o menor voo coincide com o preço anunciado nela; uma lista antiga nunca substitui o cache.
- Aguarda os preços do Google Flights assentarem antes de coletar; padrão `FLIGHT_PRICE_SETTLE_MS=10000`.
- Reabre o Chromium e tenta novamente se o Google fechar a página durante a navegação; padrão `FLIGHT_NAVIGATION_ATTEMPTS=2`.
- Cache: reutiliza dados com menos de 3h30 de idade (evita duplicar em disparo manual logo após o cron)
- Filtros por alerta: `horario_minimo`, `so_direto`

### `monitor_onibus.js` — Ônibus
- Fonte: scraping da página `buser.com.br/onibus/{origem-slug}/{destino-slug}?ida={data}`
- Extrai preço da meta tag `<meta property="product:price:amount" content="X">`
- Cache: reutiliza dados com menos de 3h30 de idade
- Sleep de 2s entre rotas para não sobrecarregar o Buser
- Roda **a cada hora** (cron `30 * * * *`), sem custo de API

### `supabase/functions/scrape-buser/` — Edge Function (on-demand)
- Chamada pelo botão ↻ na página de Ônibus para atualizar o preço manualmente
- Roda server-side (Deno) para evitar CORS ao buscar o Buser
- Recebe `{ origem_slug, destino_slug, data_ida, data_volta }`, salva em `bus_price_cache`
- Retorna `{ preco: number | null }`
- Deploy: `supabase functions deploy scrape-buser`
- **Cooldown:** 10 minutos por rota, rastreado em `localStorage` com chave `bus_refresh_{orig}_{dest}_{data}`; o botão exibe contagem regressiva "M:SS" enquanto não disponível

### `api/scrape-flight.js` — Vercel Function (on-demand)
- Chamada pelo botão ↻ na página de Voos para atualizar o preço manualmente
- Roda server-side para executar Playwright fora do browser Angular
- Recebe `{ origem, destino, data_ida, data_volta }`, salva em `price_cache`
- Retorna `{ preco: number | null }`
- Clica na aba "Menores preços" do Google Flights antes de ler a lista
- Valida a seleção e a sincronização da lista com o preço anunciado na aba antes de gravar no Supabase
- Antes de ler os voos, aguarda o delay de preços (`FLIGHT_PRICE_SETTLE_MS`) para o Google concluir a consulta em fornecedores
- **Cooldown:** 10 minutos por rota, rastreado em `localStorage` com chave `flight_refresh_{orig}_{dest}_{data}_{volta}`

---

## Design system

Todas as páginas usam variáveis CSS de `src/styles/theme.css`. As principais:

```css
--color-accent: #7c6dfa        /* roxo — botões primários, nav ativo */
--color-green:  #2dd4a0        /* preço abaixo da meta */
--color-red:    #f0605a        /* preço acima da meta */
--color-bg-2:   #111118        /* fundo de cards e sidebar */
--color-bg-3:   #18181f        /* fundo de inputs */
```

Tema claro disponível via `html[data-theme="light"]`, toggled por `localStorage('theme')`.

Classes globais reutilizáveis em `components.css`: `btn-primary`, `btn-ghost`, `btn-icon`, `spinner`, `error-box`, `success-box`, `form-hint`, `toggle` (switch).
- O `.toggle` global (`components.css`) é a única definição — não duplicar em CSS de componente.
- Botão `.open-btn` (link externo) presente nos cards de voos (Google Flights) e ônibus (Buser); também no detalhe de ambas as páginas.

---

## Convenções

- Componentes standalone (sem NgModules)
- Path aliases: `@core/`, `@features/`, `@shared/`, `@env/`
- Notificações WhatsApp sempre com prefixo `55` no banco; strip ao exibir
- Slugs do Buser seguem padrão `{cidade-normalizada}-{uf}` ex: `sao-paulo-sp`
- Alertas de voo e ônibus são **totalmente separados** — tabelas, serviços e componentes distintos, sem dependência cruzada
