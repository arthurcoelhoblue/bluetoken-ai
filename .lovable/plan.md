

## Problema identificado

O botão "Sincronizar do PBX" (handleSync) apenas:
1. Lista os ramais existentes no PBX Zadarma
2. Atualiza o `sip_login` de ramais **já cadastrados** na tabela `zadarma_extensions`

Ele **não cria** novos registros automaticamente quando encontra ramais no PBX que não existem no CRM. Resultado: o ramal 110 aparece na lista do PBX mas não é inserido na tabela `zadarma_extensions` para a empresa selecionada.

## Correção

**Arquivo: `src/pages/ZadarmaConfigPage.tsx`** — na função `handleSync`:

Após atualizar os sip_login dos ramais existentes, adicionar lógica para identificar ramais do PBX que **não estão mapeados** no CRM e exibir um prompt ou automaticamente oferecer vinculação. Especificamente:

1. Comparar a lista retornada do PBX (`zadarmaExts`) com os `extensions` já mapeados
2. Mostrar os ramais não mapeados na UI de sincronização com um botão "Vincular" ao lado de cada um, com um dropdown de usuários
3. Alternativamente, mostrar um toast informando quantos ramais não estão vinculados e destacá-los visualmente na lista de sync

A abordagem mais simples: na seção `showSync` que já renderiza a lista do PBX, adicionar para cada ramal não mapeado um select de usuário + botão para criar o registro na `zadarma_extensions` para a empresa atual.

### Arquivo afetado
- `src/pages/ZadarmaConfigPage.tsx` — melhorar a UI de sync para permitir vincular ramais não mapeados

