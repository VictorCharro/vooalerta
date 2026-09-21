# Viagem Alerta

Alertas de preço de **passagens aéreas** e **ônibus**. Você cadastra uma rota, as datas e quanto quer pagar; o sistema acompanha o preço e avisa no **WhatsApp** quando ele cai abaixo da sua meta.

Produção: [viagemalerta.vercel.app](https://viagemalerta.vercel.app)

---

## O que faz

- **Voos** — compara o menor preço entre **MaxMilhas** e **Google Flights** (aba "Menores preços"), ida ou ida e volta.
- **Ônibus** — acompanha o menor preço na **Buser**.
- **Filtros por alerta** — horário mínimo de partida da ida e "só voo direto".
- **Atualização manual** — botão ↻ em cada card, com fila e cooldown de 30 min por rota (voos).
- **Notificação no WhatsApp** via CallMeBot, com trava de 6h pra não repetir.
- **Compartilhar** um alerta por link público.
- Cards reordenáveis arrastando, tema claro/escuro.

## Arquitetura

```text
                 ┌──────────────────────────┐
  navegador ───► │ Angular (Vercel)         │ ── lê preços/alertas ──► Supabase
                 └───────────┬──────────────┘                        (Postgres + RLS
                             │ ↻ atualizar                             + Realtime)
                             ▼                                            ▲
                 ┌──────────────────────────┐   cria/consulta job         │
                 │ Vercel Functions         │ ─── refresh_jobs ──────────►│
                 │ api/scrape-flight        │                             │
                 │ api/job-status           │                             │
                 └──────────────────────────┘                             │
                                                                          │
                 ┌──────────────────────────┐   pega job, coleta,         │
                 │ Worker (Render)          │ ─── salva price_cache ─────►│
                 │ sempre ligado, 1 job/vez │                             │
                 └──────────────────────────┘                             │
                                                                          │
                 ┌──────────────────────────┐   coleta todas as rotas,    │
                 │ GitHub Actions (cron)    │ ─── envia WhatsApp ────────►│
                 │ voos a cada 3h           │
                 │ ônibus a cada hora       │
                 └──────────────────────────┘
```

A coleta de voos usa **Playwright** (Chromium headless). Por isso ela não roda nas Vercel Functions — que têm limite de 60s — e sim no worker e no cron. As functions só enfileiram e consultam jobs.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Angular 21 (standalone, `@if`/`@for`), PrimeNG |
| Banco / auth | Supabase (Postgres, RLS, Realtime, Edge Functions) |
| Coleta | Node.js + Playwright; SerpAPI como fallback do Google |
| Hospedagem | Vercel (site + functions), Render (worker), GitHub Actions (cron) |
| Notificação | CallMeBot (WhatsApp) |

## Rodando localmente

Requisitos: Node 20+ e um projeto Supabase com as migrations aplicadas.

```bash
npm install
```

**Frontend.** Os arquivos `src/environments/environment*.ts` não vêm no repositório (são gerados no build). Crie-os a partir das variáveis de ambiente:

```bash
SUPABASE_URL=... SUPABASE_KEY=... node scripts/generate-env.js
npm start
```

**Coleta (monitor de voos ou worker).** Precisa do Chromium do Playwright e das chaves do backend como variáveis de ambiente:

```bash
npx playwright install chromium
node backend/monitor.js   # uma rodada completa, como o cron
npm run worker            # worker da fila, como no Render
```

> Nunca commite chaves. `src/environments/*.ts` e `.env` já estão no `.gitignore`.

## Variáveis de ambiente

Apenas os nomes — os valores ficam nos painéis de cada serviço.

| Variável | Onde | Para quê |
|---|---|---|
| `SUPABASE_URL` | Vercel, Render, GitHub Actions | URL do projeto Supabase |
| `SUPABASE_KEY` | Vercel | chave pública (anon), usada no build do Angular |
| `SUPABASE_SERVICE_KEY` | Vercel, Render, GitHub Actions | chave `service_role`, só no servidor |
| `SERPAPI_KEY` | Render, GitHub Actions | fallback do Google Flights |
| `PLAYWRIGHT_BROWSERS_PATH=0` | Render, GitHub Actions | instala o Chromium dentro do projeto |

Variáveis opcionais de ajuste do worker e da coleta estão em [doc.md](doc.md).

## Banco de dados

As migrations ficam em [`supabase/migrations/`](supabase/migrations) e são aplicadas **em ordem**, pelo SQL Editor do Supabase. As 008–010 são históricas (a tabela que criavam é removida pela 015).

## Estrutura

```text
src/app/          frontend Angular (features: voos, onibus, share, auth)
api/              Vercel Functions: enfileirar e consultar job de atualização
backend/          scraper de voos, monitores de voos e ônibus
worker/           worker da fila (Render)
supabase/         migrations e Edge Function da Buser
scripts/          geração dos environments no build
.github/workflows cron dos monitores
```

## Limitações conhecidas

- **O preço pode não bater com o que você vê logado no Google.** O Google mostra preços diferentes pra contas logadas; a coleta enxerga o preço público (sem login). Ela serve pra acompanhar tendência e disparar o alerta — e costuma ser igual ou um pouco maior que o da sua sessão.
- O **horário mínimo** vale só pra ida.

## Documentação

Detalhes de arquitetura, tabelas, fluxo da fila, decisões e histórico de problemas: **[doc.md](doc.md)**.
