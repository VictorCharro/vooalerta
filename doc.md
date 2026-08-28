# VooAlerta — doc.md

Documentação de referência do projeto. Atualizar sempre que houver mudanças estruturais.

---

## Visão geral

Aplicação de alertas de preço para **voos** e **ônibus (Buser)**. O usuário cadastra uma rota + meta de preço e recebe notificação no WhatsApp quando o preço cai abaixo da meta.

- **Frontend:** Angular 21 standalone, PrimeNG (tema customizado) + Supabase JS client
- **Backend:** Node.js scripts via GitHub Actions (cron) e Vercel Functions (on-demand)
- **Banco:** Supabase (Postgres + RLS + Realtime)
- **Notificações:** CallMeBot (WhatsApp gratuito)
- **Produção:** [viagemalerta.vercel.app](https://viagemalerta.vercel.app)

---

## Estrutura de arquivos

```
vooalerta/
├── src/
│   ├── environments/                      # environment.ts / environment.prod.ts — gitignored, gerados no build (Vercel) ou preenchidos localmente
│   ├── assets/icons/                      # Ícones PNG exportados do Figma (avião, ônibus, perfil, favorito, lightmode, etc.)
│   ├── styles/
│   │   ├── theme.css       # Variáveis CSS (cores, espaçamentos, radius) — paleta do Figma
│   │   ├── base.css
│   │   ├── components.css  # btn-primary, btn-ghost, btn-icon, inputs, error-box, toggle, etc. (legado, pré-PrimeNG)
│   │   └── main.css
│   └── app/
│       ├── app.routes.ts                  # Rotas Angular
│       ├── app.config.ts                  # providePrimeNG com o preset customizado
│       ├── core/
│       │   ├── guards/auth.guard.ts       # authGuard + guestGuard
│       │   ├── models/
│       │   │   ├── alert.model.ts         # Interface Alert (voos)
│       │   │   └── user.model.ts
│       │   ├── theme/
│       │   │   └── vooalerta-preset.ts    # Preset PrimeNG (definePreset sobre Aura) com as cores do Figma
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
├── api/
│   ├── scrape-flight.js   # Vercel Function — so enfileira um job de refresh (nao raspa mais nada)
│   └── job-status.js      # Vercel Function — consulta o status/resultado de um job
├── backend/
│   ├── flight_scraper.js   # Coleta Google Flights (Playwright + SerpAPI) e MaxMilhas (Playwright) + cache Supabase
│   ├── monitor.js          # Monitor de VOOS — cron → Supabase → CallMeBot
│   └── monitor_onibus.js   # Monitor de ÔNIBUS — scraping Buser → Supabase → CallMeBot
├── worker/
│   └── index.js            # Worker sempre ligado (Render) — processa a fila refresh_jobs, sem limite de 60s
├── .github/workflows/
│   ├── monitor.yml         # Cron voos: a cada 3h
│   └── monitor_onibus.yml  # Cron ônibus: 9h30, 13h30, 17h30, 21h30 BRT
└── supabase/
    ├── functions/scrape-buser/  # Edge Function — atualização manual de ônibus
    └── migrations/
        ├── 001_initial_schema.sql               # alerts, price_cache, notifications, views
        ├── 002_price_cache.sql                  # função limpar_cache_antigo
        ├── 002_share_policy.sql                 # policy de leitura pública de alerts por ID (página de share)
        ├── 003_profiles_and_fix_view.sql        # profiles, trigger new user, fix alerts_ativos
        ├── 004_bus_alerts.sql                    # bus_alerts, bus_price_cache, bus_notifications, views
        ├── 005_grants_service_role.sql           # grants select/insert/update/delete para service_role
        ├── 006_fix_flight_cache_service_role_grants.sql  # reforço de grants do price_cache para service_role
        ├── 007_price_cache_rls.sql               # habilita RLS em price_cache e bus_price_cache (select público, escrita só via service_role)
        ├── 008_scrape_lock.sql / 009_scrape_lock_rename_column.sql / 010_maxmilhas_lock.sql  # OBSOLETAS — criavam a tabela scrape_lock (lock por linha única). Substituídas pela fila em refresh_jobs (011). Podem ficar órfãs no banco, sem problema; o código não usa mais scrape_lock.
        └── 011_refresh_jobs.sql                  # fila de atualização manual de preços — processada pelo worker (Render), não mais dentro da function da Vercel
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
- **`alerts`** — alertas do usuário (origem IATA, destino IATA, data_ida, data_volta, meta, horario_minimo, so_direto, whatsapp, ativo). RLS: cada usuário só vê/edita os próprios; leitura pública por ID liberada (página de share).
- **`price_cache`** — voos encontrados pelo Playwright/SerpAPI no Google Flights (preco, companhia, horario_partida, escalas, etc.). RLS: leitura pública, escrita só via `service_role`.
- **`notifications`** — controle anti-spam 6h por alerta
- **`profiles`** — whatsapp + callmebot_key por usuário

### Tabelas de ônibus (separadas, sem conflito)
- **`bus_alerts`** — alertas do usuário (origem/destino nome + slug Buser, meta, whatsapp)
- **`bus_price_cache`** — preço mínimo raspado do Buser por rota/data. RLS: leitura pública, escrita só via `service_role`.
- **`bus_notifications`** — controle anti-spam 6h por alerta

### Views
- `alerts_ativos` — alertas de voo ativos com callmebot_key (join profiles)
- `rotas_unicas` — rotas únicas de voo para o monitor
- `bus_alerts_ativos` — alertas de ônibus ativos com callmebot_key
- `bus_rotas_unicas` — rotas únicas de ônibus para o monitor

### Secrets GitHub Actions necessários
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `SERPAPI_KEY`

### Variáveis Vercel necessárias
- `SUPABASE_URL`
- `SUPABASE_KEY` — anon/public key usada no build do Angular
- `SUPABASE_SERVICE_KEY` ou `SUPABASE_SERVICE_ROLE_KEY` — service_role key usada por `/api/scrape-flight` e `/api/job-status` pra ler/escrever `refresh_jobs`
- Aliases aceitos pela API: `NEXT_PUBLIC_SUPABASE_URL`, `VITE_SUPABASE_URL`, `SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `VITE_SUPABASE_ANON_KEY`
- Desde a fila (worker no Render), as functions da Vercel **não abrem mais navegador nenhum** — só leem/escrevem `refresh_jobs`. `SERPAPI_KEY` e Playwright deixaram de ser necessários na Vercel (continuam necessários no worker e no cron). `vercel.json` não define mais `regions` nem `memory` nessas functions — não fazem mais sentido sem scraping ali.
- **Histórico:** chegamos a testar `"regions": ["gru1"]` (São Paulo) na Vercel pra tentar aproximar o preço coletado do visto numa sessão residencial — não resolveu (o preço de datacenter continuou mais alto que o de IP residencial, mesmo rodando fisicamente no Brasil). Isso é uma limitação de IP datacenter vs. residencial, não de região geográfica; só proxy residencial resolveria, e não foi contratado. Aceito como está — o preço coletado (Google e MaxMilhas) ainda serve pra acompanhar tendência e disparar alerta, só não bate exatamente com uma sessão pessoal logada.

### Variáveis do worker (Render)
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` — mesmas do resto do backend
- `SERPAPI_KEY` — fallback do Google Flights
- `WORKER_POLL_INTERVAL_MS` (padrão 4000) — intervalo entre checagens da fila
- `WORKER_JOB_STALE_MS` (padrão 600000 = 10min) — depois de quanto tempo um job `done`/`error` é apagado
- `PORT` — porta do health check (o Render define automaticamente)

### Rodando local
`src/environments/environment.ts` (e `environment.prod.ts`) não existem no repo (gitignored). Pra rodar `npm start` local, criar esses dois arquivos manualmente com `supabaseUrl`/`supabaseKey` reais do projeto (Supabase → Settings → API). Nunca commitar esses arquivos — o `.gitignore` já bloqueia, mas vale checar `git status` depois de criar/editar.

---

## Monitores (backend)

### `monitor.js` — Voos
- Fontes combinadas em `buscarTodasFontes` (`backend/flight_scraper.js`): **MaxMilhas** primeiro, depois **Google Flights** (Playwright, com SerpAPI como fallback), sempre em sequência. O menor preço entre as fontes que responderam é o que vai pro cache/alerta; o `link` salvo aponta pro site de origem do preço vencedor (Google ou MaxMilhas).
- Agendamento: controlado **só pelo cron** (`monitor.yml`, atualmente a cada 3h). O script coleta sempre que é executado — não há gate de orçamento interno.
- **Google Flights**: SerpAPI (`deep_search=true`, `show_hidden=true`) é usada **só como fallback** quando o Playwright falha ou não retorna nenhum voo — não é combinada com ele. O preço do Playwright vem da aba "Menores preços" real do Google; o preço da SerpAPI (`best_flights` + `other_flights`) equivale à aba "Melhor opção" e não deve substituir um resultado válido do Playwright. Seleciona a aba "Menores preços" antes de coletar e só aceita a lista quando o menor voo coincide com o preço anunciado nela; espera mínima `FLIGHT_PRICE_SETTLE_MS=20000`, estabilidade `FLIGHT_PRICE_STABLE_MS=5000`, limite `FLIGHT_PRICE_TIMEOUT_MS=30000`. Reabre o Chromium se o Google fechar a página durante a navegação (`FLIGHT_NAVIGATION_ATTEMPTS=2`).
- **MaxMilhas** (`buscarMaxMilhas`): navega direto pra URL de busca (`https://www.maxmilhas.com.br/busca-passagens-aereas/{RT|OW}/{origem}/{destino}/{data_ida}[/{data_volta}]/1/0/0/EC`), sem precisar clicar em aba — os resultados já vêm ordenados "Mais baratos primeiro" por padrão. Lê o preço no primeiro `<strong>` com `R$` no painel de resumo, esperando ele **estabilizar** (mesma ideia do Google: fica lendo até o valor parar de mudar) — `MAXMILHAS_PRICE_SETTLE_MS=8000`, `MAXMILHAS_PRICE_STABLE_MS=3000`, `MAXMILHAS_PRICE_TIMEOUT_MS=25000`. Antes disso era só um `waitForTimeout` fixo de 3-4s, que sob concorrência (ou até sem ela, se a página demorasse a carregar) podia capturar um preço incompleto/errado.
- Se uma fonte falhar ou não achar nada, a outra ainda atualiza o cache; a falha fica registrada como aviso em `fontes`/`warning`. Se as duas falharem, `refreshFlightPrice` cai pro último preço salvo em `price_cache` pra rota em vez de propagar erro.
- Cache: reutiliza dados com menos de 3h30 de idade (evita duplicar em disparo manual logo após o cron)
- Filtros por alerta: `horario_minimo`, `so_direto`
- Rodar manualmente: ver seção "Rodando local" acima — precisa de `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SERPAPI_KEY` como variáveis de ambiente, depois `npx playwright install chromium && node backend/monitor.js`

### Fila de atualização manual (`refresh_jobs` + worker no Render)
Histórico do problema: o botão de atualizar rodava a coleta dentro da function da Vercel, que tem 60s de limite total. Sob refresh simultâneo (vários alertas/usuários ao mesmo tempo), isso causava dois problemas: (1) a MaxMilhas não tinha tempo de estabilizar o preço direito e coletava valores errados; (2) a própria function da Vercel podia travar por timeout/memória, retornando uma página de erro não-JSON que vazava como mensagem técnica pro usuário. Tentamos consertar com locks (`scrape_lock`, migrations 008-010) pra evitar coletas simultâneas, mas isso só limitava o problema, não dava tempo de verdade pra cada fonte — e ainda tinha o teto de 60s como parede.

**Solução:** tirar o scraping de dentro da function da Vercel e mover pra um worker sempre ligado, sem limite de tempo:

1. **`api/scrape-flight.js`** (Vercel, rápido, sem Playwright): recebe o clique do botão, cria uma linha em `refresh_jobs` com `status='pending'` (ou reaproveita um job pendente/em andamento recente pra mesma rota, pra não duplicar em cliques repetidos) e devolve o `job_id` na hora.
2. **`worker/index.js`** (Render, processo sempre ligado): fica em loop (`WORKER_POLL_INTERVAL_MS`, padrão 4s) pegando o job `pending` mais antigo, marcando como `processing`, chamando `refreshFlightPrice` (mesma função do cron — MaxMilhas + Google, com calma, sem pressa de tempo) e salvando o resultado como `done` (ou `error`). Processa **um job por vez** — não precisa mais de lock/fila no banco, porque só existe um worker rodando. Expõe um endpoint HTTP simples (`/health`) só pra responder "ok" a quem pingar.
3. **UptimeRobot** pinga esse `/health` a cada poucos minutos pra não deixar o serviço gratuito do Render dormir por inatividade.
4. **`api/job-status.js`** (Vercel): consulta o status/resultado de um `job_id`.
5. **Frontend** (`voos.component.ts`): clique no botão → enfileira → fica consultando o status a cada 3s (até ~2min) → atualiza o card quando o job terminar. Nenhuma mensagem técnica chega ao toast — sempre um texto genérico em caso de erro/timeout.

Isso elimina de vez o teto de 60s pro scraping em si (o worker não tem esse limite) e a necessidade de lock (só um processo raspa por vez, por natureza). O cron (`monitor.js`, GitHub Actions) continua funcionando à parte, sem depender da fila — ele já é sequencial por conta própria.

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

### `api/scrape-flight.js` / `api/job-status.js` — Vercel Functions (on-demand)
- Chamadas pelo botão ↻ na página de Voos pra atualizar o preço manualmente. Ver seção "Fila de atualização manual" acima pra arquitetura completa.
- `POST /api/scrape-flight`: recebe `{ origem, destino, data_ida, data_volta }`, cria (ou reaproveita) um job em `refresh_jobs`, devolve `{ job_id }` na hora — **não** raspa nada, não abre Playwright.
- `GET /api/job-status?job_id=...`: devolve `{ status, preco, link, fontes, warning, error }` do job.
- Quem processa de fato é o worker (`worker/index.js`, Render) — ver seção acima.
- **Cooldown:** 30 minutos por rota, rastreado em `localStorage` com chave `flight_refresh_{orig}_{dest}_{data}_{volta}`. Clicar em ↻ **dentro** da janela de cooldown não enfileira coleta nova — só relê o preço já salvo em `price_cache` (via `getMinPriceForRoute`) e atualiza a tela na hora, sem gastar coleta à toa.

---

## Design system

Redesign em andamento baseado no Figma, migrando de CSS custom pra **PrimeNG** (`primeng`, `@primeuix/themes`, `primeicons`). Paleta em `src/styles/theme.css` (variáveis CSS) e espelhada no preset do PrimeNG (`src/app/core/theme/vooalerta-preset.ts`, `definePreset` sobre o tema Aura):

```css
--color-accent:       #C6194D   /* rosa — botões primários, nav ativo */
--color-accent-hover: #6F132F   /* rosa sombra — hover/shadow projetada */
--color-bg:           #111010   /* preto — fundo da sidebar */
--color-bg-2:         #161616   /* cinza chumbo — fundo da área principal */
--color-bg-3:         #242323   /* cinza claro — cards, inputs, botões inativos da sidebar */
--color-border:       #232021   /* cinza claro sombra — bordas e sombra projetada dos botões inativos */
--color-text:         #E8E8E8   /* branco */
--color-text-muted:   #8B8B8B   /* texto de rotas/labels */
--color-green:        #09AE00   /* preço abaixo da meta */
--color-red:          #BB070A   /* preço acima da meta */
--color-amber:        #D17300
```

`providePrimeNG` é registrado em `app.config.ts` com `options.darkModeSelector: false` — o app só tem o tema escuro do Figma por enquanto (o toggle de tema claro/escuro existente é legado e está **temporariamente desabilitado** na sidebar, junto com o botão de favoritos, até serem implementados de verdade).

Fonte `Mulish` (Google Fonts, carregada em `src/index.html`) é usada especificamente no título de saudação ("Olá, {nome}! Qual será sua próxima viagem?") das páginas de Voos e Ônibus; o resto do texto continua em Inter (`--font-display`/`--font-body`).

**Convenção de sombra:** botões usam sombra "dura" (sem blur), tipo bloco sólido projetado embaixo — `box-shadow: 0 4px 0 0 <cor>`, usando a cor de sombra correspondente (`#6F132F` pra elementos rosa/ativos, `#232021` pra elementos cinza/inativos). Não usar `box-shadow` com blur nesse padrão.

**Ícones:** os PNGs de `src/assets/icons/` (exportados do Figma) substituem emojis/glifos nos elementos redesenhados (logo, nav da sidebar, botões de ação, estado vazio). Ícones genéricos ainda não redesenhados podem usar PrimeIcons.

**Status do redesign (por tela):**
- **Voos** e **Ônibus**: cabeçalho de saudação (`.greeting-header`/`.greeting-bar`/`.list-heading`) e estado vazio (`.empty-state`) já redesenhados com PrimeNG. Lista de cards, modal de novo alerta/perfil e painel de detalhe **ainda não foram redesenhados** — mantêm o CSS legado (`components.css`, classes `btn-primary`, `.section-title`, etc.).
- **Sidebar**: totalmente redesenhada (marca, nav com `pButton`, tema e sair). Modal de perfil embutido nela continua com o layout legado.
- **Login/Register/Share**: ainda não redesenhados.

Classes globais legadas em `src/styles/components.css` (`btn-primary`, `btn-ghost`, `btn-icon`, `spinner`, `error-box`, `success-box`, `form-hint`, `toggle`) continuam em uso nas partes ainda não migradas — não remover até o redesign cobrir tudo.
- Atenção ao nome de classe `.section-title`: já existe (legado, uppercase/muted) nos cabeçalhos do modal/painel de detalhe de Voos e Ônibus. O título de lista novo usa `.list-heading` propositalmente para não colidir.

---

## Convenções

- Componentes standalone (sem NgModules), sem `standalone: true` explícito (é o padrão desde Angular 19)
- Control flow com sintaxe de bloco (`@if`/`@for`), não `*ngIf`/`*ngFor`
- Path aliases: `@core/`, `@features/`, `@shared/`, `@env/`
- Notificações WhatsApp sempre com prefixo `55` no banco; strip ao exibir
- Slugs do Buser seguem padrão `{cidade-normalizada}-{uf}` ex: `sao-paulo-sp`
- Alertas de voo e ônibus são **totalmente separados** — tabelas, serviços e componentes distintos, sem dependência cruzada
- `src/environments/environment.ts` e `environment.prod.ts` nunca são commitados (gitignored) — sempre confirmar `.gitignore` válido (UTF-8) antes de assumir que está protegido
