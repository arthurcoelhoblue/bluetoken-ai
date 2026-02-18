
# Abrir DealDetailSheet ao clicar no Deal em Pendencias

## O que muda
Quando o usuario clicar no titulo/card de um deal orfao na tela de Pendencias, abre a aba lateral (`DealDetailSheet`) com as informacoes resumidas daquele deal -- o mesmo painel que ja existe no Pipeline/Kanban.

## Alteracoes

### `src/pages/admin/PendenciasPerda.tsx`
1. Adicionar estado `selectedDealId` e `sheetOpen` no componente principal `PendenciasPerda`
2. Renderizar o `DealDetailSheet` no final do JSX, passando `dealId`, `open` e `onOpenChange`
3. Passar callback `onDealClick` para o `OrphanDealCard`

### `OrphanDealCard` (mesmo arquivo)
1. Receber prop `onDealClick?: (dealId: string) => void`
2. Tornar o titulo do deal clicavel (cursor pointer, hover underline) chamando `onDealClick(deal.id)` ao clicar
3. O clique no titulo abre o sheet; os controles de atribuicao continuam funcionando normalmente sem interferencia

### Secao tecnica
- Importar `DealDetailSheet` de `@/components/deals/DealDetailSheet`
- Estado: `const [selectedDealId, setSelectedDealId] = useState<string | null>(null)`
- O sheet abre quando `selectedDealId !== null`
- Ao fechar o sheet, limpar o `selectedDealId`
- Mesma abordagem usada no `WorkbenchPage` que ja tem esse padrao implementado
