

## Transferir deals para outro vendedor (individual + em massa)

### 1. Transferência individual — no DealDetailSheet (aba Dados)

Atualmente o campo "Responsável" na `DealDadosTab` usa `renderInlineField` que edita texto livre. Isso precisa virar um **Select de vendedores** que atualiza `owner_id` (não `owner_nome`).

**Arquivo:** `src/components/deals/DealDadosTab.tsx`
- Substituir o campo "Responsável" por um Select que busca a lista de vendedores ativos (`profiles` com `is_vendedor=true`)
- Ao selecionar, chamar `updateField` com `{ field: 'owner_id', value: selectedUserId }`
- Registrar atividade de transferência via `deal_activities` (tipo `NOTA`, descricao "Transferido para {nome}")

### 2. Transferência em massa — na tela do Pipeline

**Arquivo:** `src/components/pipeline/KanbanBoard.tsx` + novo componente
- Adicionar botão "Transferir em massa" na barra de ações (ao lado do toggle IA Sort)
- Ao clicar, abre um `Dialog` com:
  - Select de vendedor de origem (opcional, para filtrar)
  - Select de vendedor de destino (obrigatório)
  - Checkbox: transferir todos os deals visíveis no Kanban ou selecionar individualmente
- Executar `UPDATE deals SET owner_id = ? WHERE id IN (...)` via mutation

**Novo arquivo:** `src/components/pipeline/TransferDealsDialog.tsx`
- Props: `deals` (lista visível no kanban), `owners`, `open`, `onOpenChange`
- Lista os deals com checkboxes para seleção
- Select de destino (vendedor)
- Botão confirmar que chama mutation em batch

**Arquivo:** `src/pages/PipelinePage.tsx`
- Passar `owners` e `deals` para o KanbanBoard (ou diretamente para o dialog)
- Adicionar state para controlar abertura do dialog

### 3. Hook de transferência

**Arquivo:** `src/hooks/deals/useDealMutations.ts`
- Adicionar `useTransferDeals` mutation que recebe `{ dealIds: string[], toOwnerId: string }` e atualiza todos em batch

### Arquivos envolvidos

| Arquivo | Ação |
|---------|------|
| `src/components/deals/DealDadosTab.tsx` | Editar — campo Responsável vira Select com owner_id |
| `src/components/pipeline/TransferDealsDialog.tsx` | Novo — dialog de transferência em massa |
| `src/components/pipeline/KanbanBoard.tsx` | Editar — botão "Transferir" na barra |
| `src/pages/PipelinePage.tsx` | Editar — passar owners e controlar dialog |
| `src/hooks/deals/useDealMutations.ts` | Editar — adicionar useTransferDeals |

