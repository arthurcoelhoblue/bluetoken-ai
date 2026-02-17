
# Multi-Empresa por Usuario -- Plano de Implementacao

## Resumo

Permitir que usuarios acessem multiplas empresas simultaneamente. O switcher na sidebar vira multi-select com checkboxes e todas as queries passam a usar `.in('empresa', [...])` em vez de `.eq('empresa', ...)`.

---

## Fase 1: Banco de Dados (1 migration SQL)

### 1.1 Alterar constraint da tabela `user_access_assignments`

```sql
-- Remover constraint de unicidade por user_id (permite multiplas linhas)
ALTER TABLE user_access_assignments
  DROP CONSTRAINT user_access_assignments_user_id_key;

-- Nova constraint: unico por user_id + empresa
ALTER TABLE user_access_assignments
  ADD CONSTRAINT user_access_assignments_user_empresa_key
  UNIQUE (user_id, empresa);

-- Empresa obrigatorio
ALTER TABLE user_access_assignments
  ALTER COLUMN empresa SET NOT NULL;
```

### 1.2 Nova funcao `get_user_empresas()` (retorna array)

```sql
CREATE OR REPLACE FUNCTION public.get_user_empresas(_user_id uuid)
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(array_agg(empresa::text), ARRAY[]::text[])
  FROM public.user_access_assignments
  WHERE user_id = _user_id
$$;
```

Manter `get_user_empresa()` retornando o primeiro valor (compatibilidade com triggers).

### 1.3 Atualizar 107 RLS policies em 53 tabelas

Substituir em todas:
- `= get_user_empresa(auth.uid())` por `= ANY(get_user_empresas(auth.uid()))`
- `COALESCE(get_user_empresa(...), empresa)` por `= ANY(get_user_empresas(...))`

### 1.4 Inserir registros multi-empresa para usuarios existentes

```sql
-- Arthur, Filipe, Mychel: adicionar TOKENIZA (ja tem BLUE)
INSERT INTO user_access_assignments (user_id, access_profile_id, empresa, assigned_by)
SELECT user_id, access_profile_id, 'TOKENIZA', assigned_by
FROM user_access_assignments
WHERE empresa = 'BLUE'
  AND user_id NOT IN (
    '8a8e4b55-b967-4739-aaf0-61386775cf08',  -- Roney
    '8d01da56-85a6-424d-9329-7636f4db6dca'   -- Gabriel
  )
ON CONFLICT DO NOTHING;
```

---

## Fase 2: Frontend (contexto + switcher + hooks)

### 2.1 `src/contexts/CompanyContext.tsx`

Novo estado:

```text
activeCompanies: string[]     -- empresas selecionadas pelo usuario
userCompanies: string[]       -- empresas disponiveis (do banco)
setActiveCompanies(companies) -- setter
activeCompany: string         -- atalho para o primeiro (compatibilidade)
```

Carregar `userCompanies` via query na tabela `user_access_assignments` ao montar. LocalStorage guarda o array selecionado.

### 2.2 `src/components/layout/CompanySwitcher.tsx`

Trocar dropdown de selecao unica por checkboxes. Mostrar apenas as empresas do usuario. Pelo menos uma deve estar marcada.

### 2.3 Atualizar 21 hooks + 2 componentes

Todos os arquivos que fazem `const { activeCompany } = useCompany()` e `.eq('empresa', activeCompany)` passam a usar `activeCompanies` e `.in('empresa', activeCompanies)`.

Arquivos afetados:

| # | Arquivo | Mudanca |
|---|---------|---------|
| 1 | `useContactsPage.ts` | `.eq` para `.in` |
| 2 | `useContacts.ts` | `.eq` para `.in` |
| 3 | `usePipelines.ts` | `.eq` para `.in` |
| 4 | `useTemplates.ts` | `.eq` para `.in` |
| 5 | `useCustomFields.ts` | `.eq` para `.in` |
| 6 | `useCSSurveys.ts` | `.eq` para `.in` |
| 7 | `useCSIncidents.ts` | `.eq` para `.in` |
| 8 | `useCSMetrics.ts` | `.eq` para `.in` |
| 9 | `useCSRevenueForecast.ts` | `.eq` para `.in` |
| 10 | `useNotifications.ts` | `.eq` para `.in` |
| 11 | `useAmeliaLearnings.ts` | `.eq` para `.in` (3 ocorrencias) |
| 12 | `useSdrIaStats.ts` | `.eq` para `.in` (3 ocorrencias) |
| 13 | `useAutoRules.ts` | `.eq` para `.in` |
| 14 | `useOrganizations.ts` | `.eq` para `.in` |
| 15 | `useOrganizationsPage.ts` | `.eq` para `.in` |
| 16 | `useCadenciasCRM.ts` | `.eq` para `.in` |
| 17 | `useCSCustomers.ts` | `.eq` para `.in` |
| 18 | `useWorkbench.ts` | `.eq` para `.in` (4 funcoes) |
| 19 | `useAnalytics.ts` | edge function body |
| 20 | `GlobalSearch.tsx` | `.eq` para `.in` |
| 21 | `CSCustomerCreateDialog.tsx` | adaptar |

Todas as `queryKey` incluirao `activeCompanies` (array) em vez de `activeCompany`.

### 2.4 `src/types/accessControl.ts`

Atualizar `UserWithAccess` para ter `assignments: UserAccessAssignment[]` (array) em vez de `assignment: UserAccessAssignment | null`.

### 2.5 `src/hooks/useAccessControl.ts`

- `useUsersWithProfiles`: agrupar multiplos assignments por usuario
- `useAssignProfile`: upsert com `onConflict: 'user_id,empresa'`
- `useRemoveAssignment`: aceitar empresa especifica ou todas

### 2.6 `src/components/settings/AssignProfileDialog.tsx`

Trocar select de empresa por checkboxes multi-select. Ao salvar, inserir/remover linhas conforme empresas marcadas/desmarcadas.

### 2.7 `src/components/settings/UserAccessList.tsx`

Mostrar multiplos badges de empresa por usuario. Adaptar para o novo formato `assignments[]`.

---

## Fase 3: Edge Functions

### 3.1 `supabase/functions/_shared/tenant.ts`

Adicionar `extractEmpresas()` que retorna `EmpresaTipo[]`. Manter `extractEmpresa()` como atalho.

### 3.2 Edge functions que recebem empresa no body

Nenhuma mudanca necessaria. O frontend continuara enviando a empresa selecionada no body. CRONs ja usam `forEachEmpresa`.

---

## Ordem de execucao

1. Migration SQL (constraint + funcao + 107 policies + dados)
2. CompanyContext + CompanySwitcher (multi-select)
3. Tipos + hooks de access control
4. 21 hooks (`.eq` para `.in`)
5. Deploy edge functions
6. Testar end-to-end

---

## Nota sobre o futuro

A arquitetura suporta novas empresas facilmente: basta inserir na tabela `user_access_assignments` e o usuario ja ve no switcher. Para "grupos de empresas" separados (venda para terceiros), a separacao sera por base de dados ou schema diferente -- nao afeta esta mudanca.
