

## Criar Tela de Gestão de Empresas (Tenants)

### Problema Atual

Adicionar uma empresa requer mudanças manuais em:
1. **Banco**: `ALTER TYPE empresa_tipo ADD VALUE 'NOVA'`
2. **Banco**: `SELECT provision_tenant_schema('nova')` (cria ~57 views)
3. **Frontend**: `CompanySwitcher.tsx`, `CompanyContext.tsx`, `enums.ts`
4. **Edge Functions**: `_shared/tenant.ts`, `_shared/types.ts`

### Solução Proposta

Substituir o enum hardcoded por uma **tabela `empresas`** e criar uma tela admin para gerenciar.

### Arquivos e Mudanças

**Migration SQL:**

| Mudança | Detalhe |
|---------|---------|
| Criar tabela `empresas` | `id TEXT PK, label TEXT, color TEXT, is_active BOOLEAN, created_at` |
| Seed com dados atuais | BLUE, TOKENIZA, MPUPPE, AXIA |
| RLS | Leitura para `authenticated`, escrita para ADMIN |

**Nota importante:** O enum `empresa_tipo` continuará existindo no banco (não é possível remover valores de enum no Postgres), mas a tabela `empresas` passará a ser a fonte de verdade para a UI e validações.

**Frontend (3 arquivos):**

| Arquivo | Mudança |
|---------|---------|
| `src/pages/AdminEmpresas.tsx` | **Novo** — Tela CRUD de empresas (listar, criar, editar label/cor, ativar/desativar) |
| `src/contexts/CompanyContext.tsx` | Carregar empresas da tabela `empresas` ao invés de hardcoded |
| `src/components/layout/CompanySwitcher.tsx` | Usar dados dinâmicos da tabela |

**Roteamento:**

| Arquivo | Mudança |
|---------|---------|
| `src/App.tsx` | Adicionar rota `/admin/empresas` |

**Edge Functions (2 arquivos):**

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/_shared/tenant.ts` | Validar empresa contra tabela `empresas` (query) ao invés de Set hardcoded |
| Nova edge function `admin-provision-tenant` | Executa `ALTER TYPE empresa_tipo ADD VALUE` + `provision_tenant_schema` via service_role |

### Limitação Conhecida

Adicionar valores ao enum PostgreSQL (`ALTER TYPE ... ADD VALUE`) não pode rodar dentro de uma transação. A edge function `admin-provision-tenant` precisará executar isso com `service_role` em statements separados.

### Fora de Escopo

- Remover empresas existentes (enum PG não permite remover valores)
- Migrar todas as colunas `empresa_tipo` para `TEXT` (mudança muito grande, pode ser feita depois)

