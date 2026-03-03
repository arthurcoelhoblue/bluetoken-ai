

## Auditoria Completa da Implementação Atual

Avaliei toda a codebase — rotas, hooks, componentes, edge functions, RLS policies, e schema. Segue o relatório completo.

---

### Resumo Executivo

| Área | Status | Problemas |
|------|--------|-----------|
| Rotas (App.tsx) | ✅ OK | Todas conectadas, nenhuma vazia |
| Sidebar (navegação) | ✅ OK | Todas as rotas mapeadas |
| RLS Policies | ✅ OK | Todas as novas tabelas com RLS por empresa |
| Schema vs Código | ⚠️ 2 bugs | CallSummaryDialog + `deal_notes as any` |
| Edge Functions | ✅ OK | sync-renewal-triggers correto |
| Pipeline/Kanban | ✅ OK | Compacto, funcional |
| GlobalSearch | ⚠️ 1 risco | `deal_notes` join funciona mas sem tenant filter |
| LeadLookupDialog | ✅ OK | Conectado no PipelinePage |

---

### Problemas Encontrados

#### 1. CRÍTICO — `CallSummaryDialog` nunca é renderizado no JSX

**Arquivo:** `src/components/zadarma/ZadarmaPhoneWidget.tsx`

O componente é importado (linha 15), o estado `showCallSummary` é declarado (linha 47) e setado para `true` após chamadas >5s (linha 213), mas **o `<CallSummaryDialog>` nunca aparece no JSX do return**.

O componente é importado mas nunca renderizado — toda a lógica de resumo de chamada está morta.

**Correção:** Adicionar antes do `</div>` final do widget:
```tsx
<CallSummaryDialog
  open={showCallSummary}
  onOpenChange={setShowCallSummary}
  dealId={lastCallDealId}
  contactName={lastCallContact}
  phoneNumber={lastCallNumber}
  callDuration={lastCallDuration}
/>
```

---

#### 2. MÉDIO — GlobalSearch `deal_notes` sem filtro de tenant

**Arquivo:** `src/components/layout/GlobalSearch.tsx` (linhas 76-80)

A busca em `deal_notes` faz join com `deals.pipelines` mas **não filtra `.in('pipelines.empresa', activeCompanies)`**. Usuários de uma empresa podem ver notas de deals de outra empresa nos resultados de busca.

**Correção:** Adicionar filtro tenant na query de notes, similar ao que é feito para deals:
```ts
.from('deal_notes' as any)
.select('id, conteudo, deal_id, deals!inner(titulo, pipelines!inner(empresa))')
.ilike('conteudo', searchTerm)
.in('deals.pipelines.empresa', activeCompanies)  // ← adicionar
.limit(5);
```

O mesmo vale para `deal_activities` (linha 83-87) — já tem `!inner` join mas sem `.in()` explícito (o `!inner` filtra implicitamente, mas só se o filtro for adicionado).

---

#### 3. BAIXO — `deal_notes as any` typecast

**Arquivos:** `CallSummaryDialog.tsx` (linha 65), `GlobalSearch.tsx` (linha 77)

`deal_notes` existe no `types.ts` mas é referenciado como `'deal_notes' as any`. Isso funciona em runtime mas desabilita type-safety. Pode ser mudado para usar o tipo correto sem cast.

---

### O que está CORRETO e bem conectado

1. **Marketing Lists** — Tabelas criadas (`marketing_lists`, `marketing_list_members`), RLS policies por empresa, hooks completos (CRUD + members), rota `/marketing/listas` no App.tsx, link na sidebar. Trigger `trg_marketing_list_count` mantém contador. Tudo conectado.

2. **Pipeline Compacto** — `KanbanColumn` com `w-64`, `DealCard` com `p-2`, fontes `text-[11px]`, `text-[10px]`. Funcional e mais denso.

3. **LeadLookupDialog** — Integrado no `PipelinePage.tsx`, intercepta clique em deal, busca `lead_messages` via `legacy_lead_id`, opção de "Amélia Iniciar Qualificação" chama `cadence-runner` corretamente.

4. **DealProductsTab** — Aba "Produtos" no `DealDetailSheet`, hook `useDealProducts` usa tabelas reais (`deal_products`, `catalog_products`), RLS por empresa correto.

5. **DealMeetingsTab** — Aba "Reuniões" no `DealDetailSheet`, hook `useMeetings` busca da tabela `meetings` com colunas corretas (`owner_id`, `data_inicio`, `data_fim`).

6. **ScheduleActivityDialog** — Prompt de "agendar próximo passo" ao fechar DealSheet, insere em `deal_activities` com colunas corretas.

7. **sync-renewal-triggers** — Edge function com schema correto (deals: `contact_id`, `owner_id`, `valor`, `moeda`, `posicao_kanban`). Usa `assertEmpresa`, `createLogger`, `getCorsHeaders`. RLS em `sgt_client_status` OK.

8. **Escalação automática (action-executor)** — `autoCreateDeal` usa colunas corretas de `deals`. Notificações com `DEAL_AUTO_CRIADO` tipo reconhecido pelo `NotificationBell`. Round-robin de vendedores funcional.

9. **formatPhoneBR** — Implementado em `src/lib/formatPhone.ts`, importado no `ZadarmaPhoneWidget`.

10. **Todas as rotas** — 46 rotas no App.tsx, todas com lazy loading, ProtectedRoute, ErrorBoundary. Nenhuma rota vazia ou sem componente.

---

### Plano de Correção

| # | Severidade | Ação | Arquivo |
|---|-----------|------|---------|
| 1 | CRÍTICO | Renderizar `<CallSummaryDialog>` no JSX do widget | `ZadarmaPhoneWidget.tsx` |
| 2 | MÉDIO | Adicionar filtro tenant na busca de `deal_notes` e `deal_activities` no GlobalSearch | `GlobalSearch.tsx` |
| 3 | BAIXO | Remover `as any` de `deal_notes` (opcional, cosmético) | 2 arquivos |

Ambas correções são cirúrgicas — <10 linhas cada.

