

## Patch 11 — Checklist de Validacao (Resultado)

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

---

## Patch 12: Projecao por Etapa do Funil + Acao em Massa Amelia

### Resumo

Duas features complementares: (1) Widget de projecao de meta baseado em taxa de conversao historica por stage, integravel na MetasPage; (2) Pagina de acao em massa via Amelia com selecao de deals, modo Cadencia Modelo ou Campanha Ad-hoc com geracao IA, preview/aprovacao individual e execucao com monitoramento.

---

### Correcoes vs PDF (problemas no schema real)

| PDF assume | Schema real | Correcao |
|------------|------------|----------|
| `deals.empresa` nas views | `deals` nao tem coluna `empresa` | JOIN com `pipelines` para obter empresa |
| `stage_conversion_rates` como view simples | `deal_stage_history` existe mas sem `empresa` | JOIN com deals + pipelines para filtrar |
| Edge function `amelia-mass-action` | Nao existe | Criar usando Lovable AI Gateway (gemini-2.5-flash) |
| `mass_action_jobs.deal_ids` como UUID[] | Array nativo | Usar `uuid[]` nativo no Postgres |

---

### Ordem de implementacao

#### Fase 1: Migration SQL

2 views + 1 tabela:

**View `stage_conversion_rates`** (SECURITY INVOKER):
- Fonte: `deal_stage_history` + `deals` + `pipeline_stages` + `pipelines`
- Calcula: para cada stage, total de deals que passaram e quantos desses fecharam como `is_won`
- Retorna: `stage_id`, `stage_nome`, `pipeline_id`, `pipeline_nome`, `empresa`, `total_deals`, `deals_ganhos`, `taxa_conversao`
- CORRECAO: JOIN deals->pipelines para obter empresa (deals nao tem empresa)

**View `pipeline_stage_projection`** (SECURITY INVOKER):
- Fonte: `deals` (status='ABERTO') + `pipeline_stages` + `stage_conversion_rates`
- Calcula: para cada stage, soma valor dos deals abertos * taxa de conversao
- Retorna: `stage_id`, `stage_nome`, `pipeline_id`, `pipeline_nome`, `empresa`, `owner_id`, `deals_count`, `valor_total`, `taxa_conversao`, `valor_projetado`

**Tabela `mass_action_jobs`**:
- `id` UUID PK, `empresa` empresa_tipo
- `tipo` TEXT CHECK ('CADENCIA_MODELO', 'CAMPANHA_ADHOC')
- `status` TEXT CHECK ('PENDING', 'GENERATING', 'PREVIEW', 'RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL')
- `deal_ids` uuid[], `cadence_id` UUID nullable FK cadences
- `instrucao` TEXT (texto livre ad-hoc), `canal` TEXT CHECK ('WHATSAPP', 'EMAIL')
- `messages_preview` JSONB (array de {deal_id, contact_name, message, approved: bool})
- `total`, `processed`, `succeeded`, `failed` INT defaults 0
- `started_by` UUID FK profiles, `created_at`, `started_at`, `completed_at`
- RLS: SELECT para authenticated, ALL para ADMIN/CLOSER

#### Fase 2: Types — `src/types/patch12.ts`

- `StageConversionRate`, `StageProjection` (para o widget de projecao)
- `MassActionJobType`, `MassActionJobStatus`, `MassActionJob`
- `MassActionMessagePreview` (deal_id, contact_name, message, approved)

#### Fase 3: Hooks — `src/hooks/usePatch12.ts`

**Projecao:**
- `useStageConversionRates(empresa)` — taxa historica por stage
- `useStageProjections(userId, empresa)` — projecao de valor por stage/owner

**Mass Action:**
- `useMassActionJobs(empresa)` — lista historico
- `useMassActionJob(jobId)` — detalhe com polling se RUNNING/GENERATING
- `useCreateMassAction()` — cria job PENDING
- `useGenerateMessages()` — chama edge function para gerar mensagens IA
- `useUpdateMessageApproval()` — aprova/rejeita mensagem individual no JSONB
- `useExecuteMassAction()` — muda status para RUNNING e dispara execucao

#### Fase 4: Componente — `src/components/ProjecaoStageCard.tsx`

Props: `userId`, `empresa`, `metaValor`, `vendidoAtual`

