# VooAlerta — doc.md

Documentação de referência do projeto. Atualizar sempre que houver mudanças estruturais.

---

## Visão geral

Aplicação de alertas de preço para **voos** e **ônibus (Buser)**. O usuário cadastra uma rota + meta de preço e recebe notificação no WhatsApp quando o preço cai abaixo da meta.

- **Frontend:** Angular 21 standalone, PrimeNG (tema customizado) + Supabase JS client
- **Backend:** Node.js — cron via GitHub Actions, worker sempre ligado no Render (fila de atualização manual) e Vercel Functions leves (enfileirar/consultar job)
- **Fontes de preço (voos):** MaxMilhas e Google Flights (Playwright, SerpAPI como fallback)
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
│   │   ├── shadows.css     # Tokens de sombra (--shadow-hard-pink/gray, --shadow-soft, --shadow-toast)
│   │   ├── base.css
│   │   ├── components.css  # btn-primary, btn-ghost, btn-icon, inputs, error-box, toggle, etc. (legado, pré-PrimeNG)
│   │   └── main.css        # @import theme → shadows → base → components
│   └── app/
│       ├── app.routes.ts                  # Rotas Angular
│       ├── app.config.ts                  # providePrimeNG com o preset customizado
│       ├── core/
│       │   ├── guards/auth.guard.ts       # authGuard + guestGuard
│       │   ├── theme/vooalerta-preset.ts  # preset de tema do PrimeNG
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
│   ├── monitor_onibus.js   # Monitor de ÔNIBUS — scraping Buser → Supabase → CallMeBot
│   └── README.md           # Resumo do backend (aponta pra esta doc)
├── worker/
│   └── index.js            # Worker sempre ligado (Render) — processa a fila refresh_jobs, sem limite de 60s
├── scripts/
│   └── generate-env.js     # Gera src/environments/*.ts a partir de SUPABASE_URL/SUPABASE_KEY no build da Vercel
├── vercel.json             # Build, rewrites da SPA e maxDuration das functions
├── .github/workflows/
│   ├── monitor.yml         # Cron voos: a cada 3h
│   └── monitor_onibus.yml  # Cron ônibus: a cada hora, nos :30
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
        ├── 008_scrape_lock.sql / 009_scrape_lock_rename_column.sql / 010_maxmilhas_lock.sql  # OBSOLETAS — criavam a tabela scrape_lock (lock por linha única). Substituídas pela fila em refresh_jobs (011). Removidas pela 015.
        ├── 011_refresh_jobs.sql                  # fila de atualização manual de preços — processada pelo worker (Render), não mais dentro da function da Vercel
        ├── 012_refresh_jobs_grant_delete.sql     # grant de delete em refresh_jobs pra service_role (limpeza de jobs antigos)
        ├── 013_alerts_ordem.sql                  # coluna ordem em alerts, pro drag-and-drop de reordenar os cards de voo
        ├── 013_profiles_nome.sql                 # coluna nome em profiles + trigger, usada no "Olá, {nome}!" (numeração colidiu com a de cima, ambas coexistem sem problema)
        ├── 014_limpar_cache_antigo_grant_e_cron.sql  # grant explícito + tenta agendar limpar_cache_antigo() via pg_cron (a cada hora); acionamento garantido é a chamada do RPC ao final de cada rodada do monitor.js
        ├── 015_drop_scrape_lock.sql              # remove a tabela órfã scrape_lock (ver 008/009/010)
        ├── 016_bus_alerts_ordem.sql              # coluna ordem em bus_alerts, mesmo drag-and-drop da tela de Ônibus
        ├── 017_refresh_jobs_user_id.sql          # coluna user_id em refresh_jobs — o dono do job, pra /api/job-status não entregar job de outro usuário
        └── 018_price_history.sql                 # tabela price_history (append-only) — histórico de preço por rota, que o price_cache não guarda
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
- **`alerts`** — alertas do usuário (origem IATA, destino IATA, data_ida, data_volta, meta, horario_minimo, so_direto, whatsapp, ativo, ordem). `ordem` guarda a posição do card definida no arrastar-e-soltar (null = ordena por `criado_em`). RLS: cada usuário só vê/edita os próprios; leitura pública por ID liberada (página de share).
- **`price_cache`** — voos coletados no Google Flights e na MaxMilhas (preco, companhia, horario_partida, horario_chegada, escalas, link, etc.). Uma rota/data tem várias linhas, uma por voo. O preço anunciado na aba "Menores preços" do Google só vira uma linha própria (sem horário/companhia/escalas) quando **nenhum** voo coletado tem exatamente aquele valor — aí ela significa "existe algo mais barato que não conseguimos identificar". RLS: leitura pública, escrita só via `service_role`. Linhas com mais de 24h sem atualização são apagadas por `limpar_cache_antigo()`, chamada ao final de cada rodada do `monitor.js` (e, se `pg_cron` estiver disponível no projeto, também a cada hora — migration 014).
- **`price_history`** — append-only: uma linha por coleta bem-sucedida, com o menor preço e a fonte vencedora (`maxmilhas`/`google`). Existe porque o `price_cache` guarda só a foto do momento — a cada coleta as linhas da rota são substituídas e o histórico se perderia. É a base pro gráfico de tendência e pro alerta de queda (#149). RLS igual à do `price_cache`: leitura pública, escrita só via `service_role`.
- **`notifications`** — controle anti-spam 6h por alerta
- **`profiles`** — whatsapp + callmebot_key por usuário
- **`refresh_jobs`** — fila de atualização manual (status `pending` → `processing` → `done`/`error`, com preco/link/fontes do resultado). Tem `user_id` (o dono do job): `/api/job-status` filtra por ele, então ninguém lê o resultado de job alheio, e o reaproveitamento de job em cliques repetidos é por rota **e** por usuário. Sem policies públicas: só `service_role` lê/escreve (via `api/*` e worker).

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
- **Histórico:** chegamos a testar `"regions": ["gru1"]` (São Paulo) na Vercel pra tentar aproximar o preço coletado do visto numa sessão pessoal — não resolveu.
- **Por que o preço do app nunca bate com o do seu navegador logado** (medido em 2026-09-16, rota GRU→POA 30/10→03/11, tudo no mesmo intervalo de minutos): Google no navegador **logado** do usuário = R$ 344; Google pelo **mesmo link, mesma conexão residencial, deslogado** = R$ 389; **SerpAPI** (servidores deles) = R$ 389; MaxMilhas = R$ 371. Ou seja: **a diferença vem da sessão logada no Google, não do IP** — isso corrige a suposição anterior de que era IP de datacenter vs. residencial, já que a coleta rodando da própria internet do usuário também viu 389. Proxy residencial **não** resolveria. Alcançar os R$ 344 exigiria autenticar na conta Google do usuário (frágil e contra os termos), então fica aceito como está: o preço coletado serve pra acompanhar tendência e disparar alerta, e tende a ser igual ou maior que o da sessão pessoal. O caminho pra baixar o número coletado é **mais fontes**, não mais rede — a MaxMilhas já provou isso ao bater o Google nessa mesma medição.

### Variáveis do worker (Render)
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` — mesmas do resto do backend
- `SERPAPI_KEY` — fallback do Google Flights
- `PLAYWRIGHT_BROWSERS_PATH=0` — **obrigatória**: faz o Chromium ser instalado dentro de `node_modules` no build, senão o runtime não encontra o executável
- `WORKER_POLL_INTERVAL_MS` (padrão 4000) — intervalo entre checagens da fila
- `WORKER_JOB_STALE_MS` (padrão 600000 = 10min) — depois de quanto tempo um job `done`/`error` é apagado
- `WORKER_JOB_PROCESSING_TIMEOUT_MS` (padrão 300000 = 5min) — job em `processing` há mais que isso é considerado travado e vira `error`
- `WORKER_REAPER_INTERVAL_MS` (padrão 60000) — frequência da checagem de jobs travados
- `WORKER_HEALTH_STALE_MS` (padrão 5× o poll = 20s) — se o loop não roda há mais que isso, `/health` responde 503
- `FLIGHT_PRICE_STABLE_MS`, `MAXMILHAS_PRICE_STABLE_MS` (opcionais) — endurecem o critério de estabilidade da leitura de preço se a coleta começar a pegar valores intermediários
- `PORT` — porta do health check (o Render define automaticamente)
- Build no Render: precisa instalar o Chromium com `npx playwright install chromium` **sem** `--with-deps` (o Render não permite `su`/apt no build — com a flag, o deploy falha com `su: Authentication failure`). Start: `npm run worker` (equivale a `node worker/index.js`).

### Rodando local
`src/environments/environment.ts` (e `environment.prod.ts`) não existem no repo (gitignored). Pra rodar `npm start` local, criar esses dois arquivos manualmente com `supabaseUrl`/`supabaseKey` reais do projeto (Supabase → Settings → API) — ou exportar `SUPABASE_URL`/`SUPABASE_KEY` e rodar `node scripts/generate-env.js`. Nunca commitar esses arquivos — o `.gitignore` já bloqueia, mas vale checar `git status` depois de criar/editar.

O backend lê as chaves de variáveis de ambiente (não há `dotenv`). Um `.env` na raiz é ignorado pelo Git e pode ser usado pra guardar valores de teste local, mas precisa ser carregado manualmente no shell/script.

---

## Monitores (backend)

### `monitor.js` — Voos
- Fontes combinadas em `buscarTodasFontes` (`backend/flight_scraper.js`): **MaxMilhas** primeiro, depois **Google Flights** (Playwright, com SerpAPI como fallback), sempre em sequência. O menor preço entre as fontes que responderam é o que vai pro cache/alerta; o `link` salvo aponta pro site de origem do preço vencedor (Google ou MaxMilhas).
- Agendamento: controlado **só pelo cron** (`monitor.yml`, atualmente a cada 3h). O script coleta sempre que é executado — não há gate de orçamento interno.
- **Google Flights**: SerpAPI (`deep_search=true`, `show_hidden=true`) é usada **só como fallback** quando o Playwright falha ou não retorna nenhum voo — não é combinada com ele. O preço do Playwright vem da aba "Menores preços" real do Google; o preço da SerpAPI (`best_flights` + `other_flights`) equivale à aba "Melhor opção" e não deve substituir um resultado válido do Playwright. Seleciona a aba "Menores preços" antes de coletar (confirmando `aria-selected="true"`) e só aceita a lista quando o menor voo coincide com o preço anunciado nela. O preço anunciado é casado com os voos coletados (`comPrecoAnunciado`): se algum voo tem exatamente aquele valor — o caso comum — ele já carrega o preço com horário, companhia e escalas, e nenhuma linha extra é criada. Antes era sempre criada uma linha órfã sem esses campos, que furava os filtros de horário e só-direto e ainda disputava o desempate por preço, fazendo a companhia exibida no detalhe do alerta virar sorteio. A saída do settle depende **só da estabilidade** da leitura — `FLIGHT_PRICE_STABLE_MS=5000`, limite `FLIGHT_PRICE_TIMEOUT_MS=30000`. O piso fixo de espera que existia antes (`FLIGHT_PRICE_SETTLE_MS=20000`) foi removido: fazia toda coleta custar 20s mesmo com o valor já estável desde o primeiro segundo. Reabre o Chromium se o Google fechar a página durante a navegação (`FLIGHT_NAVIGATION_ATTEMPTS=2`).
- **MaxMilhas** (`buscarMaxMilhas`): navega direto pra URL de busca (`https://www.maxmilhas.com.br/busca-passagens-aereas/{RT|OW}/{origem}/{destino}/{data_ida}[/{data_volta}]/1/0/0/EC`), sem precisar clicar em aba — os resultados já vêm ordenados "Mais baratos primeiro" por padrão. Lê o **total da oferta** num `<b>`/`<strong>` dentro de `.content-price` (ignorando o preço cheio riscado em `.line-through` e a quebra tarifa/desconto/taxas, que ficam em `<span>`), esperando ele **estabilizar** — `MAXMILHAS_PRICE_STABLE_MS=3000`, `MAXMILHAS_PRICE_TIMEOUT_MS=25000`.
- A MaxMilhas lista, junto da oferta, **os voos de ida aos quais aquele preço se aplica** (seção com cabeçalho `Ida - <dia> <data>` em `.header-stretch`, linhas em `.bound`). O scraper emite **uma linha por voo de ida**, todas com o mesmo preço, cada uma com `horario_partida`/`horario_chegada`/`duracao_min`/`escalas`. Isso é o que permite a MaxMilhas competir em alertas com `horario_minimo` — antes ia uma linha única sem horário, descartada pelo filtro (ver #143). Há uma guarda de direção (a primeira sigla IATA da linha tem que ser a origem) pra os voos de volta não vazarem, e um fallback pra linha única sem horário caso o layout mude e nenhum voo seja extraído.
- Se uma fonte falhar ou não achar nada, a outra ainda atualiza o cache; a falha fica registrada como aviso em `fontes`/`warning`. Se as duas falharem, `refreshFlightPrice` cai pro último preço salvo em `price_cache` pra rota em vez de propagar erro.
- Cache: reutiliza dados com menos de 3h30 de idade (evita duplicar em disparo manual logo após o cron). `salvarCache` insere as linhas novas **antes** de apagar as antigas da rota, pra nunca haver janela sem preço nem perda do cache se o insert falhar.
- Filtros por alerta. Na tela o critério fica num lugar só (`aplicaFiltrosDoAlerta`, usado por `getMinPriceRowForRoute` e `getMinPriceDetailsForRoute`) e o `monitor.js` aplica o mesmo na notificação — antes estava duplicado e as cópias divergiram (#145). Campo nulo significa "não sei", não "serve":
  - `horario_minimo` — **só da ida**. Com horário definido, só contam linhas com `horario_partida` conhecido e `>=` ao pedido; linhas sem horário (a "a partir de" do Google) ficam de fora. Se nenhum voo coletado qualificar, a rota fica sem preço.
  - `so_direto` — exige `escalas` conhecido e igual a zero (#146).
- Todos os parâmetros que entram em filtros do PostgREST (`origem`, `destino`, datas, `job_id`) são validados (IATA de 3 letras, `AAAA-MM-DD`, uuid) e codificados antes de montar a query, já que essas chamadas rodam com `service_role`.
- Rodar manualmente: ver seção "Rodando local" acima — precisa de `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SERPAPI_KEY` como variáveis de ambiente, depois `npx playwright install chromium && node backend/monitor.js`

### Fila de atualização manual (`refresh_jobs` + worker no Render)
Histórico do problema: o botão de atualizar rodava a coleta dentro da function da Vercel, que tem 60s de limite total. Sob refresh simultâneo (vários alertas/usuários ao mesmo tempo), isso causava dois problemas: (1) a MaxMilhas não tinha tempo de estabilizar o preço direito e coletava valores errados; (2) a própria function da Vercel podia travar por timeout/memória, retornando uma página de erro não-JSON que vazava como mensagem técnica pro usuário. Tentamos consertar com locks (`scrape_lock`, migrations 008-010) pra evitar coletas simultâneas, mas isso só limitava o problema, não dava tempo de verdade pra cada fonte — e ainda tinha o teto de 60s como parede.

**Solução:** tirar o scraping de dentro da function da Vercel e mover pra um worker sempre ligado, sem limite de tempo:

1. **`api/scrape-flight.js`** (Vercel, rápido, sem Playwright): recebe o clique do botão, cria uma linha em `refresh_jobs` com `status='pending'` (ou reaproveita um job pendente/em andamento recente pra mesma rota, pra não duplicar em cliques repetidos) e devolve o `job_id` na hora.
2. **`worker/index.js`** (Render, processo sempre ligado): fica em loop (`WORKER_POLL_INTERVAL_MS`, padrão 4s) pegando o job `pending` mais antigo, chamando `refreshFlightPrice` (mesma função do cron — MaxMilhas + Google) e salvando o resultado como `done` (ou `error`). Processa **um job por vez**. Detalhes de robustez:
   - **Claim atômico:** o job só passa pra `processing` via `PATCH ... &status=eq.pending` — se outra instância já pegou, volta vazio e ninguém processa em dobro.
   - **Reaper:** a cada `WORKER_REAPER_INTERVAL_MS`, jobs presos em `processing` há mais de `WORKER_JOB_PROCESSING_TIMEOUT_MS` (worker morreu no meio) viram `error`.
   - **Chromium compartilhado:** uma única instância do browser é reaproveitada entre fontes e entre jobs (`getSharedBrowser`); cada coleta abre e fecha só a página. Fechado no `SIGTERM`/`SIGINT`.
   - **`/health`** responde `ok` se o loop rodou recentemente e **503** se travou (`WORKER_HEALTH_STALE_MS`) — assim o UptimeRobot detecta worker parado de verdade.
   - `unhandledRejection`/`uncaughtException` são logados e encerram o processo com erro, pra o Render reiniciar.
3. **UptimeRobot** pinga esse `/health` a cada poucos minutos pra não deixar o serviço gratuito do Render dormir por inatividade.
4. **`api/job-status.js`** (Vercel): consulta o status/resultado de um `job_id`.
5. **Frontend** (`voos.component.ts`): clique no botão → enfileira → consulta o status a cada 4s (até ~10min, fora da zone do Angular pra não re-renderizar a tela inteira a cada tick) → atualiza o card quando o job terminar. Nenhuma mensagem técnica chega ao usuário — em erro/timeout o preço anterior continua na tela, sem toast.
6. **Realtime:** o card também escuta mudanças em `price_cache`, com debounce de 1s (uma coleta gera dezenas de eventos; sem o debounce os preços ficavam "piscando").

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
- **Cooldown:** 30 minutos por rota, rastreado em `localStorage` com chave `flight_refresh_{orig}_{dest}_{data}_{volta}`. Clicar em ↻ **dentro** da janela de cooldown não enfileira coleta nova — só relê o preço já salvo em `price_cache` (via `getMinPriceRowForRoute`) e atualiza a tela na hora, sem gastar coleta à toa.

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

`providePrimeNG` é registrado em `app.config.ts` com `options.darkModeSelector: false`. O app só tem tema escuro — o toggle de tema claro/escuro e as variáveis `html[data-theme="light"]` foram removidos de vez (não era usado e não estava nos planos ter tema claro). O botão de favoritos na sidebar continua desabilitado, até ser implementado de verdade.

Fonte `Mulish` (Google Fonts, carregada em `src/index.html`) é usada especificamente no título de saudação ("Olá, {nome}! Qual será sua próxima viagem?") das páginas de Voos e Ônibus; o resto do texto continua em Inter (`--font-display`/`--font-body`).

**Sombras — tokens em `src/styles/shadows.css`** (importado em `main.css` depois de `theme.css`): não usar valores literais de sombra direto no CSS de componente, usar os tokens.
```css
--shadow-hard-pink: 0 4px 0 0 var(--color-accent-hover);  /* bloco solido, sem blur — pills/botoes rosa/ativos */
--shadow-hard-gray: 0 4px 0 0 var(--color-border);         /* idem, elementos cinza/inativos */
--shadow-soft:      0 3px 4px rgba(0, 0, 0, .4);            /* com blur — faixas do painel de detalhes */
--shadow-toast:     0 4px 16px rgba(0, 0, 0, .25);          /* toasts */
```

**Ícones:** os PNGs de `src/assets/icons/` (exportados do Figma) substituem emojis/glifos nos elementos redesenhados (logo, nav da sidebar, botões de ação, estado vazio, painel de detalhes). Ícones genéricos ainda não redesenhados podem usar PrimeIcons.

**Status do redesign (por tela):**
- **Voos** e **Ônibus**: mesmo design nas duas — cabeçalho de saudação, estado vazio, lista de cards (com drag-and-drop pra reordenar — coluna `ordem` em `alerts`/`bus_alerts`) e painel rápido de detalhes (`.content-row`/`.list-column`/`.quick-panel`/`.qp-*`, aberto pelo botão `»` do card) já redesenhados. O painel rápido do Ônibus não mostra "Companhia Aérea" (não existe nesse domínio); os outros campos são iguais aos de Voos. Modal de novo alerta/perfil e a tela de edição completa (aberta pelo botão "Editar" do painel) **ainda não foram redesenhados** — mantêm o CSS legado (`components.css`, classes `btn-primary`, `.section-title`, etc.).
- **Sidebar**: totalmente redesenhada (marca, nav com `pButton`, tema e sair). Modal de perfil embutido nela continua com o layout legado.
- **Login/Register/Share**: ainda não redesenhados.

Classes globais legadas em `src/styles/components.css` (`btn-primary`, `btn-ghost`, `btn-icon`, `spinner`, `error-box`, `success-box`, `form-hint`, `toggle`) continuam em uso nas partes ainda não migradas — não remover até o redesign cobrir tudo.
- O `.toggle` global (`components.css`) é a única definição — não duplicar em CSS de componente.
- Atenção ao nome de classe `.section-title`: já existe (legado, uppercase/muted) nos cabeçalhos do modal/painel de detalhe de Voos e Ônibus. O título de lista novo usa `.list-heading` propositalmente para não colidir.
- Botão `.open-btn` presente nos cards de voos e ônibus (Buser); também no detalhe de ambas as páginas. Em voos, o link aponta pro site da fonte que deu o menor preço (Google Flights ou MaxMilhas).
- Cards de voo e de ônibus podem ser reordenados arrastando pela alça (HTML5 drag-and-drop nativo — o CDK do Angular foi abandonado porque o preview do arraste travava no canto da tela). A nova ordem é salva em `alerts.ordem` / `bus_alerts.ordem`.

---

## Convenções

- Componentes standalone (sem NgModules), sem `standalone: true` explícito (é o padrão desde Angular 19)
- Control flow com sintaxe de bloco (`@if`/`@for`), não `*ngIf`/`*ngFor`
- Path aliases: `@core/`, `@features/`, `@shared/`, `@env/`
- Notificações WhatsApp sempre com prefixo `55` no banco; strip ao exibir
- Slugs do Buser seguem padrão `{cidade-normalizada}-{uf}` ex: `sao-paulo-sp`
- Alertas de voo e ônibus são **totalmente separados** — tabelas, serviços e componentes distintos, sem dependência cruzada
- `src/environments/environment.ts` e `environment.prod.ts` nunca são commitados (gitignored) — sempre confirmar `.gitignore` válido (UTF-8) antes de assumir que está protegido
