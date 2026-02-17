

# Atualizar Deep Links do Blue Chat + Preservar Chat Interno

## Principio

Nenhum codigo do chat interno sera removido. As funcoes, states, hooks e botoes continuam existindo -- apenas ficam **condicionalmente invisiveis** quando o modo Blue Chat esta ativo. Se o modo for desativado, tudo volta a funcionar como antes sem nenhuma alteracao de codigo.

## Mudancas

### 1. Criar `src/utils/bluechat.ts` (constantes centralizadas)

```typescript
export const BLUECHAT_BASE_URL = 'https://chat.grupoblue.com.br';

export const EMPRESA_TO_SLUG: Record<string, string> = {
  TOKENIZA: 'tokeniza',
  BLUE: 'blue-consult',
  MPUPPE: 'mpuppe',
  AXIA: 'axia',
};

export function buildBluechatDeepLink(empresa: string, telefone: string): string | null {
  const slug = EMPRESA_TO_SLUG[empresa];
  if (!slug || !telefone) return null;
  const digits = telefone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  return `${BLUECHAT_BASE_URL}/open/${slug}/${digits}`;
}
```

### 2. `ConversationPanel.tsx`

- Manter `useEffect` que busca `bluechatConversationId` (usado para transferencias)
- Manter state `bluechatConversationId`
- Trocar apenas a construcao do deep link: usar `buildBluechatDeepLink(empresa, telefone)` em vez de `{frontendUrl}/conversation/{id}`
- O link "Ver no Blue Chat" continua condicional a `isBluechat`

### 3. `ConversationTakeoverBar.tsx`

- Manter toda a logica de transferencia, ticket_id, agents (tudo intacto)
- Adicionar prop `telefone` para construir o deep link
- No `handleTakeover`, trocar `window.open` para usar `buildBluechatDeepLink(empresa, telefone)`
- Manter o `bluechatConversationId` prop (usado para transferencias, nao para URL)

### 4. `ManualMessageInput.tsx`

- Manter toda a logica de envio (textarea, send, etc)
- No bloco Blue Chat (linha 84-122): trocar o botao "Responder no Blue Chat" para usar `buildBluechatDeepLink` em vez de `{frontendUrl}/conversation/{id}`
- A funcao `handleOpenBluechat` usa o novo helper
- Todo o resto fica igual

### 5. `LeadDetail.tsx`

- Substituir as constantes locais `BLUECHAT_BASE_URL` e `EMPRESA_TO_SLUG` pelo import de `src/utils/bluechat.ts`
- Usar `buildBluechatDeepLink` para o botao "Abrir no Blue Chat"

### 6. `useChannelConfig.ts`

- Remover a busca de `bluechat_frontend_url` do `system_settings` (URL base agora e fixa)
- Remover `bluechatFrontendUrl` do retorno
- Manter apenas a verificacao de `integration_company_config` para `isBluechat`/`isMensageria`

### 7. Backend: `channel-resolver.ts`

- Manter `resolveChannelConfig`, `sendViaBluechat`, `openBluechatConversation` (intactos)
- Manter `resolveBluechatFrontendUrl` (nao remover, apenas nao sera mais chamado do frontend -- pode ser util no futuro)

### 8. Backend: `bluechat-proxy` acao `get-frontend-url`

- Manter a acao (nao remover). Apenas nao sera mais chamada pelo frontend, mas fica disponivel caso necessario

## Resumo de impacto

| Componente | O que muda | O que NAO muda |
|---|---|---|
| `src/utils/bluechat.ts` | Novo arquivo com constantes | -- |
| `ConversationPanel` | Deep link usa novo helper | State, useEffect, props, logica intactos |
| `TakeoverBar` | Deep link usa novo helper + recebe `telefone` | Transferencia, ticket_id, agents intactos |
| `ManualMessageInput` | Deep link usa novo helper | Textarea, envio, logica de modo intactos |
| `LeadDetail` | Import centralizado | Botao e logica intactos |
| `useChannelConfig` | Remove fetch de `frontend_url` | Verificacao de canal intacta |
| `channel-resolver.ts` | Nada removido | Tudo intacto |
| `bluechat-proxy` | Nada removido | Tudo intacto |

## Arquivos a modificar

| Arquivo | Tipo |
|---|---|
| `src/utils/bluechat.ts` | Criar |
| `src/components/conversas/ConversationPanel.tsx` | Editar (deep link) |
| `src/components/conversas/ConversationTakeoverBar.tsx` | Editar (deep link + prop telefone) |
| `src/components/conversas/ManualMessageInput.tsx` | Editar (deep link) |
| `src/pages/LeadDetail.tsx` | Editar (importar do utils) |
| `src/hooks/useChannelConfig.ts` | Editar (remover fetch frontend_url) |

Zero alteracoes no backend. Zero remocoes de funcionalidade.