- Cards por stage com toggle on/off, badge taxa de conversao, valor projetado
- Botoes "Todas" / "Nenhuma" para selecao rapida
- Filtro por pipeline (select)
- Resumo: Total no Funil | Projecao Selecionada | Vendido + Projecao | Falta p/ Meta
- Barra tricolor: verde (vendido), azul (projecao), marcador vermelho (meta)

#### Fase 5: Integrar ProjecaoStageCard na MetasPage

- Adicionar o card abaixo dos KPIs na MetasPage, usando dados do usuario logado
- Passar `metaValor` e `vendidoAtual` do ranking

#### Fase 6: Edge Function — `supabase/functions/amelia-mass-action/index.ts`

- Recebe: `{ jobId }` com auth token
- Carrega job, deals, contacts, historico
- Para cada deal: gera mensagem personalizada via Lovable AI Gateway (gemini-2.5-flash) considerando contexto, temperatura, framework
- Salva `messages_preview` no job com `approved: true` por default
- Atualiza status para PREVIEW

#### Fase 7: Page — `src/pages/AmeliaMassActionPage.tsx`

- Header com titulo e botao "Acionar Amelia (N)"
- Filtros: busca, pipeline, stage, temperatura
- Tabela de deals com checkbox, titulo, contato, stage, temperatura, valor
- Barra de resumo da selecao (N deals, valor total)
- Dialog de configuracao com abas: Cadencia Modelo (select cadencia) / Campanha Ad-hoc (textarea instrucao) + select canal
- Preview: lista de mensagens com thumbs up/down por deal
- Execucao: barra de progresso com polling
- Historico de jobs anteriores

#### Fase 8: Routing, Sidebar e Registry

- Adicionar rota `/amelia/mass-action` em App.tsx com requiredRoles `['ADMIN', 'CLOSER']`
- Substituir AmeliaPage shell por redirect ou manter como hub
- Registrar `amelia_mass_action` em screenRegistry.ts
- Adicionar item no sidebar (sub-item de Amelia ou item separado)

---

### Secao tecnica

**Arquivos criados/modificados**:

| Arquivo | Acao |
|---------|------|
| Migration SQL | Criar (2 views + 1 tabela + RLS) |
| `src/types/patch12.ts` | Criar |
| `src/hooks/usePatch12.ts` | Criar |
| `src/components/ProjecaoStageCard.tsx` | Criar |
| `src/pages/MetasPage.tsx` | Editar (integrar ProjecaoStageCard) |
| `src/pages/AmeliaMassActionPage.tsx` | Criar |
| `supabase/functions/amelia-mass-action/index.ts` | Criar |
| `src/pages/AmeliaPage.tsx` | Editar (adicionar link para mass-action) |
| `src/App.tsx` | Editar (adicionar rota /amelia/mass-action) |
| `src/components/layout/AppSidebar.tsx` | Editar (adicionar sub-item) |
| `src/config/screenRegistry.ts` | Editar (registrar tela) |
| `supabase/config.toml` | Atualizar (registrar nova edge function) |

**Correcao critica nas views**: `deals` nao tem `empresa`, entao:
```text
-- stage_conversion_rates
JOIN deals d ON dsh.deal_id = d.id
JOIN pipelines p ON d.pipeline_id = p.id
-- usar p.empresa para filtro
```

**Edge function**: Usa Lovable AI Gateway com modelo `gemini-2.5-flash` para gerar mensagens personalizadas considerando contexto do lead.

---

### Checklist de validacao (sera executado apos implementacao)

1. Views `stage_conversion_rates` e `pipeline_stage_projection` criadas e funcionais
2. Tabela `mass_action_jobs` criada com RLS
3. ProjecaoStageCard renderiza na MetasPage com toggles por stage
4. Barra tricolor (vendido + projecao vs meta) funcional
5. Filtro por pipeline no widget de projecao funciona
6. Rota `/amelia/mass-action` acessivel (ADMIN/CLOSER)
7. Tabela de deals com checkbox e filtros funciona
8. Dialog de configuracao com abas Cadencia/Ad-hoc funciona
9. Edge function `amelia-mass-action` gera mensagens IA
10. Preview com aprovacao individual (thumbs up/down) funciona
11. Execucao com barra de progresso funciona
12. Historico de jobs anteriores com badges de status

