

# Ajustes na Logica de Perda de Deals

## Mudancas

### 1. Remover tempo minimo do fluxo de GANHO

Atualmente o `handleWin` chama `checkMinTime()` antes de marcar como ganho. Isso sera removido -- ganhar pode acontecer a qualquer momento, sem restricao.

**Arquivo:** `src/components/pipeline/DealCard.tsx`
- `handleWin`: remover a chamada a `checkMinTime()`, fechar direto como GANHO

### 2. Permitir perda antes do tempo minimo para categoria PRODUTO_INADEQUADO

A validacao de tempo minimo no `handleLoseClick` sera movida para **dentro** do dialog de confirmacao (`handleConfirmLoss`), pois agora depende da categoria selecionada.

Logica:
- Se a categoria selecionada for `PRODUTO_INADEQUADO`, o tempo minimo e ignorado (bypass)
- Para qualquer outra categoria, a validacao de dias continua normalmente

**Arquivo:** `src/components/pipeline/DealCard.tsx`
- `handleLoseClick`: remover `checkMinTime()`, apenas abrir o dialog
- `handleConfirmLoss`: adicionar validacao de tempo minimo **apos** selecao de categoria, com bypass para `PRODUTO_INADEQUADO`

### Detalhes tecnicos

**DealCard.tsx -- handleWin** (linha 87-97):
```text
// Antes:
const ok = await checkMinTime();
if (!ok) return;

// Depois:
// (sem validacao de tempo)
closeDeal.mutate({ dealId, status: 'GANHO', stageId });
```

**DealCard.tsx -- handleLoseClick** (linha 99-105):
```text
// Antes:
const ok = await checkMinTime();
if (!ok) return;
setLossDialogOpen(true);

// Depois:
setLossDialogOpen(true);
```

**DealCard.tsx -- handleConfirmLoss** (linha 107-137):
```text
// Apos validar campos obrigatorios, antes de chamar closeDeal:
if (categoriaPerda !== 'PRODUTO_INADEQUADO') {
  const ok = await checkMinTime();
  if (!ok) return;
}
// ... continua com closeDeal.mutate(...)
```

Isso torna `handleConfirmLoss` async (atualmente e sync).

Nenhuma mudanca no banco de dados, tipos, hooks ou outras paginas e necessaria.

