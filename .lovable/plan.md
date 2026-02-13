

## Patch 9 — Checklist de Validacao (Resultado)

| # | Item | Status |
|---|------|--------|
| 1 | Tabelas `deal_cadence_runs` e `cadence_stage_triggers` criadas | OK |
| 2 | Views `cadencias_crm` e `deal_cadencia_status` funcionam | OK |
| 3 | Trigger `check_cadence_stage_trigger` existe | OK |
| 4 | Rota `/cadencias-crm` acessivel | OK |
| 5 | CadenciasPage lista cadencias com stats CRM | OK |
| 6 | Criar trigger automatico (pipeline + stage + cadencia) | OK |
| 7 | DealCadenceCard visivel no DealDetailSheet | OK |
| 8 | Iniciar cadencia manualmente no DealCadenceCard | OK |
| 9 | Pausar, retomar e cancelar cadencia | OK |
| 10 | Trigger SQL auto-start ao mover deal | OK |

**Resultado: 10/10 aprovados.**

---

## Patch 10: Metas e Comissoes

### Resumo

Sistema completo de metas mensais e comissoes automatizadas. Admin define metas por vendedor e regras de comissao (percentual, fixo ou escalonada). Trigger SQL calcula comissao automaticamente ao ganhar deal. Dashboard com ranking, barras de progresso e workflow de aprovacao PENDENTE, APROVADO, PAGO.

---

### Correcoes vs PDF (problemas no schema real)

| PDF assume | Schema real | Correcao |
|------------|------------|----------|
| `NEW.empresa` no trigger `calc_comissao_deal` | `deals` nao tem coluna `empresa` | JOIN com `pipelines` para obter empresa |
| `WHERE empresa = NEW.empresa` nas queries do trigger | Idem acima | Usar variavel `v_empresa` obtida via pipeline |
| `d.empresa = NEW.empresa` no calculo escalonado | Idem | Substituir por JOIN equivalente com pipeline |
| `CHECK (empresa IN (...))` em `comissao_lancamentos` | Coluna `empresa` e TEXT sem constraint | Adicionar CHECK para consistencia |
| `MESES` array incompleto no PDF | Faltam Nov e Dez | Completar com 'Novembro', 'Dezembro' |
| `percentual_aplica` truncado na linha 190 | PDF cortou o SQL | Corrigir para `percentual_aplicado` |

---

### Ordem de implementacao

#### Fase 1: Migration SQL

3 tabelas + 1 trigger function + 2 views:

**Tabela `metas_vendedor`**:
- `user_id`, `empresa`, `ano`, `mes`, `meta_valor`, `meta_deals`
- UNIQUE(user_id, empresa, ano, mes)
- RLS: SELECT para authenticated, ALL para ADMIN

**Tabela `comissao_regras`**:
- `empresa`, `pipeline_id` (nullable), `nome`, `tipo` (PERCENTUAL/FIXO/ESCALONADO)
- `percentual`, `valor_fixo`, `escalas` JSONB, `valor_minimo_deal`
- RLS: SELECT para authenticated, ALL para ADMIN

**Tabela `comissao_lancamentos`**:
- `deal_id`, `user_id`, `regra_id`, `empresa`, `deal_valor`, `comissao_valor`
- `percentual_aplicado`, `status` (PENDENTE/APROVADO/PAGO/CANCELADO)
- `aprovado_por`, `aprovado_em`, `pago_em`, `referencia_ano`, `referencia_mes`
- UNIQUE(deal_id, user_id)
- RLS: SELECT para authenticated, ALL para ADMIN

**Trigger `calc_comissao_deal()`** (SECURITY DEFINER):
- AFTER UPDATE ON deals
- Dispara quando `fechado_em` muda de NULL para NOT NULL e stage `is_won = true`
- CORRECAO: Obtem `v_empresa` via `SELECT p.empresa FROM pipelines p WHERE p.id = NEW.pipeline_id`
- Busca regra ativa compativel (empresa, pipeline, valor minimo)
- Calcula comissao: PERCENTUAL (% fixo), FIXO (valor fixo), ESCALONADO (faixas progressivas com acumulado mensal)
- Insere/atualiza `comissao_lancamentos`

