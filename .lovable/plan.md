

# Corrigir aba Investimentos vazia

## Problema
O componente `CSAportesTab` (linha 38) filtra contratos por `.eq('tipo', 'crowdfunding')`, mas os dados sincronizados têm `tipo = 'other'` (7.567) e `tipo = 'mining'` (157). Resultado: lista sempre vazia.

## Correção
Remover o filtro `.eq('tipo', 'crowdfunding')` da query em `src/components/cs/CSAportesTab.tsx` (linha 38). A query já filtra por `customer_id`, então todos os contratos do cliente aparecerão corretamente.

