
## Sprint de Qualidade: Auditoria RLS + Testes Automatizados

### Parte 1: Auditoria e Correção de Segurança RLS

#### Problema Atual

Todas as tabelas multi-tenant (com coluna `empresa`) permitem que qualquer usuario autenticado leia dados de TODAS as empresas. Exemplos criticos:

| Tabela | Policy SELECT atual | Risco |
|--------|-------------------|-------|
| `contacts` | `USING (true)` | Closer da TOKENIZA ve contatos BLUE |
| `deals` | `USING (true)` | Closer da TOKENIZA ve deals BLUE |
| `organizations` | `USING (true)` | Idem |
| `lead_messages` | Sem filtro empresa | Mensagens vazam entre empresas |
| `lead_contacts` | `Service ALL true` | Qualquer um manipula lead_contacts |
| `comissao_lancamentos` | `authenticated` sem filtro | Comissoes de todos visiveis |
| `metas_vendedor` | `authenticated` sem filtro | Metas de todos visiveis |

Alem disso, 20 policies usam `USING(true)` ou `WITH CHECK(true)` para INSERT/UPDATE/DELETE — qualquer usuario autenticado pode modificar dados.

#### Estrategia de Correcao

A abordagem e criar uma funcao `get_user_empresa()` que retorna a empresa do usuario logado via `user_access_assignments`, e usar essa funcao nas policies para filtrar por `empresa`. ADMIN continua vendo tudo.

**IMPORTANTE**: Como o sistema usa um `CompanySwitcher` no frontend (o usuario escolhe "Blue", "Tokeniza" ou "Todas"), o isolamento no RLS deve ser: usuarios com role ADMIN/AUDITOR veem tudo; demais usuarios so veem dados da empresa associada no `user_access_assignments`.

#### Migration SQL

1. Criar funcao `public.get_user_empresa(uuid)` SECURITY DEFINER que retorna a empresa do assignment do usuario
2. Substituir as 20+ policies permissivas por policies com filtro de empresa
3. Manter "Service" policies para edge functions (com `service_role`)
4. Manter ADMIN com acesso total

**Tabelas a corrigir (prioridade critica)**:
- `contacts` — SELECT/INSERT/UPDATE filtrar por empresa
- `deals` — SELECT filtrar via JOIN pipelines.empresa; INSERT/UPDATE restringir
- `organizations` — SELECT/INSERT/UPDATE filtrar por empresa
- `lead_contacts` — restringir "Service ALL" para service_role apenas
- `lead_messages` — restringir "Service ALL" para service_role apenas
- `lead_classifications` — restringir service policies
- `comissao_lancamentos` — SELECT filtrar por empresa
- `metas_vendedor` — SELECT filtrar por empresa
- `mass_action_jobs` — SELECT filtrar por empresa
- `closer_notifications` — filtrar por user_id em vez de true
- `deal_activities` — restringir "Service ALL" para service_role
- `pessoas` — restringir "Service ALL" para service_role

**Tabelas de menor risco (ja tem role check)**:
- `cadences`, `pipelines`, `pipeline_stages` — Admin-only write, ok
- `copilot_messages` — ja filtra por user_id, ok
- `import_jobs`, `import_mapping` — Admin-only, ok

#### Regras das novas policies

```text
-- Padrao para tabelas com empresa:
SELECT: ADMIN ve tudo; outros veem apenas empresa = get_user_empresa(auth.uid())
INSERT: empresa do registro = get_user_empresa(auth.uid()) OR is ADMIN
UPDATE: mesma regra
DELETE: apenas ADMIN

-- Padrao para tabelas sem empresa mas com dados sensiveis:
SELECT: filtrar por owner_id = auth.uid() OR is ADMIN
```

---

### Parte 2: Testes Automatizados

#### Infraestrutura

1. Criar `vitest.config.ts` na raiz
2. Criar `src/test/setup.ts` com mocks de matchMedia
3. Adicionar `"vitest/globals"` ao `tsconfig.app.json`
4. Instalar devDependencies: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`

#### Testes a Criar

| Arquivo | O que testa | Tipo |
|---------|------------|------|
| `src/hooks/useDeals.test.ts` | Query com filtros pipeline/owner/temperatura | Unit (mock supabase) |
| `src/hooks/useContacts.test.ts` | Filtro por empresa e busca | Unit (mock supabase) |
| `src/hooks/usePatch12.test.ts` | Criacao mass action, approval toggle, polling | Unit (mock supabase) |
| `src/components/ProjecaoStageCard.test.tsx` | Render com dados mock, toggles, barra tricolor | Component |
| `src/components/copilot/CopilotPanel.test.tsx` | Render, envio mensagem, quick suggestions | Component |
| `src/contexts/AuthContext.test.tsx` | hasRole, hasPermission, sign in/out | Unit (mock supabase) |
| `src/contexts/CompanyContext.test.tsx` | Switch empresa, persistencia localStorage | Unit |
| `src/test/example.test.ts` | Smoke test basico | Sanity |

**Padrao dos testes**: Cada teste mocka o `supabase` client para evitar dependencia de rede. Testes de componente usam `@testing-library/react` com `render` + `screen`.

---

### Secao Tecnica — Arquivos

| Arquivo | Acao |
|---------|------|
| Migration SQL | Criar (funcao get_user_empresa + ~30 policies) |
| `vitest.config.ts` | Criar |
| `src/test/setup.ts` | Criar |
| `tsconfig.app.json` | Editar (adicionar vitest/globals) |
| `src/hooks/useDeals.test.ts` | Criar |
| `src/hooks/useContacts.test.ts` | Criar |
| `src/hooks/usePatch12.test.ts` | Criar |
| `src/components/ProjecaoStageCard.test.tsx` | Criar |
| `src/components/copilot/CopilotPanel.test.tsx` | Criar |
| `src/contexts/AuthContext.test.tsx` | Criar |
| `src/contexts/CompanyContext.test.tsx` | Criar |
| `src/test/example.test.ts` | Criar |

### Ordem de Execucao

1. Migration SQL (funcao + policies) — correcao de seguranca primeiro
2. Infraestrutura de testes (vitest config + setup)
3. Testes unitarios dos hooks
4. Testes de componentes
5. Executar todos os testes para validar
