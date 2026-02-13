

## Patch 4: Contatos e Organizacoes — Telas Completas

### Resumo

Este patch substitui a pagina simples de Contatos atual por telas completas de CRM com listagem paginada, detail sheets com edicao inline, campos customizaveis EAV, vinculacao a deals, e adiciona uma nova pagina de Organizacoes.

### Pre-requisitos e gaps identificados

Antes de implementar o codigo, ha ajustes necessarios no banco de dados:

1. **Coluna `is_active` faltando em `contacts`** — O patch assume `is_active` boolean, mas a tabela nao tem essa coluna. Precisa ser adicionada com default `true`.
2. **Coluna `is_active` faltando em `organizations`** — Mesmo caso. A tabela usa `ativo` atualmente, precisa adicionar `is_active` ou adaptar o codigo para usar `ativo`.
3. **Views SQL nao existem** — `contacts_with_stats` e `organizations_with_stats` precisam ser criadas.
4. **Indices de performance** — `idx_deals_contact_id`, `idx_deals_organization_id`, `idx_contacts_organization_id`.
5. **Hook `useResolvedFields` nao existe** — O `CustomFieldsRenderer` depende de um hook que resolve definicoes + valores em campos formatados. Precisa ser criado no `useCustomFields.ts`.

### Decisao de adaptacao: `is_active` vs `ativo`

A tabela `organizations` ja usa `ativo` (boolean). Para manter consistencia com o patch, vou:
- Adicionar `is_active` em `contacts` (nao existe nenhum campo equivalente)
- Na view `organizations_with_stats`, usar o campo `ativo` existente (sem renomear)
- No codigo do hook `useOrganizationsPage`, filtrar por `ativo` em vez de `is_active`

### Ordem de implementacao

#### Fase 1: Migration SQL
- Adicionar coluna `is_active BOOLEAN NOT NULL DEFAULT true` em `contacts`
- Criar view `contacts_with_stats` (JOIN contacts + organizations + profiles + deals aggregates)
- Criar view `organizations_with_stats` (JOIN organizations + profiles + contacts count + deals aggregates) — usando `ativo` em vez de `is_active`
- Criar indices de performance

#### Fase 2: Types + Hooks
- Criar `src/types/contactsPage.ts` com interfaces `ContactWithStats`, `OrganizationWithStats`, `ContactFormData`, `OrganizationFormData`
- Criar `src/hooks/useContactsPage.ts` com `useContactsPage`, `useContactDetail`, `useCreateContact`, `useUpdateContact`, `useDeleteContact`, `useContactDeals`
- Criar `src/hooks/useOrganizationsPage.ts` com `useOrganizationsPage`, `useOrgDetail`, `useCreateOrg`, `useUpdateOrg`, `useOrgContacts`
- Adicionar `useResolvedFields` ao `src/hooks/useCustomFields.ts` — funcao que combina definicoes + valores em `ResolvedCustomField[]`

#### Fase 3: Componentes compartilhados
- Criar `src/components/contacts/CustomFieldsRenderer.tsx` — renderizador EAV universal com edicao inline por tipo de campo (TEXT, NUMBER, CURRENCY, DATE, BOOLEAN, SELECT, MULTISELECT, etc.)

#### Fase 4: Contatos
- Criar `src/components/contacts/ContactCreateDialog.tsx` — modal de criacao com campos: nome, empresa, email, telefone, CPF, canal origem, organizacao (select), observacoes, flag cliente
- Criar `src/components/contacts/ContactDetailSheet.tsx` — slide-over com 3 tabs: Dados (edicao inline), Deals (cards com stage/valor), Campos Custom (EAV)
- Reescrever `src/pages/ContatosPage.tsx` (substituir pagina atual) — tabela com busca, filtro clientes/leads, paginacao server-side, badges empresa, stats

#### Fase 5: Organizacoes
- Criar `src/components/organizations/OrgCreateDialog.tsx` — modal com razao social, fantasia, CNPJ, contato, endereco, setor, porte
- Criar `src/components/organizations/OrgDetailSheet.tsx` — slide-over com 3 tabs: Dados, Contatos (clickable para ContactDetail), Campos Custom
- Criar `src/pages/OrganizationsPage.tsx` — tabela com busca, paginacao, stats

#### Fase 6: Integracao (rotas + sidebar)
- Adicionar rota `/organizacoes` no `App.tsx`
- Adicionar "Organizacoes" no `AppSidebar.tsx` grupo Principal (com icone Building2)
- Adaptar props do `CopilotPanel` (o componente existente usa `context` object, nao props separadas como o PDF mostra — sera adaptado)

### Adaptacoes necessarias vs PDF

| Item | PDF | Implementacao real |
|------|-----|--------------------|
| `organizations.is_active` | Assume `is_active` | Usar campo existente `ativo` |
| `CopilotPanel` props | `contextType`, `contextId`, `empresa`, `contextData` separados | Usar `context` object existente |
| `useResolvedFields` | Assume existente | Criar dentro de `useCustomFields.ts` |
| Pagina `/contatos` | Nova | Substituir pagina existente |

### Checklist de validacao (da pagina 34 do documento)

1. Rodar migration SQL (views + indices + coluna is_active)
2. Verificar views com SELECT * LIMIT 5
3. Abrir /contatos, buscar, filtrar por Clientes, paginar
4. Criar novo contato, verificar na lista
5. Clicar contato — sheet abre com 3 tabs
6. Editar campo inline (hover, pencil, edit, save)
7. Tab Campos — ver custom fields EAV renderizados e editaveis
8. Tab Deals — ver deals vinculados
9. Abrir /organizacoes, buscar, criar, detalhe com contatos vinculados
10. Na org, clicar contato — abre ContactDetailSheet

