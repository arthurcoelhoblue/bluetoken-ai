

# Etapa 1B + 3C: Hardening RLS Batch 2 + Hooks sem filtro

## Escopo

### Migracao SQL (Etapa 1B)

Analise das policies atuais revelou os seguintes gaps nas tabelas de suporte:

**Tabelas com ADMIN sem filtro empresa (precisam correcao):**

| Tabela | Policy atual | Correcao |
|--------|-------------|----------|
| `cadences` | `has_role(ADMIN)` sem empresa | Adicionar `AND empresa::text = get_user_empresa(auth.uid())` |
| `cadence_steps` | `has_role(ADMIN)` sem empresa | Via EXISTS em cadences (nao tem empresa direta) |
| `message_templates` | ADMIN ALL sem empresa | Adicionar filtro empresa |
| `custom_field_definitions` | ADMIN ALL sem empresa | Adicionar filtro empresa |
| `custom_field_values` | ADMIN ALL + CLOSER ALL sem empresa | Via EXISTS em custom_field_definitions |
| `product_knowledge` | ADMIN ALL sem empresa | Adicionar filtro empresa |
| `metas_vendedor` | ADMIN ALL sem empresa | Adicionar filtro empresa |
| `comissao_lancamentos` | ADMIN ALL sem empresa | Adicionar filtro empresa |
| `comissao_regras` | ADMIN ALL sem empresa | Adicionar filtro empresa |
| `follow_up_optimal_hours` | ADMIN ALL sem empresa | Adicionar filtro empresa |
| `integration_company_config` | ADMIN ALL sem empresa | Adicionar filtro empresa |
| `mass_action_jobs` | INSERT/UPDATE/DELETE sem empresa | Adicionar filtro empresa |
| `sgt_events` | ADMIN SELECT sem empresa | Adicionar filtro empresa |
| `sazonalidade_indices` | INSERT/UPDATE sem empresa | Adicionar filtro empresa |
| `import_jobs` | ADMIN ALL sem empresa | Adicionar filtro empresa |
| `import_mapping` | ADMIN ALL sem empresa | Adicionar filtro empresa |
| `zadarma_config` | ADMIN CRUD sem empresa | Adicionar filtro empresa |
| `zadarma_extensions` | ADMIN CRUD sem empresa (exceto SELECT ja ok) | Adicionar filtro empresa no INSERT/UPDATE/DELETE |
| `user_access_assignments` | ADMIN CRUD sem empresa + SELECT true | Adicionar filtro empresa |
| `knowledge_documents` | ADMIN ALL sem empresa | Sem coluna empresa — filtrar via tipo ou manter admin-only |
| `knowledge_sections` | ADMIN ALL sem empresa | Sem coluna empresa — manter admin-only |
| `knowledge_faq` | INSERT/UPDATE/DELETE sem empresa | Adicionar filtro empresa |
| `notifications` | SELECT/UPDATE por user_id (ok), INSERT service_role (ok) | Ja isolado por user_id, ok |
| `pessoas` | ADMIN SELECT sem empresa | Sem coluna empresa — via contact_id JOIN |

**Tabelas CS com `OR get_user_empresa IS NULL` (brecha):**

| Tabela | Problema |
|--------|----------|
| `cs_customers` | SELECT/INSERT/UPDATE permitem acesso se empresa IS NULL |
| `cs_incidents` | Mesma brecha |
| `cs_surveys` | Mesma brecha |
| `cs_playbooks` | Mesma brecha |
| `cs_health_log` | INSERT com `WITH CHECK true` — qualquer um insere |

Correcao: remover fallback `OR get_user_empresa IS NULL` e corrigir INSERT do cs_health_log.

**Tabelas com DELETE `qual: true` (qualquer autenticado deleta):**

| Tabela | Correcao |
|--------|----------|
| `cs_customers` | Restringir DELETE a ADMIN da mesma empresa |
| `cs_incidents` | Restringir DELETE a ADMIN da mesma empresa |
| `cs_playbooks` | Restringir DELETE a ADMIN da mesma empresa |
| `cs_surveys` | Restringir DELETE a ADMIN da mesma empresa |

### Frontend Hooks (Etapa 3C)

Hooks que fazem queries sem filtro empresa:

| Hook | Problema | Correcao |
|------|----------|----------|
| `useAIMetrics` | Busca lead_message_intents sem empresa | Adicionar filtro activeCompany |
| `useAutoRules` | Busca pipeline_auto_rules sem empresa | Filtrar via pipeline_id join ou adicionar empresa |
| `useSdrIaStats` | Busca lead_contacts/intents sem empresa | Adicionar filtro activeCompany |
| `useOperationalHealth` | Verifica integracoes sem filtro | Passar empresa nas chamadas |
| `useLeadClassification` | Ja recebe empresa como parametro | Verificar se sempre e passado |

## Detalhes Tecnicos

### Migracao SQL — Estrutura

Uma unica migracao com 3 blocos:

**Bloco 1**: Tabelas com coluna `empresa` direta (~18 tabelas)
- Padrao: DROP policy antiga sem filtro -> CREATE com `AND empresa::text = get_user_empresa(auth.uid())`

**Bloco 2**: Tabelas CS — remover brecha `OR IS NULL` + corrigir DELETE
- DROP policies com fallback NULL
- CREATE policies estritas: `empresa::text = get_user_empresa(auth.uid())` sem OR

**Bloco 3**: Tabelas sem coluna empresa
- `cadence_steps`: EXISTS via cadences.empresa
- `custom_field_values`: EXISTS via custom_field_definitions.empresa
- `pessoas`: EXISTS via contacts.empresa (usando contact_id)
- `knowledge_documents`, `knowledge_sections`: manter admin-only (sao config global)

### Hooks Frontend

Para cada hook listado:
1. Importar `useCompany` de `@/contexts/CompanyContext`
2. Adicionar `.eq('empresa', activeCompany)` nas queries
3. Incluir `activeCompany` no `queryKey` do react-query

### Estimativa de arquivos alterados

- 1 arquivo SQL (migracao)
- 4-5 hooks TypeScript
- Atualizacao do `.lovable/plan.md`

