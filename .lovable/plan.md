
# Fase E — Eliminacao de `any` + Correcao de Testes + .env.example

## Contexto

O relatorio de validacao final do PO (Manus AI, 16/02/2026) aponta 3 itens pendentes:
1. 4 testes de schema falhando (`schemas.test.ts`)
2. 150 `any` explicitos no codigo
3. Arquivo `.env.example` inexistente

Este plano resolve os 3 itens de uma vez.

---

## Item 1: Correcao dos 4 Testes de Schema

O `createDealSchema` exige `owner_id` (campo obrigatorio), mas os testes nao passam esse campo. Os 4 testes que falham sao todos do bloco `createDealSchema`:

- "accepts valid titulo + valor" — falta `owner_id`
- "rejects titulo < 2" — falta `owner_id`
- "rejects negative valor" — falta `owner_id`
- "defaults temperatura to FRIO" — falta `owner_id`

**Acao**: Adicionar `owner_id: 'test-user-id'` nos testes que precisam passar e validar que o campo e exigido com um teste adicional.

**Arquivo**: `src/schemas/__tests__/schemas.test.ts`

---

## Item 2: Eliminacao de `any` Explicitos

Inventario completo por arquivo (apenas os que tem `any` para corrigir):

### Backend (Edge Functions) — ~90 ocorrencias

| Arquivo | Qtd `any` | Estrategia |
|---|---|---|
| `copilot-chat/index.ts` | ~25 | Criar interfaces para params das funcoes `enrichLeadContext`, `enrichDealContext`, `enrichPipelineContext`, `enrichGeralContext`, `enrichCustomerContext` (trocar `supabase: any` por `SupabaseClient`). Trocar `(f: any)`, `(r: any)`, `(m: any)` por `Record<string, unknown>`. |
| `copilot-proactive/index.ts` | ~12 | Trocar `(d: any)`, `(a: any)`, `(s: any)` por `Record<string, unknown>`. Trocar `parsedInsights: any[]` por interface `CopilotInsight`. |
| `cs-playbook-runner/index.ts` | ~18 | Trocar `supabase: any` por `SupabaseClient`. Trocar `step: any` por interface `PlaybookStep`. Trocar `as any` nos `.update()` por tipagem correta. |
| `sdr-message-parser/index.ts` | ~12 | Trocar `historico: any[]` por interface `MessageRecord[]`. Trocar `(h: any)` por `Record<string, unknown>`. |
| `amelia-learn/index.ts` | ~10 | Trocar `learnings: any[]` por interface `AmeliaLearning[]`. Trocar `args: any` por interface. Trocar `(p.metadata as any)` por `Record<string, unknown>`. |
| `amelia-mass-action/index.ts` | ~5 | Trocar `(d: any)` por `Record<string, unknown>`. |
| Outros (6-8 funcoes menores) | ~8 | Trocar `catch (e: any)` por `catch (e: unknown)` e usar type guard. |

### Frontend (src/) — ~60 ocorrencias

| Arquivo | Qtd `any` | Estrategia |
|---|---|---|
| `pages/AmeliaMassActionPage.tsx` | ~25 | Criar tipo `DealWithRelations` baseado nos campos usados. Substituir todos os `(d: any)` por esse tipo. |
| `pages/ImportacaoPage.tsx` | ~6 | Trocar `(s: any)` por interface `StageWithPipeline`. Trocar `catch (e: any)` por `catch (e: unknown)`. |
| `pages/admin/ProductKnowledgeEditor.tsx` | ~4 | Trocar `onSave: (section: any) => Promise<any>` por tipo correto. |
| `hooks/useZadarma.ts` | ~3 | Trocar `(e: any)`, `(c: any)` por `Record<string, unknown>`. |
| `hooks/useLeadIntents.ts` | ~1 | Trocar `row: any` por interface `LeadIntentRow`. |
| `hooks/useDealDetail.ts` | ~1 | Trocar `(a: any)` por `Record<string, unknown>`. |
| `components/templates/TemplateFormDialog.tsx` | ~1 | Trocar `payload: any` por tipo inferido. |
| `components/contacts/CustomFieldsRenderer.tsx` | ~1 | Trocar `payload: any` por tipo especifico. |
| `components/contacts/ContactDetailSheet.tsx` | ~1 | Trocar `(d: any)` por tipo correto. |
| `components/organizations/OrgDetailSheet.tsx` | ~1 | Trocar `(c: any)` por tipo correto. |
| `components/settings/UserPermissionOverrideDialog.tsx` | ~1 | Trocar `catch (e: any)` por `catch (e: unknown)`. |
| `types/importacao.ts` | ~4 | Trocar `error_log: any[]` e `[key: string]: any` por tipos especificos. |
| `test/hooks/useCadences.test.ts` | ~5 | Trocar `any[]` e `Record<string, any>` por tipos concretos. |

### Padrao de substituicao

Para cada caso, a abordagem sera:

1. **`supabase: any`** -> `SupabaseClient` (import de `@supabase/supabase-js`)
2. **`(item: any)` em `.map()`/`.filter()`** -> `Record<string, unknown>` ou interface especifica quando os campos sao conhecidos
3. **`catch (e: any)`** -> `catch (e: unknown)` + `e instanceof Error ? e.message : String(e)`
4. **`as any` em `.insert()`/`.update()`** -> `as Record<string, unknown>` ou remover cast quando possivel
5. **`let x: any = {}`** -> interface especifica ou `Record<string, unknown>`
6. **`[key: string]: any`** -> `[key: string]: string | number | undefined`

---

## Item 3: Criar `.env.example`

Criar arquivo `.env.example` na raiz com as variaveis necessarias (sem valores reais):

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id
```

---

## Sequencia de Execucao

1. Corrigir `schemas.test.ts` (Item 1)
2. Criar `.env.example` (Item 3)
3. Eliminar `any` no backend — funcoes maiores primeiro (copilot-chat, cs-playbook-runner, copilot-proactive)
4. Eliminar `any` no backend — funcoes menores (sdr-message-parser, amelia-learn, etc.)
5. Eliminar `any` no frontend — paginas (AmeliaMassActionPage, ImportacaoPage)
6. Eliminar `any` no frontend — hooks e componentes
7. Eliminar `any` nos tipos (importacao.ts) e testes

## Risco

Baixo. Todas as substituicoes sao mecanicas — trocam anotacoes de tipo sem alterar logica. O `noImplicitAny` ja esta ativo no tsconfig, entao erros de compilacao serao detectados imediatamente.

## Resultado Esperado

- 0 testes falhando (vs. 4 hoje)
- ~0 `any` explicitos (vs. 150 hoje) — exceto `eslint-disable` justificados em mocks de teste
- `.env.example` presente na raiz
- Score de maturidade: Testes 6->8, Qualidade de Codigo 8->9
