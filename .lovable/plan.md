
# Plano: Limpar Runs e Dialog de Desativacao Inteligente

## 1. Limpar banco agora

Executar UPDATE em massa para cancelar todas as runs ativas (`lead_cadence_runs` com `status = 'ATIVA'`), setando `status = 'CANCELADA'` e `next_run_at = NULL`. Tambem cancelar as bridge rows em `deal_cadence_runs` com `status = 'ACTIVE'`.

## 2. Dialog ao desativar cadencia pelo switch

Quando o usuario clicar no switch para **desativar** uma cadencia (de ativo para inativo), abre um `AlertDialog` com duas opcoes:

- **"Apenas para novos"** -- Desativa a cadencia (`ativo = false`) mas mantem as runs existentes rodando normalmente.
- **"Para todos"** -- Desativa a cadencia E pausa todas as runs ativas dessa cadencia (`status = 'PAUSADA'`, `next_run_at = null`).

Quando o usuario **ativar** (de inativo para ativo), o switch funciona direto sem dialog.

## 3. Detalhes tecnicos

### Mutacao atualizada (`useCadenceMutations.ts`)

Adicionar uma nova mutacao `useDeactivateCadence` que aceita `{ id, pausarRuns: boolean }`:
- Sempre faz `UPDATE cadences SET ativo = false WHERE id = ?`
- Se `pausarRuns = true`, tambem faz `UPDATE lead_cadence_runs SET status = 'PAUSADA', next_run_at = null WHERE cadence_id = ? AND status = 'ATIVA'`
- Invalida queries de cadences + runs

### UI (`CadencesList.tsx`)

- Adicionar estado `deactivatingCadence` para controlar qual cadencia esta sendo desativada
- Ao clicar switch OFF: setar estado e abrir `AlertDialog`
- Ao clicar switch ON: chamar `toggleAtivo` direto como hoje
- AlertDialog com dois botoes: "Apenas para novos" e "Para todos"
- Ambos fecham o dialog e executam a acao correspondente

### Limpeza do banco (INSERT tool)

```sql
UPDATE lead_cadence_runs SET status = 'CANCELADA', next_run_at = NULL WHERE status = 'ATIVA';
UPDATE deal_cadence_runs SET status = 'CANCELLED' WHERE status = 'ACTIVE';
```

## Arquivos alterados

- `src/hooks/cadences/useCadenceMutations.ts` -- nova mutacao `useDeactivateCadence`
- `src/hooks/cadences/index.ts` -- re-export
- `src/hooks/useCadences.ts` -- re-export
- `src/pages/CadencesList.tsx` -- AlertDialog + logica de switch
