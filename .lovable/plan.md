

# Fase 3 — Auditoria e Correcao de Triggers Cross-Tenant

## Resumo da Auditoria

Analisei todas as trigger functions do banco. O resultado:

### Triggers JA SEGUROS (nenhuma acao necessaria)

| Trigger | Motivo |
|---------|--------|
| `log_deal_stage_change` | Opera apenas no deal sendo atualizado (mesmo ID). Sem queries cross-tenant. |
| `log_deal_activity` | Insere atividade referenciando o deal atualizado. Sem leak. |
| `validate_deal_scores` | Apenas validacao de range numerica. Sem queries. |
| `validate_deal_owner` | Apenas validacao de NOT NULL. Sem queries. |
| `update_updated_at_column` | Apenas atualiza timestamp. |
| `cleanup_old_activity_logs` | Deleta por timestamp, sem filtro de empresa (tabela de auditoria). |
| `fn_update_deal_score` | Chama `fn_calc_deal_score` que opera apenas no deal especifico. |
| `fn_sync_lead_to_contact` | Copia dados do lead para contact. Preserva `empresa` do lead original. |
| `fn_call_to_deal_activity` | Insere atividade referenciando a call especifica. |
| `fn_cs_auto_csat_on_resolve` | Chama edge function com `customer_id` especifico. |
| `fn_cs_incident_recalc_health` | Chama edge function com `customer_id` especifico. |
| `fn_cs_survey_recalc_health` | Opera no customer especifico da survey. |
| `enforce_channel_exclusivity` | Filtra por `empresa = NEW.empresa`. Ja seguro. |

### Triggers COM RISCO — Precisam de correcao

#### 1. `fn_gamify_deal_ganho` — RISCO MEDIO
**Problema**: Faz `SELECT COUNT(*) FROM deals WHERE owner_id = NEW.owner_id AND status = 'GANHO'` SEM filtrar por empresa. Isso significa que a contagem de deals ganhos de um vendedor inclui deals de OUTROS tenants, potencialmente concedendo badges incorretamente.
**Correcao**: Filtrar a contagem por empresa: `WHERE owner_id = NEW.owner_id AND status = 'GANHO' AND pipeline_id IN (SELECT id FROM pipelines WHERE empresa = v_empresa)`.

#### 2. `fn_gamify_activity_done` — RISCO MEDIO
**Problema**: Faz `SELECT COUNT(*) FROM deal_activities WHERE user_id = NEW.user_id AND tarefa_concluida = true AND created_at >= date_trunc('week', now())` SEM filtrar por empresa. Um vendedor que atua em dois tenants teria contagens infladas.
**Correcao**: Adicionar JOIN com `deals -> pipelines` para filtrar por empresa.

#### 3. `calc_comissao_deal` — RISCO ALTO
**Problema**: No modo ESCALONADO, calcula o acumulado mensal com `SELECT SUM(d.valor) FROM deals d JOIN pipelines pip ... WHERE d.owner_id = NEW.owner_id AND pip.empresa = v_empresa`. Este JA filtra por empresa — **sem risco**.
**Revisao**: Analisando com mais cuidado, esta funcao JA resolve empresa via `SELECT p.empresa FROM pipelines p WHERE p.id = NEW.pipeline_id` e filtra corretamente no modo escalonado. **Seguro**.

#### 4. `fn_deal_auto_advance` — RISCO BAIXO
**Problema**: Busca `pipeline_auto_rules` pelo `pipeline_id` do deal, que ja e especifico de uma empresa. A notificacao insere em `notifications` usando `empresa` do pipeline. **Seguro**.

#### 5. `check_cadence_stage_trigger` — RISCO BAIXO
**Problema**: Busca `cadence_stage_triggers` pelo `stage_id` e `pipeline_id`, que sao especificos de uma empresa. Resolve empresa via pipeline. **Seguro**.

#### 6. `fn_cs_gamify_health_improve` — RISCO BAIXO
Opera sobre customer especifico. Resolve `empresa` do customer. Sem queries cross-tenant. **Seguro**.

