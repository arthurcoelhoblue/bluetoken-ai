

## Auto-vinculação de ramais durante sincronização do PBX

### Problema
Quando o sync roda, ramais do PBX que já estão atribuídos a usuários na tabela `zadarma_extensions` (criados via tela de Usuários) aparecem como "não vinculados" se foram cadastrados para uma empresa diferente da empresa ativa no momento, ou se o `sip_login` ainda não foi preenchido. O sistema deveria reconhecer automaticamente esses ramais e vinculá-los.

### Correção

**Arquivo: `src/pages/ZadarmaConfigPage.tsx`** — na função `handleSync`:

Após obter a lista do PBX e identificar os ramais não mapeados (`unmappedExts`), adicionar um passo de auto-vinculação:

1. Para cada ramal não mapeado no PBX, consultar `zadarma_extensions` **sem filtro de empresa** para verificar se o `extension_number` já está atribuído a um usuário
2. Se encontrar um registro existente para outra empresa, criar automaticamente um novo registro para a empresa atual com o mesmo `user_id` e o `sip_login` do PBX
3. Se não encontrar nenhum registro, manter como "não vinculado" na UI (comportamento atual)
4. Mostrar toast informando quantos ramais foram auto-vinculados

O fluxo fica:
```text
PBX retorna ramais → Atualiza sip_login dos já mapeados → 
Para cada não mapeado: busca em zadarma_extensions (qualquer empresa) →
  Se encontrou user_id → cria registro para empresa atual automaticamente
  Se não → mostra como "não vinculado" na UI
```

### Arquivo afetado
- `src/pages/ZadarmaConfigPage.tsx` — adicionar auto-link no `handleSync`