**View `meta_progresso`** (SECURITY INVOKER):
- Progresso vs meta: realizado_valor, realizado_deals, pct_valor, pct_deals, pipeline_aberto, comissao_mes
- CORRECAO: JOIN deals com pipelines para filtrar por empresa (em vez de `d.empresa`)

**View `comissao_resumo_mensal`** (SECURITY INVOKER):
- Resumo por vendedor/mes: pendentes, aprovados, pagos, comissao_total

**Seed data**:
- Regra Blue: 10% sobre deals >= R$500
- Regra Tokeniza: escalonada (ate R$50k=5%, R$50-100k=8%, >R$100k=12%)

#### Fase 2: Types — `src/types/metas.ts`

Criar arquivo com interfaces:
- `MetaVendedor`, `MetaProgresso`, `ComissaoTipo`, `ComissaoStatus`
- `ComissaoRegra`, `ComissaoLancamento`, `ComissaoResumoMensal`

#### Fase 3: Hooks — `src/hooks/useMetas.ts`

- `useMetaProgresso(ano, mes)` — ranking com filtro empresa
- `useMyMetaProgresso(ano, mes)` — meta do usuario logado
- `useUpsertMeta()` — criar/editar meta
- `useComissaoRegras()` — listar regras
- `useUpsertComissaoRegra()` — criar/editar regra
- `useComissaoLancamentos(ano, mes)` — lancamentos com JOINs
- `useUpdateComissaoStatus()` — aprovar/pagar lancamento
- `useComissaoResumo(ano, mes)` — resumo mensal

#### Fase 4: Page — `src/pages/MetasPage.tsx`

Substituir a pagina shell existente por dashboard completo com:
- Header: icone Target, titulo "Metas e Comissoes", navegacao mes anterior/proximo
- 5 KPIs: Meta total, Realizado, % Atingido, Comissoes, Pipeline
- 3 Tabs:
  - **Ranking**: cards por vendedor com avatar, barra de progresso, coroas top 3, botao "Editar meta" (admin)
  - **Comissoes**: tabela de lancamentos com deal, vendedor, valores, select de status (PENDENTE, APROVADO, PAGO, CANCELADO)
  - **Regras**: cards com tipo, percentual/valor/escalas, badge ativa/inativa
- Dialog para editar meta (valor R$ + quantidade deals)

#### Fase 5: Routing e Sidebar

- Rota `/metas` ja existe no App.tsx — adicionar `requiredRoles={['ADMIN', 'CLOSER']}`
- Item "Metas e Comissoes" ja existe no sidebar — sem alteracao necessaria
- Registro `metas` ja existe em screenRegistry.ts — sem alteracao necessaria

---

### Secao tecnica

**Arquivos criados/modificados**:

| Arquivo | Acao |
|---------|------|
| Migration SQL | Criar (3 tabelas + trigger + 2 views + seed) |
| `src/types/metas.ts` | Criar |
| `src/hooks/useMetas.ts` | Criar |
| `src/pages/MetasPage.tsx` | Reescrever (substituir shell) |
| `src/App.tsx` | Editar (adicionar requiredRoles na rota /metas) |

**Correcao critica no trigger**: `deals` nao tem `empresa`, entao o trigger faz:
```text
SELECT p.empresa::TEXT INTO v_empresa
FROM pipelines p WHERE p.id = NEW.pipeline_id;
```
E usa `v_empresa` em todas as queries internas (busca regra, calculo escalonado).

**Correcao na view `meta_progresso`**: `deals` nao tem `empresa`, entao o JOIN precisa passar por `pipelines`:
```text
LEFT JOIN deals d ON d.owner_id = m.user_id
LEFT JOIN pipelines pip ON d.pipeline_id = pip.id AND pip.empresa::TEXT = m.empresa
```

---

### Checklist de validacao (sera executado apos implementacao)

1. Tabelas `metas_vendedor`, `comissao_regras`, `comissao_lancamentos` criadas
2. Views `meta_progresso` e `comissao_resumo_mensal` funcionam
3. Trigger `calc_comissao_deal` existe
4. Seed data inserido (2 regras de comissao)
5. Rota `/metas` acessivel com requiredRoles
6. Pagina MetasPage renderiza com KPIs
7. Tab Ranking mostra vendedores (ou vazio)
8. Tab Comissoes mostra lancamentos
9. Tab Regras mostra regras de comissao
10. Navegar entre meses funciona
11. Dialog de editar meta funciona (admin)

