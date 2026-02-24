

## Remover botao "Testar WhatsApp" da tela de conversas (LeadDetail)

### O que sera feito

Remover o componente `WhatsAppTestButton` da pagina `LeadDetail.tsx`, incluindo o `Separator` que o precede e o import no topo do arquivo.

### Arquivos afetados

**`src/pages/LeadDetail.tsx`**
- Remover o import do `WhatsAppTestButton` (linha 25)
- Remover o `<Separator />` e o bloco `<WhatsAppTestButton ... />` (linhas 199-206)

O arquivo `src/components/whatsapp/WhatsAppTestButton.tsx` sera mantido no projeto caso seja util futuramente em outro contexto (ex: pagina de configuracoes).

