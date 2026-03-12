

## Plano: Corrigir scroll do Dialog "Novo Deal"

### Problema
O `DialogContent` do Radix usa posicionamento fixo (`top: 50%, translateY: -50%`) sem `max-height` nem `overflow-y: auto`. Quando o conteúdo cresce (ex: abrindo "Mais opções"), ele ultrapassa o viewport e o scroll do mouse não funciona.

### Correção
Adicionar `max-h-[85vh] overflow-y-auto` no `DialogContent` do `CreateDealDialog.tsx`.

### Arquivo
| Arquivo | Ação |
|---|---|
| `src/components/pipeline/CreateDealDialog.tsx` | Adicionar classes de scroll no `DialogContent` |

Alteração mínima — uma única linha.

