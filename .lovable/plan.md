#  Fase F — Polimento Final (Auditoria V1.0 Estavel)

O relatório da Manus AI de 16/02/2026 atribui nota 8.5/10 de maturidade e aponta itens de polimento organizados em 3 prioridades. Este plano resolve todos.

---

## Prioridade 0: Bloqueadores

### P0.1 — Corrigir teste CompanyContext.test.tsx

O teste esta funcional e o codigo do CompanyContext tambem. A falha provavelmente e causada por falta do ambiente `localStorage` no setup do vitest. Preciso investigar se o `jsdom` esta configurado corretamente no `vitest.config.ts` e se ha algum import faltando. Se o teste realmente falhar no runner, a correcao sera ajustar o setup ou o teste.

**Arquivo**: `src/contexts/CompanyContext.test.tsx` e possivelmente `vitest.config.ts`

### P0.2 — Vulnerabilidades de dependencias

O relatorio menciona 8 vulnerabilidades (4 altas, 4 moderadas) em `react-router` e `esbuild`. O Lovable nao permite rodar `npm audit fix` diretamente, mas posso atualizar as versoes no `package.json` para resolver as vulnerabilidades conhecidas.

**Arquivo**: `package.json` (atualizar versoes de react-router-dom e esbuild se aplicavel)

---

## Prioridade 1: Consistencia e Boas Praticas

### P1.1 — Padronizar Logging no sgt-webhook (31 console.log -> createLogger)

O `sgt-webhook` e seus modulos (`index.ts`, `normalization.ts`, `validation.ts`) usam ~31 `console.log/error/warn` diretos enquanto todas as outras funcoes usam o `createLogger`. A correcao e mecanica:


| Arquivo                        | console.* | Acao                                                                                                                                                                                                              |
| ------------------------------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sgt-webhook/index.ts`         | ~20       | Adicionar `import { createLogger }` e `const log = createLogger('sgt-webhook')`. Substituir `console.log('[SGT Webhook]...')` por `log.info(...)`, `console.error` por `log.error`, `console.warn` por `log.warn` |
| `sgt-webhook/normalization.ts` | ~8        | Criar `const log = createLogger('sgt-webhook/normalization')` e substituir                                                                                                                                        |
| `sgt-webhook/validation.ts`    | ~1        | Criar `const log = createLogger('sgt-webhook/validation')` e substituir                                                                                                                                           |


### P1.2 — Padronizar tokeniza-offers com _shared/config.ts

O relatorio menciona que `tokeniza-offers` nao usa `config.ts`. Verificando o codigo, a funcao ja usa `createLogger` mas nao usa `createServiceClient` porque nao precisa do Supabase — ela apenas faz fetch para uma API externa. Portanto, esta "inconsistencia" e benigna. Nenhuma acao necessaria.

### P1.3 — Completar .env.example

O arquivo atual tem apenas 3 variaveis. Precisa incluir as variaveis de backend tambem:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id

# Backend (Edge Functions) — configurar no painel de secrets
SGT_WEBHOOK_SECRET=your-sgt-webhook-secret
ANTHROPIC_API_KEY=your-anthropic-key
OPENAI_API_KEY=your-openai-key
GOOGLE_API_KEY=your-google-key
CRON_SECRET=your-cron-secret
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=your-smtp-password
SMTP_FROM=noreply@example.com
WHATSAPP_API_KEY=your-whatsapp-key
WHATSAPP_INBOUND_SECRET=your-whatsapp-inbound-secret
BLUECHAT_API_KEY=your-bluechat-key
BLUECHAT_API_KEY_BLUE=your-bluechat-blue-key
MENSAGERIA_API_KEY=your-mensageria-key
PIPEDRIVE_API_TOKEN=your-pipedrive-token
```

---

## Prioridade 2: Melhoria Continua (parcial)

### P2.1 — Resolver comentarios TODO/FIXME

A busca revelou que nao existem comentarios `// TODO` ou `// FIXME` no codigo. Os 8 mencionados no relatorio provavelmente foram contados em uma versao anterior ou sao falsos positivos da palavra "Todos" (texto de UI em portugues). Nenhuma acao necessaria.

### P2.2 — Nota sobre Record<string, unknown> e as unknown as

O relatorio menciona 135 `Record<string, unknown>` e 15 `as unknown as` como "proxima fronteira". Estes sao padroes seguros e corretos para dados dinamicos do Supabase (joins, payloads JSON). Substituir por tipos Zod seria um esforco grande com retorno marginal neste momento. Recomendo manter como item de backlog.

---

## Sequencia de Execucao

1. Investigar e corrigir `CompanyContext.test.tsx`
2. Completar `.env.example` com todas as variaveis
3. Substituir 31 `console.*` no `sgt-webhook` por `createLogger`
4. Verificar build e testes

## Resultado Esperado

- 0 testes falhando
- Logging 100% padronizado (createLogger em todas as funcoes)
- `.env.example` completo com todas as 17 secrets
- Scorecard: Testes 7->8, Maturidade 8.5->9.0