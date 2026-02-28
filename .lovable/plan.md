

# Proteção de Ramais Externos (Pipedrive)

## Problema
A seção "Ramais no Zadarma (não mapeados)" mostra um botão "Remover do PBX" para ramais que podem estar em uso no Pipedrive ou outros sistemas. Excluir acidentalmente causaria problemas.

## Solução
1. **Remover o botão "Remover do PBX"** da listagem de ramais não mapeados — ou movê-lo para trás de uma confirmação explícita com aviso de que o ramal pode estar em uso externamente
2. **Adicionar badge "Externo"** — os ramais não mapeados terão um label neutro indicando que existem no PBX mas não estão vinculados ao CRM
3. **Manter apenas o botão "Importar"** — para vincular ao CRM quando desejado, sem risco de exclusão

### Alteração em `ZadarmaConfigPage.tsx`
- Na seção `unmappedExts`, substituir o botão destrutivo "Remover do PBX" por:
  - Badge cinza "Usado externamente" 
  - Botão "Vincular ao CRM" (importar para uso local)
  - Opcionalmente, um botão "Excluir do PBX" escondido atrás de um AlertDialog com aviso: _"Este ramal pode estar em uso em outros sistemas (ex: Pipedrive). Tem certeza?"_

