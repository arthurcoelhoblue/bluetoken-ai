

## Diagnóstico do Copilot — 3 Bugs Raiz Identificados

Tracei o fluxo completo via session replay, network requests e edge function logs. Aqui está o que acontece:

### O Que Está Acontecendo

1. Usuário clica em "Qual o gargalo atual do pipeline?"
2. **DUAS requisições POST** idênticas são disparadas para `copilot-chat` no mesmo instante (23:00:40)
3. A primeira começa a fazer streaming (texto aparece: "Olha, analisando seus dados...")
4. A segunda é abortada imediatamente ("BodyStreamBuffer was aborted")
5. O streaming funciona por ~1 segundo, depois **para por 15s**
6. O **watchdog de inatividade de 15s** aborta a conexão
7. Mensagem de timeout aparece: "⏱️ A Amélia demorou demais"

### Bug 1: CRÍTICO — Dupla Requisição (sem guard de concorrência)

**Arquivo:** `CopilotPanel.tsx` → `sendMessage()`

Não existe proteção contra chamadas concorrentes. O `isLoading` é setado via `setState` (assíncrono), então se o componente não re-renderizar a tempo, um segundo clique ou um re-render do React pode disparar `sendMessage` novamente antes de `isLoading=true` tomar efeito.

**Correção:** Adicionar `useRef<boolean>` como guard síncrono:
```typescript
const isSendingRef = useRef(false);

const sendMessage = async (content: string) => {
  if (!content.trim() || isSendingRef.current) return;
  isSendingRef.current = true;
  // ... resto da lógica
  // no finally:
  isSendingRef.current = false;
};
```

### Bug 2: ALTO — Watchdog de 15s muito agressivo

**Arquivo:** `CopilotPanel.tsx`, linha 193

O Claude Haiku pode pausar o stream por mais de 15s durante "thinking" ou quando o contexto é muito grande (system prompt + dados do CRM + coaching RAG). Isso causa abort prematuro mesmo quando a resposta está chegando normalmente.

**Correção:** Aumentar para 30s e adicionar fallback non-streaming quando o watchdog dispara, em vez de simplesmente abortar:

```typescript
const INACTIVITY_TIMEOUT_MS = 30_000; // 30s ao invés de 15s
```

E quando o watchdog ou qualquer timeout aborta, fazer auto-retry com `stream: false` para garantir entrega da resposta:

```typescript
catch (err) {
  if (err instanceof DOMException && err.name === 'AbortError' && !retried) {
    // Auto-retry sem streaming
    const fallbackResp = await fetch(url, { 
      body: JSON.stringify({ ...payload, stream: false }) 
    });
    // processar resposta completa
  }
}
```

### Bug 3: MÉDIO — Mensagens renderizadas sem Markdown

**Arquivo:** `CopilotPanel.tsx`, linha 367

As respostas da Amélia usam **bold**, bullets e formatação markdown, mas o componente renderiza com `{msg.content}` puro + `whitespace-pre-wrap`. O texto fica com `**asteriscos**` visíveis ao invés de **negrito**.

**Correção:** Usar `react-markdown` (já instalado no projeto):
```tsx
import ReactMarkdown from 'react-markdown';
// ...
<div className="prose prose-sm dark:prose-invert max-w-none">
  <ReactMarkdown>{msg.content}</ReactMarkdown>
</div>
```

### Plano de Correção

| # | Arquivo | Mudança |
|---|---------|---------|
| 1 | `CopilotPanel.tsx` | Adicionar `isSendingRef` como guard síncrono contra dupla execução |
| 2 | `CopilotPanel.tsx` | Aumentar watchdog de 15s → 30s |
| 3 | `CopilotPanel.tsx` | Implementar auto-retry non-streaming no catch de AbortError |
| 4 | `CopilotPanel.tsx` | Renderizar mensagens com `ReactMarkdown` + prose styling |

Todas as mudanças são no mesmo arquivo. O backend (`copilot-chat/index.ts`) está correto — o problema é 100% no frontend.

