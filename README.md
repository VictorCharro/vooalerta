# VooAlerta — Frontend

Angular 17 com Supabase. Site em produção: [vooalerta-seven.vercel.app](https://vooalerta-seven.vercel.app)

---

## Primeiro uso (clonou agora)

```bash
npm install
```

Depois preenche as credenciais do Supabase em `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  supabaseUrl: 'https://SEU_PROJETO.supabase.co',
  supabaseKey: 'SUA_ANON_KEY'
};
```

Depois roda:

```bash
npm start
# acesse http://localhost:4200
```

---

## Estrutura de pastas

```
src/
├── styles/
│   ├── main.css          ← importa tudo (referenciado no angular.json)
│   ├── theme.css         ← CORES E DESIGN — edite aqui para mudar o visual
│   ├── base.css          ← reset e elementos HTML
│   └── components.css    ← botões, inputs, cards, badges, toggles, etc.
│
├── environments/
│   ├── environment.ts      ← dev — preencha com suas credenciais locais
│   └── environment.prod.ts ← prod — credenciais do ambiente de produção
│
└── app/
    ├── core/
    │   ├── models/
    │   │   ├── alert.model.ts       ← interfaces Alert e AlertCreate
    │   │   └── user.model.ts        ← interface UserProfile
    │   ├── services/
    │   │   └── supabase.service.ts  ← toda comunicação com o Supabase
    │   └── guards/
    │       └── auth.guard.ts        ← authGuard e guestGuard
    │
    ├── features/
    │   ├── auth/
    │   │   ├── auth.styles.css  ← estilos compartilhados entre login e register
    │   │   ├── login/           ← página de login
    │   │   └── register/        ← página de cadastro
    │   └── dashboard/           ← painel principal de alertas
    │
    ├── shared/          ← componentes reutilizáveis (a adicionar conforme crescer)
    ├── app.routes.ts
    ├── app.config.ts
    └── app.component.ts
```

---

## Como mudar as cores

Edite **`src/styles/theme.css`** — todas as variáveis estão comentadas lá.

Exemplo — mudar o roxo para azul:
```css
--color-accent:       #3b82f6;
--color-accent-hover: #60a5fa;
--color-accent-dim:   rgba(59, 130, 246, 0.12);
```

---

## Problemas conhecidos

### Erro `Cannot find namespace 'NodeJS'`
Adiciona `"types": ["node"]` no `tsconfig.json` e no `tsconfig.app.json`:
```json
"compilerOptions": {
  "types": ["node"]
}
```
E instala:
```bash
npm install --save-dev @types/node
```

### Erro 403 ao salvar alertas
Rodar no SQL Editor do Supabase:
```sql
grant select, insert, update, delete on public.alerts to authenticated;
```

---

## Deploy no Vercel

O deploy é automático — qualquer push na branch `main` atualiza o site.

Para configurar pela primeira vez:
1. Conecta o repositório no Vercel
2. **Settings → Environment Variables** — adiciona:
    - `SUPABASE_URL` → URL do projeto Supabase
    - `SUPABASE_KEY` → anon key (começa com `eyJhbG...`)
3. Em `src/environments/environment.prod.ts` coloca as credenciais diretamente (a anon key é segura para commitar)
4. O `vercel.json` já está configurado para o roteamento do Angular funcionar

> ⚠️ Não usa `process.env` no `environment.prod.ts` — não funciona no browser.