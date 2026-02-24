

## Correcao: Link "Abrir no Blue Chat" inconsistente

### Problema
O link "Ver no Blue Chat" as vezes abre a conversa existente e as vezes cria uma nova. A causa e que o `bluechatConversationId` (ticket ID salvo no `framework_data`) nao esta sendo passado para a funcao `buildBluechatDeepLink` em dois lugares do codigo.

Quando o conversation ID esta disponivel, o link usa o formato `/conversation/{id}` que abre exatamente o ticket certo. Sem ele, o link usa `/open/{slug}/{telefone}` que depende do Blue Chat encontrar o contato pelo numero — e se o formato nao bater exatamente, abre uma conversa nova.

### Causa raiz

**Arquivo 1: `src/components/conversas/ConversationPanel.tsx` (linha 73)**
O componente busca o `bluechatConversationId` do banco (linhas 53-70) mas NAO passa para a funcao:

```text
// Bugado — ignora o terceiro parametro
buildBluechatDeepLink(empresa, telefone || '')

// Correto
buildBluechatDeepLink(empresa, telefone || '', bluechatConversationId)
```

**Arquivo 2: `src/pages/LeadDetail.tsx` (linha 208)**
Tambem chama sem o conversation ID. Precisa buscar do `framework_data` ou receber como prop.

### Solucao

**1. `src/components/conversas/ConversationPanel.tsx`**
- Linha 73: passar `bluechatConversationId` como terceiro argumento de `buildBluechatDeepLink`

**2. `src/pages/LeadDetail.tsx`**
- Buscar `bluechat_conversation_id` do `lead_conversation_state` para cada contato
- Passar como terceiro argumento na chamada da linha 208

### Resultado esperado
- Quando existir um ticket/conversa ja registrado no `framework_data`, o link abrira diretamente essa conversa (formato `/conversation/{id}`)
- Quando nao existir, continuara usando o fallback por telefone (comportamento atual)
- Isso elimina a inconsistencia de abrir conversas novas para leads que ja tem ticket

### Arquivos afetados
- `src/components/conversas/ConversationPanel.tsx` — correcao simples (1 linha)
- `src/pages/LeadDetail.tsx` — adicionar busca do conversation_id e passar na chamada

