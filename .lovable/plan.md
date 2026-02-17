
# Atualizar Deep Links do Blue Chat para formato correto

## Situacao Atual

O codigo atual constroi URLs do Blue Chat no formato:
```
{frontend_url}/conversation/{bluechat_conversation_id}
```

O formato real e:
```
{BASE_URL}/open/{COMPANY_SLUG}/{TELEFONE_NORMALIZADO}
```

Exemplo: `https://chat.grupoblue.com.br/open/tokeniza/5511999887766`

Ja existe um mapeamento parcial em `LeadDetail.tsx` com `EMPRESA_TO_SLUG`, mas os outros componentes (ConversationPanel, ConversationTakeoverBar, ManualMessageInput) ainda usam o formato errado.

## Mudancas

### 1. Criar constantes centralizadas

Extrair `BLUECHAT_BASE_URL` e `EMPRESA_TO_SLUG` para um utilitario compartilhado (`src/utils/bluechat.ts`) com todos os slugs:

```typescript
export const BLUECHAT_BASE_URL = 'https://chat.grupoblue.com.br';

export const EMPRESA_TO_SLUG: Record<string, string> = {
  TOKENIZA: 'tokeniza',
  BLUE: 'blue-consult',
  // Futuros: MPUPPE: 'mpuppe', AXIA: 'axia'
};

export function buildBluechatDeepLink(empresa: string, telefone: string): string | null {
  const slug = EMPRESA_TO_SLUG[empresa];
  if (!slug || !telefone) return null;
  const digits = telefone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  return `${BLUECHAT_BASE_URL}/open/${slug}/${digits}`;
}
```

### 2. Simplificar `ConversationPanel.tsx`

- Remover o `useEffect` que busca `bluechat_conversation_id` do `framework_data` (nao e mais necessario para o deep link)
- Remover o state `bluechatConversationId`
- Usar `buildBluechatDeepLink(empresa, telefone)` para o link "Ver no Blue Chat"
- O componente ja recebe `telefone` como prop

### 3. Simplificar `ConversationTakeoverBar.tsx`

- No `handleTakeover`, trocar o `window.open` para usar `buildBluechatDeepLink(empresa, telefone)` em vez de `{frontend_url}/conversation/{id}`
- Adicionar `telefone` como prop do componente (ja vem do `ConversationPanel`)
- Manter a busca de `bluechat_ticket_id` do `framework_data` apenas para a funcionalidade de **transferencia** (que usa o ticket_id para chamar a API, nao para montar URL)

### 4. Simplificar `ManualMessageInput.tsx`

- O link "Responder no Blue Chat" usa `buildBluechatDeepLink` em vez do `bluechatConversationId`
- Ja recebe `telefone` como prop

### 5. Atualizar `LeadDetail.tsx`

- Substituir as constantes locais pelo import de `src/utils/bluechat.ts`

### 6. Simplificar `useChannelConfig.ts`

- Remover a busca de `bluechat_frontend_url` do `system_settings` (nao e mais necessario, a URL base e fixa)
- Manter apenas a verificacao de `integration_company_config` para saber se `bluechat` esta ativo

### 7. Backend: `channel-resolver.ts`

- Remover `resolveBluechatFrontendUrl` (nao mais necessario)
- A funcao `resolveChannelConfig` continua igual (usada para decidir roteamento de mensagens)

### 8. Backend: `bluechat-proxy` acao `get-frontend-url`

- Remover essa acao (nao mais utilizada)

## Arquivos a modificar

| Arquivo | Acao |
|---------|------|
| `src/utils/bluechat.ts` | Criar (constantes + helper) |
| `src/components/conversas/ConversationPanel.tsx` | Simplificar (remover fetch de conversation_id para deep link) |
| `src/components/conversas/ConversationTakeoverBar.tsx` | Usar novo helper + receber telefone |
| `src/components/conversas/ManualMessageInput.tsx` | Usar novo helper |
| `src/pages/LeadDetail.tsx` | Importar do utils |
| `src/hooks/useChannelConfig.ts` | Remover busca de frontend_url |
| `supabase/functions/_shared/channel-resolver.ts` | Remover `resolveBluechatFrontendUrl` |
| `supabase/functions/bluechat-proxy/index.ts` | Remover acao `get-frontend-url` |

## Vantagens

- Nao depende mais de `bluechat_conversation_id` existir no `framework_data` para gerar o link
- Funciona para qualquer lead que tenha telefone, mesmo antes de a conversa ser aberta no Blue Chat
- URL base fixa, sem necessidade de configuracao em `system_settings`
- Codigo mais simples e menos queries ao banco
