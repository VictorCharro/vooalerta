# Backend — GitHub Actions

O monitoramento roda automaticamente via GitHub Actions a cada hora.

## Como funciona

```
GitHub Actions (cron a cada hora)
        ↓
backend/monitor.js
        ↓
Busca rotas únicas no Supabase
        ↓
Cache recente? → usa cache | Não → busca Serpapi e salva
        ↓
Filtra voos por horário mínimo e voo direto
        ↓
Preço <= meta? → verifica se já notificou nas últimas 6h
        ↓
Envia WhatsApp via CallMeBot + registra notificação
```

## Configurar secrets no GitHub

Vai em **Settings → Secrets and variables → Actions** e adiciona:

| Secret | Onde obter |
|---|---|
| `SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `SUPABASE_SERVICE_KEY` | Supabase → Settings → API → service_role key |
| `SERPAPI_KEY` | [serpapi.com](https://serpapi.com) → Dashboard |
| `CALLMEBOT_KEY` | Recebido via WhatsApp ao ativar o CallMeBot |

## Rodar manualmente

No GitHub: **Actions → VooAlerta — Monitoramento de Passagens → Run workflow**

Útil para testar sem esperar o próximo cron.

## Logs

Cada execução fica em **Actions** no GitHub com logs detalhados de cada rota e alerta processado.

## Estrutura do script

```
backend/
└── monitor.js   ← lógica completa de monitoramento
```

O script não tem dependências externas — usa apenas o `fetch` nativo do Node 20.
