

## Patch 10 — Checklist de Validacao (Resultado)

| # | Item | Status |
|---|------|--------|
| 1 | Tabelas `metas_vendedor`, `comissao_regras`, `comissao_lancamentos` criadas | OK |
| 2 | Views `meta_progresso` e `comissao_resumo_mensal` funcionam | OK |
| 3 | Trigger `calc_comissao_deal` existe | OK |
| 4 | Seed data inserido (2 regras de comissao) | OK |
| 5 | Rota `/metas` acessivel com requiredRoles | OK |
| 6 | Pagina MetasPage renderiza com KPIs | OK |
| 7 | Tab Ranking mostra vendedores (ou vazio) | OK |
| 8 | Tab Comissoes mostra lancamentos | OK |
| 9 | Tab Regras mostra regras de comissao | OK |
| 10 | Navegar entre meses funciona | OK |
| 11 | Dialog de editar meta funciona (admin) | OK |

**Resultado: 11/11 aprovados.**

---

## Patch 11: Importacao Pipedrive

### Resumo

Wizard de importacao completa para migrar dados do Pipedrive para o CRM. Upload de 3 JSONs (deals, persons, orgs), mapeamento pipeline/stage, execucao sequencial (Orgs, Contacts, Deals resolvendo FKs), log detalhado e historico.

---

### Correcoes vs PDF (problemas no schema real)

| PDF assume | Schema real | Correcao |
|------------|------------|----------|
| `empresa` na insert de deals | `deals` nao tem coluna `empresa` | Remover `empresa` do insert de deals |
| `contact_id` nullable nos deals | `deals.contact_id` e NOT NULL | Skip deal se contact nao mapeado (ja previsto no PDF) |
| Status do deal = Pipedrive status | `deals.status` usa 'ABERTO', 'GANHO', 'PERDIDO' | Mapear: open='ABERTO', won='GANHO', lost='PERDIDO' |
| `contacts.empresa` como TEXT | `contacts.empresa` e `empresa_tipo` (USER-DEFINED) | Fazer cast adequado no insert |
| `organizations.empresa` como TEXT | Idem USER-DEFINED | Idem |

---

### Ordem de implementacao

#### Fase 1: Migration SQL

2 tabelas + 1 view:

**Tabela `import_jobs`**:
- `id`, `tipo` (PIPEDRIVE_FULL, PIPEDRIVE_DEALS, etc.), `empresa` (empresa_tipo)
- `status` (PENDING, RUNNING, COMPLETED, FAILED, PARTIAL)
- `total_records`, `imported`, `skipped`, `errors`, `error_log` JSONB
- `config` JSONB (pipeline_mapping, stage_mapping, owner_mapping)
- `started_by` FK profiles, `started_at`, `completed_at`
- RLS: ALL para ADMIN

**Tabela `import_mapping`**:
- `import_job_id` FK, `entity_type` (DEAL, CONTACT, ORGANIZATION, PERSON)
- `source_id` TEXT (Pipedrive ID), `target_id` UUID (CRM ID), `empresa`
- UNIQUE(entity_type, source_id, empresa)
- Index em source lookup e target
- RLS: SELECT + ALL para ADMIN

**View `import_jobs_summary`** (SECURITY INVOKER):
- import_jobs + profile nome + counts de deals/contacts/orgs mapeados

#### Fase 2: Types — `src/types/importacao.ts`

- `ImportJobStatus`, `ImportJobType`, `ImportJob`, `ImportMapping`
- `PipedriveDealRow`, `PipedrivePersonRow`, `PipedriveOrgRow`
- `ImportConfig` (empresa, pipeline_mapping, stage_mapping, owner_mapping, flags)

#### Fase 3: Hooks — `src/hooks/useImportacao.ts`

- `useImportJobs()` — lista historico via view
- `useRunImport()` — mutation sequencial:
  1. Cria job com status RUNNING
  2. Importa Orgs (insert organizations + mapping)
  3. Importa Persons como Contacts (resolve org_id via mapping)
  4. Importa Deals (resolve contact_id + org_id via mapping, mapeia pipeline/stage)
  5. CORRECAO: Remove `empresa` do insert de deals
  6. CORRECAO: Mapeia status Pipedrive (won/lost/open) para CRM (GANHO/PERDIDO/ABERTO)
  7. Atualiza job com stats finais

#### Fase 4: Page — `src/pages/ImportacaoPage.tsx`

Wizard com 4 steps:
- **Step 1 (Upload)**: 3 file inputs para deals.json, persons.json, orgs.json + selecao empresa + toggle "Pular existentes"
- **Step 2 (Mapeamento)**: Extrai pipeline_ids e stage_ids unicos dos deals, mostra selects para mapear para pipelines/stages do CRM
- **Step 3 (Running)**: Indicador de progresso enquanto importa
- **Step 4 (Done)**: Resumo com stats (importados, ignorados, erros)
- **Historico**: Lista de jobs anteriores com badges de status e stats

#### Fase 5: Routing e Sidebar

- Adicionar rota `/importacao` em App.tsx com `requiredRoles={['ADMIN']}`
- Adicionar item "Importacao" no sidebar grupo Configuracao com icone Upload
- Registrar `importacao` em screenRegistry.ts

---

### Secao tecnica

**Arquivos criados/modificados**:

| Arquivo | Acao |
|---------|------|
| Migration SQL | Criar (2 tabelas + 1 view) |
| `src/types/importacao.ts` | Criar |
| `src/hooks/useImportacao.ts` | Criar |
| `src/pages/ImportacaoPage.tsx` | Criar |
| `src/App.tsx` | Editar (adicionar rota /importacao) |
| `src/components/layout/AppSidebar.tsx` | Editar (adicionar item Importacao) |
| `src/config/screenRegistry.ts` | Editar (registrar tela) |

**Correcao critica no insert de deals**: `deals` nao tem `empresa`, entao o insert omite esse campo. O pipeline ja determina a empresa indiretamente.

**Mapeamento de status**: Pipedrive usa `won`/`lost`/`open`, CRM usa `GANHO`/`PERDIDO`/`ABERTO`:
```text
const statusMap = { won: 'GANHO', lost: 'PERDIDO', open: 'ABERTO' };
```

---

### Checklist de validacao (Resultado)

| # | Item | Status |
|---|------|--------|
| 1 | Tabelas `import_jobs` e `import_mapping` criadas | OK |
| 2 | View `import_jobs_summary` funciona | OK |
| 3 | Rota `/importacao` acessivel (ADMIN only) | OK |
| 4 | Item "Importacao" visivel no sidebar grupo Configuracao | OK |
| 5 | Step 1: upload dos 3 JSONs funciona | OK |
| 6 | Step 2: mapeamento pipeline/stage mostra pipelines do CRM | OK |
| 7 | Step 3: execucao mostra progresso | OK |
| 8 | Step 4: resultado com stats | OK |
| 9 | Historico mostra jobs anteriores com badges | OK |
| 10 | Re-importar com "Pular existentes" funciona (skips) | OK |

**Resultado: 10/10 aprovados.**

