
## Correcao: Botoes "Abrir/Ver no Blue Chat" dando 404

### Problema

Apos a correcao anterior, os dois botoes que abrem o Blue Chat estao gerando URLs com formato `/{slug}/conversation/{id}`, que resulta em 404. O Blue Chat nao suporta essa rota.

Confirmei acessando diretamente:
- `https://chat.grupoblue.com.br/blue-consult/conversation/cmm0sfl1601m77e17k2v14clk` -> **404**
- `https://chat.grupoblue.com.br/open/blue-consult/5587999188396` -> **Funciona** (login do ChatBlue)

### Causa raiz

A funcao `buildBluechatDeepLink` em `src/utils/bluechat.ts` foi escrita assumindo que o Blue Chat teria uma rota `/conversation/{id}`, mas essa rota nao existe. O unico formato que funciona e `/open/{slug}/{telefone}`.

### Solucao

**Arquivo: `src/utils/bluechat.ts`**

Remover o branch que usa `bluechatConversationId` na funcao `buildBluechatDeepLink`. Manter APENAS o formato por telefone que comprovadamente funciona:

```text
Antes:
  if (bluechatConversationId) {
    return `${BLUECHAT_BASE_URL}/${slug}/conversation/${bluechatConversationId}`;
  }
  // fallback por telefone...

Depois:
  // Sempre usar formato por telefone (unico suportado pelo Blue Chat)
  if (!telefone) return null;
  const digits = telefone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  return `${BLUECHAT_BASE_URL}/open/${slug}/${digits}`;
```

A assinatura da funcao pode manter o terceiro parametro opcional para nao quebrar chamadas existentes, mas ele sera ignorado.

### Arquivos afetados

- `src/utils/bluechat.ts` — remover branch de conversation ID (unica alteracao necessaria)

Nenhum outro arquivo precisa mudar, pois todos chamam `buildBluechatDeepLink` que sera corrigida centralmente.
