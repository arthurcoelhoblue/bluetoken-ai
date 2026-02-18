
# Tornar o nome do cliente clicavel nos Insights do Copilot

## Problema atual
Os cards de insight mostram o nome do lead/cliente no titulo e descricao, mas esse nome nao e clicavel. O botao "Ver perfil de X" so aparece quando ha `lead_id`, e navega para a pagina do lead -- mas nao ha link direto para o deal.

## Solucao

### 1. Tornar o nome do lead clicavel no titulo do card
Em vez de exibir o titulo como texto simples, detectar o nome do lead dentro do titulo e renderiza-lo como um link clicavel (estilizado com cor primaria e underline no hover).

### 2. Adicionar link para o deal quando disponivel
O insight possui tanto `lead_id` quanto `deal_id`. O link "Ver perfil" atual aponta para o lead. Vamos adicionar tambem um link para o deal, que navega para `/pipeline?deal={deal_id}` -- a PipelinePage ja suporta abrir o DealDetailSheet via `selectedDealId`.

### 3. Atualizar PipelinePage para aceitar deal via query param
Adicionar logica na PipelinePage para ler `?deal=xxx` da URL e automaticamente abrir o DealDetailSheet com aquele deal.

---

## Detalhes tecnicos

### Arquivo: `src/components/copilot/CopilotInsightCard.tsx`

**Mudanca 1 -- Nome clicavel no titulo:**
- A funcao `resolveLeadName` atualmente retorna uma string. Criar uma nova funcao `renderTituloWithLink` que retorna JSX, substituindo a ocorrencia do nome do lead por um `<button>` clicavel que navega para a pagina do lead (`/leads/{lead_id}/{empresa}`).

**Mudanca 2 -- Link para o deal:**
- Quando `insight.deal_id` existir, exibir um link adicional "Ver negocio →" que navega para `/pipeline?deal={deal_id}`.
- O link existente "Ver perfil de X →" continua para o lead.

### Arquivo: `src/pages/PipelinePage.tsx`

**Mudanca -- Abrir deal via query param:**
- Ler `searchParams.get('deal')` da URL.
- Se presente, definir `selectedDealId` com esse valor para que o `DealDetailSheet` abra automaticamente ao carregar a pagina.
