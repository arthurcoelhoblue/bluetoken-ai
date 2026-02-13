
## Implementar botao "Devolver a Amelia" funcional na pagina de detalhe do lead

### Problema atual
O componente `ConversationTakeoverBar` ja possui toda a logica de "Devolver a Amelia" implementada, mas a pagina `LeadDetail` nao passa os dados corretos porque:

1. O tipo `ConversationState` (em `src/types/conversation.ts`) nao inclui os campos `modo`, `assumido_por` e `assumido_em`
2. O hook `useConversationState` (em `src/hooks/useConversationState.ts`) nao mapeia esses campos no retorno
3. A pagina `LeadDetail` passa `assumidoPorNome={null}` fixo (linha 371)

O lead atual esta com `modo: MANUAL` e `assumido_por: 3eb15a6a...`, entao o botao deveria aparecer como "Devolver a Amelia" mas pode nao estar funcionando corretamente por falta dos dados.

### Mudancas

**1. `src/types/conversation.ts`** - Adicionar campos de takeover ao tipo `ConversationState`:

```typescript
export interface ConversationState {
  // ... campos existentes ...
  modo?: 'SDR_IA' | 'MANUAL' | 'HIBRIDO';
  assumido_por?: string | null;
  assumido_em?: string | null;
  devolvido_em?: string | null;
}
```

**2. `src/hooks/useConversationState.ts`** - Incluir `modo`, `assumido_por`, `assumido_em` e `devolvido_em` no mapeamento de retorno:

```typescript
return {
  // ... campos existentes ...
  modo: data.modo || 'SDR_IA',
  assumido_por: data.assumido_por || null,
  assumido_em: data.assumido_em || null,
  devolvido_em: data.devolvido_em || null,
};
```

**3. `src/pages/LeadDetail.tsx`** - Passar `modo` e `assumidoPorNome` corretamente ao `ConversationPanel`:

- Usar `conversationState?.modo` em vez de cast `(conversationState as any)?.modo`
- Buscar o nome do usuario que assumiu (via `assumido_por`) para exibir no badge "por Fulano"
- Como buscar o nome do usuario exigiria uma query extra, a abordagem mais simples e exibir apenas o modo sem o nome, ou fazer um select na tabela `profiles` se existir

### Resultado esperado
- Quando o lead esta em modo `MANUAL`, a barra mostra "Modo Manual" com botao "Devolver a Amelia"
- Ao clicar, abre o dialog de confirmacao ja existente
- Ao confirmar, o hook `useConversationTakeover` atualiza `lead_conversation_state.modo` para `SDR_IA` e registra no `conversation_takeover_log`
- A UI atualiza automaticamente via invalidacao do query cache
