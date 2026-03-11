

## Plano: Garantir visualização dos dados do formulário na timeline

### Diagnóstico
- **Dados no banco**: Confirmados. 4 atividades `CRIACAO` com `origem: FORMULARIO` existem, incluindo mychel@blueconsult.com.br.
- **Código de renderização**: Correto em `DealTimelineTab.tsx` (linhas 138-164).
- **Causa provável**: O `DuplicatePendencyCard` em `/pendencias` não permite abrir o deal para ver a timeline. Além disso, o tipo de atividade `CALL` (inserido por trigger de telefonia) não existe nos mapas `ACTIVITY_ICONS` e `ACTIVITY_LABELS`, o que pode causar renders em branco.

### Mudanças

#### 1. `DuplicatePendencyCard` — Adicionar botão "Ver Deal"
Adicionar um botão que permite abrir o DealDetailSheet diretamente da pendência de duplicação. Aceitar uma prop `onDealClick` e chamar ao clicar no título ou num botão "Ver".

#### 2. `PendenciasPerda.tsx` — Passar callback para DuplicatePendencyCard
Conectar o `setSelectedDealId` ao novo `onDealClick` do card de duplicação.

#### 3. `src/types/deal.ts` — Adicionar tipo `CALL`
Incluir `'CALL'` no union type `DealActivityType` e nos mapas `ACTIVITY_LABELS` e `ACTIVITY_ICONS` para evitar renders vazios quando atividades de chamada existem na timeline.

### Arquivos impactados
- `src/components/pendencias/DuplicatePendencyCard.tsx`
- `src/pages/admin/PendenciasPerda.tsx`
- `src/types/deal.ts`

