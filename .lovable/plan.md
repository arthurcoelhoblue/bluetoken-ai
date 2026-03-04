

# Avaliação da Auditoria — O que faz sentido e o que não faz

## Itens já corrigidos (não precisam de ação)

**#1 CORS** — Já corrigido nesta sessão. O `ameliacrm.com.br` já está no `ALLOWED_ORIGINS` e todas as funções foram redeployadas.

**#9 SENTRY_DSN_EDGE** — Já está configurado nos secrets. A auditoria está errada neste ponto.

**#3 ZADARMA_API_KEY** — Não está nos secrets, mas isso é esperado se a telefonia não está ativa para todos os tenants. Não é um erro crítico, é uma configuração pendente. Não vou mexer nisso.

---

## Itens que NÃO fazem sentido

**#2 verify_jwt = true** — A auditoria está **incorreta** aqui. O projeto usa signing-keys do Supabase Cloud, e `verify_jwt = true` **não funciona** com signing-keys (conforme documentação). O padrão correto é exatamente o que está implementado: `verify_jwt = false` no config.toml + validação manual via `getUser()` ou `getClaims()` dentro do código. Mudar para `true` quebraria TODAS as funções.

**#6 gemini-3-pro-preview "inexistente"** — A auditoria está **incorreta**. O modelo `gemini-3-pro-preview` existe e é um modelo válido da Google (é o preview do Gemini 3 Pro). O código está correto.

**#13 retry: 2 mascarando erros** — Isso é comportamento padrão e saudável. Queries de rede falham por razões transitórias. Remover retry pioraria a experiência do usuário. Não faz sentido mexer.

**#18 .env commitado** — O `.env` é gerenciado automaticamente pelo Lovable Cloud e não contém secrets. Contém apenas URLs públicas e a anon key (que é pública por design). Não é um problema de segurança.

**#11 Redirects legados** — Não é um problema funcional. São redirects de migração que funcionam corretamente. Baixa prioridade, não vale o esforço agora.

**#14 Google Calendar env sem fallback** — O erro 500 é retornado corretamente quando as variáveis não estão configuradas. Não é um problema real — as variáveis estão nos secrets.

---

## Itens que FAZEM sentido — Plano de implementação

### Fase 1: Quick wins (baixo risco, alto impacto)

**#4 — Cliente Supabase duplicado no cadence-runner**
- Arquivo: `supabase/functions/cadence-runner/index.ts` linha 449
- Substituir `const supabaseCheck = createServiceClient()` por usar o parâmetro `supabase` já passado à função `dispararMensagem`

**#8 — FALLBACK_ORIGIN apontando para domínio legado**
- Arquivo: `supabase/functions/_shared/cors.ts` linha 6
- Mudar `FALLBACK_ORIGIN` de `"https://sdrgrupobue.lovable.app"` para `"https://ameliacrm.com.br"` (o domínio de produção real)

**#12 — Dois Toasters simultâneos**
- Remover `<Toaster />` (Radix) do `App.tsx`, manter apenas `<Sonner />`
- Migrar os 3 arquivos que ainda usam `useToast` (Radix) para `toast()` do Sonner:
  - `src/components/whatsapp/WhatsAppTestButton.tsx`
  - `src/pages/MonitorSgtEvents.tsx`
  - `src/hooks/useCadenceEditor.ts`

### Fase 2: Resiliência (médio esforço)

**#7 — COST_TABLE duplicada no copilot-chat**
- O `copilot-chat/index.ts` tem sua própria `COST_TABLE` local. Importar a do `_shared/ai-provider.ts` em vez de duplicar. (Porém, o copilot-chat faz streaming próprio com Claude Haiku direto, sem usar `callAI`, então a COST_TABLE local serve um propósito — vou consolidar exportando do shared.)

**#16 — enrichGeralContext sem timeout**
- Envolver o `enrichmentPromise` em `Promise.race` com timeout de 8s no `copilot-chat/index.ts`, similar ao que já é feito com `coachingPromise` (4s)

**#17 — Lock otimista de 5 min no cadence-runner**
- Aumentar o lock de 5 para 10 minutos e adicionar um guard no início da execução que verifica se a run já foi processada (idempotency check)

### Fase 3: UX (baixo impacto)

**#10 — SMS como código morto**
- Adicionar aviso visual no editor de cadências quando o canal SMS é selecionado, informando que não está disponível

**#15 — copilot-chat sem validação de auth**
- A função já faz `getUser()` mas prossegue com `userId = undefined` se falhar. Adicionar retorno 401 explícito quando o token é inválido.

---

## Resumo: 9 itens para implementar, 7 descartados

| # | Item | Ação | Esforço |
|---|------|------|---------|
| 4 | Supabase client duplicado | Remover instanciação extra | 2 min |
| 8 | FALLBACK_ORIGIN legado | Atualizar para ameliacrm.com.br | 1 min |
| 12 | Dois Toasters | Remover Radix, migrar 3 arquivos para Sonner | 10 min |
| 7 | COST_TABLE duplicada | Exportar do shared, importar no copilot-chat | 5 min |
| 16 | enrichment sem timeout | Adicionar Promise.race 8s | 3 min |
| 17 | Lock otimista curto | Aumentar para 10min + idempotency check | 5 min |
| 10 | SMS código morto | Aviso no editor de cadências | 5 min |
| 15 | copilot-chat sem auth guard | Retornar 401 em token inválido | 2 min |

Todas as edge functions modificadas serão redeployadas ao final.