#### 7. `fn_cs_gamify_incident_resolved` — RISCO BAIXO
Opera sobre incidente especifico. Faz `SELECT COUNT(*) FROM cs_incidents WHERE responsavel_id = ... AND status = 'RESOLVIDA'` sem filtro de empresa. **Risco menor** pois badges de CS nao expoe dados, mas contagem inflada e possivel.
**Correcao**: Adicionar `.empresa = NEW.empresa` na contagem.

### Resumo das correcoes necessarias

| Trigger | Acao | Risco |
|---------|------|-------|
| `fn_gamify_deal_ganho` | Filtrar contagem de deals por empresa via pipelines | MEDIO |
| `fn_gamify_activity_done` | Filtrar contagem de atividades por empresa via deals/pipelines | MEDIO |
| `fn_cs_gamify_incident_resolved` | Filtrar contagem de incidentes por empresa | BAIXO |

## Detalhes Tecnicos — SQL Migration

### `fn_gamify_deal_ganho`
```text
-- Antes:
SELECT COUNT(*) INTO v_total_ganhos FROM deals WHERE owner_id = NEW.owner_id AND status = 'GANHO';

-- Depois:
SELECT COUNT(*) INTO v_total_ganhos
FROM deals d
JOIN pipelines p ON p.id = d.pipeline_id
WHERE d.owner_id = NEW.owner_id
  AND d.status = 'GANHO'
  AND p.empresa::text = v_empresa;
```

### `fn_gamify_activity_done`
```text
-- Antes:
SELECT COUNT(*) INTO v_week_count FROM deal_activities
WHERE user_id = NEW.user_id AND tarefa_concluida = true
  AND created_at >= date_trunc('week', now());

-- Depois:
SELECT COUNT(*) INTO v_week_count
FROM deal_activities da
JOIN deals d ON d.id = da.deal_id
JOIN pipelines p ON p.id = d.pipeline_id
WHERE da.user_id = NEW.user_id
  AND da.tarefa_concluida = true
  AND da.created_at >= date_trunc('week', now())
  AND p.empresa::text = v_empresa;
```

### `fn_cs_gamify_incident_resolved`
```text
-- Antes:
SELECT COUNT(*) INTO v_resolved_count FROM cs_incidents
WHERE responsavel_id = NEW.responsavel_id AND status = 'RESOLVIDA';

-- Depois:
SELECT COUNT(*) INTO v_resolved_count FROM cs_incidents
WHERE responsavel_id = NEW.responsavel_id
  AND status = 'RESOLVIDA'
  AND empresa = NEW.empresa;
```

---

# Fase 4 — Testes de Isolamento

Criar testes automatizados para as edge functions refatoradas, validando que queries com `empresa = 'BLUE'` nunca retornam dados de `empresa = 'TOKENIZA'` e vice-versa.

### Testes planejados (Deno edge function tests)

1. **`_shared/tenant.ts`**: Testar `assertEmpresa` com valores validos, invalidos e nulos.
2. **`deal-loss-analysis`**: Testar que modo portfolio sem empresa retorna erro.
3. **`icp-learner`**: Testar que chamada sem empresa retorna erro.
4. **`follow-up-scheduler`**: Testar que chamada sem empresa retorna erro.

### Arquivos

- `supabase/functions/_shared/tenant_test.ts` (novo)

---

## Resumo de mudancas

| Tipo | Arquivo/Recurso | Acao | Status |
|------|-----------------|------|--------|
| SQL Migration | 3 trigger functions | Corrigir filtros cross-tenant | ✅ CONCLUIDO |
| Plan | `.lovable/plan.md` | Atualizar status Fases 3 e 4 | ✅ CONCLUIDO |
| Test | `supabase/functions/_shared/tenant_test.ts` | Criar testes unitarios | ✅ CONCLUIDO |

---

## Status Geral do Hardening Multi-Tenant

| Fase | Descricao | Status |
|------|-----------|--------|
| 1 | RLS Hardening (80+ tabelas) | ✅ CONCLUIDO |
| 2A | Criar `_shared/tenant.ts` | ✅ CONCLUIDO |
| 2B | Refatorar 5 Edge Functions prioritarias | ✅ CONCLUIDO |
| 3 | Auditoria e correcao de triggers cross-tenant | ✅ CONCLUIDO |
| 4 | Testes de isolamento | ✅ CONCLUIDO |

