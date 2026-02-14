
# Testes (3.6) -- Melhoria do Relatorio PO

## Resumo

O projeto possui apenas **5 arquivos de teste** com **~20 assertions** no total, todos focados em logica pura extraida de hooks. O item 3.6 do relatorio do PO pede ampliar a cobertura de testes para cobrir schemas Zod, logica de permissoes, utilitarios e configuracoes.

---

## Diagnostico: Estado Atual

| Arquivo | Tipo | Assertions |
|---------|------|-----------|
| `src/test/example.test.ts` | Placeholder | 2 |
| `src/hooks/useDeals.test.ts` | Logica Kanban | 5 |
| `src/hooks/useContacts.test.ts` | Logica filtros | 4 |
| `src/hooks/usePatch12.test.ts` | Logica aprovacao | 5 |
| `src/contexts/AuthContext.test.tsx` | Permissoes RBAC | 6 |
| **TOTAL** | | **~22** |

**Gaps identificados:**
- Zero testes para os 8 schemas Zod (auth, contacts, deals, users, knowledge, email, settings, captureForms)
- Zero testes para `screenRegistry` (getScreenByUrl, getScreensByGroup)
- Zero testes para logica de `buildPermissionsFromRoles` (nao exportada, mas replicavel)
- Zero testes para utilitarios (`src/lib/utils.ts`)

---

## Plano de Implementacao

### 1. Testes de Schemas Zod (~80 assertions)

Criar **`src/schemas/__tests__/schemas.test.ts`** cobrindo todos os 8 schemas:

**auth schemas:**
- `loginSchema`: aceita email+senha validos; rejeita email invalido; rejeita senha < 6 chars
- `signupSchema`: aceita dados completos; rejeita senhas diferentes (refine); rejeita nome < 2 chars; rejeita email invalido
- `forgotPasswordSchema`: aceita email valido; rejeita vazio

**contacts schemas:**
- `contactCreateSchema`: aceita nome valido; rejeita nome < 2; aceita email vazio (optional); rejeita email invalido; aceita CPF formatado e sem formato; rejeita CPF invalido
- `organizationCreateSchema`: aceita nome valido; rejeita nome < 2; aceita CNPJ 14 digitos; rejeita CNPJ invalido; valida estado max 2 chars

**deals schema:**
- `createDealSchema`: aceita titulo+valor; rejeita titulo < 2; rejeita valor negativo; default FRIO; aceita QUENTE

**users schema:**
- `createUserSchema`: aceita dados completos; rejeita email invalido; rejeita senha < 6; rejeita nome < 2

**knowledge schema:**
- `faqCreateSchema`: aceita pergunta >= 5 e resposta >= 10; rejeita pergunta < 5; rejeita resposta < 10

**email schema:**
- `sendEmailSchema`: aceita email+assunto+corpo; rejeita email invalido; rejeita assunto vazio; respeita max 200 no assunto

**settings schema:**
- `generalSettingsSchema`: aceita HH:MM valido; rejeita formato invalido; respeita min/max de max_por_dia (1-50); respeita min/max de intervalo_minutos

**captureForms schema:**
- `captureFormSaveSchema`: aceita form com fields; rejeita fields vazio; rejeita nome < 2

### 2. Testes de screenRegistry (~15 assertions)

Criar **`src/config/__tests__/screenRegistry.test.ts`**:

- `getScreenByUrl('/')` retorna dashboard
- `getScreenByUrl('/pipeline')` retorna pipeline
- `getScreenByUrl('/pipeline/123')` retorna pipeline (startsWith)
- `getScreenByUrl('/naoexiste')` retorna undefined
- `getScreensByGroup()` retorna todas as groups
- `SCREEN_REGISTRY` tem todas as keys unicas
- `SCREEN_GROUPS` nao tem duplicatas

### 3. Testes de RBAC expandidos (~20 assertions)

Expandir **`src/contexts/AuthContext.test.tsx`** com novos cenarios:

- SDR_IA tem permissao em leads, conversations, cadences, whatsapp
- MARKETING tem permissao em campaigns e analytics
- AUDITOR tem *:read em tudo mas nao write
- Multiplos roles combinados (CLOSER + MARKETING)
- READONLY so tem dashboard:read

### 4. Testes de utilitarios (~10 assertions)

Criar **`src/lib/__tests__/utils.test.ts`**:

- `cn()` combina classes corretamente
- `cn()` resolve conflitos Tailwind (merge)
- `cn()` ignora valores falsy

---

## Arquivos a Criar/Modificar

| Acao | Arquivo | Assertions |
|------|---------|-----------|
| Criar | `src/schemas/__tests__/schemas.test.ts` | ~80 |
| Criar | `src/config/__tests__/screenRegistry.test.ts` | ~15 |
| Modificar | `src/contexts/AuthContext.test.tsx` | +20 |
| Criar | `src/lib/__tests__/utils.test.ts` | ~10 |

## Impacto Esperado

- De **~22 assertions** para **~145+ assertions**
- Cobertura dos schemas Zod garante que as regras de validacao implementadas no item 4.4 estao corretas
- Testes de screenRegistry previnem regressoes na navegacao/permissoes
- Zero dependencia de Supabase ou APIs externas -- todos os testes sao unitarios puros
- Execucao rapida (< 2 segundos)

## Detalhes Tecnicos

- Vitest ja configurado com `jsdom`, `globals: true` e setup file
- Path alias `@/` ja funciona nos testes
- Padrao existente: `describe/it/expect` importados de `vitest`
- Sem necessidade de mocks de Supabase -- testes focam em logica pura e schemas
- Zod `.safeParse()` sera usado para testar aceitacao/rejeicao de schemas
