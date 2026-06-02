# Frontend — Angular 17

## Estrutura

```
src/
├── styles/
│   ├── main.css          ← importa tudo, referenciado no angular.json
│   ├── theme.css         ← VARIÁVEIS DE CORES E DESIGN — edite aqui
│   ├── base.css          ← reset e elementos HTML
│   └── components.css    ← botões, inputs, cards, badges, etc.
│
├── environments/
│   ├── environment.ts      ← dev (credenciais vazias, seguro commitar)
│   └── environment.prod.ts ← prod (gerado pelo Vercel, NÃO commitar)
│
└── app/
    ├── core/
    │   ├── models/
    │   │   ├── alert.model.ts    ← interfaces Alert, AlertCreate
    │   │   └── user.model.ts     ← interface UserProfile
    │   ├── services/
    │   │   └── supabase.service.ts  ← toda comunicação com Supabase
    │   └── guards/
    │       └── auth.guard.ts     ← authGuard + guestGuard
    │
    ├── features/
    │   ├── auth/
    │   │   ├── auth.styles.css   ← estilos compartilhados de login/register
    │   │   ├── login/            ← página de login
    │   │   └── register/         ← página de cadastro
    │   └── dashboard/            ← painel principal de alertas
    │
    ├── shared/               ← componentes reutilizáveis (a adicionar)
    ├── app.routes.ts
    ├── app.config.ts
    └── app.component.ts
```

## Como mudar as cores

Edite **`src/styles/theme.css`** — todas as variáveis estão comentadas.

Exemplo para mudar a cor de destaque de roxo para azul:
```css
--color-accent:       #3b82f6;
--color-accent-hover: #60a5fa;
--color-accent-dim:   rgba(59, 130, 246, 0.12);
```

## Rodar localmente

```bash
npm install
npm start
# http://localhost:4200
```

Preencha `src/environments/environment.ts` com suas credenciais do Supabase antes.

## Deploy no Vercel

1. Conecte o repositório no Vercel
2. Settings → Environment Variables → adicione `SUPABASE_URL` e `SUPABASE_KEY`
3. O `vercel.json` já está configurado para Angular SPA

O Vercel detecta automaticamente Angular e usa o comando `npm run build:prod`.
