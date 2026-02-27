

## Plano: Amélia retoma contexto ao devolver atendimento

### Problema atual
Quando o vendedor clica "Devolver à Amélia", o sistema apenas muda o `modo` para `SDR_IA`. Se o lead enviou mensagens durante o modo MANUAL, essas mensagens já foram interpretadas mas com resposta suprimida (`modoManual: true`). A Amélia fica muda até o próximo inbound.

### Solução

**1. Adicionar flag `reprocess` ao `sdr-ia-interpret`** (edge function)
- Quando `reprocess=true`, pular o duplicate check (linhas 109-112) e deletar o intent anterior da mensagem antes de reprocessar
- Quando `reprocess=true`, NÃO verificar `modo === 'MANUAL'` (linhas 127-130) — o modo já foi atualizado antes da chamada
- Isso permite que a IA reinterprete a última mensagem com contexto completo e envie resposta

**2. Modificar `useConversationTakeover` no frontend** (`src/hooks/useConversationMode.ts`)
- Após o `DEVOLVER` com sucesso (modo atualizado para `SDR_IA`), buscar a última mensagem inbound do lead que tem intent com `resposta_enviada_em IS NULL`
- Chamar `sdr-ia-interpret` com `{ messageId, reprocess: true }` para que a Amélia processe e responda

### Arquivos afetados
- `supabase/functions/sdr-ia-interpret/index.ts` — adicionar suporte a `reprocess` flag
- `src/hooks/useConversationMode.ts` — trigger reprocessamento no DEVOLVER

### Fluxo resultante
```text
Vendedor clica "Devolver à Amélia"
  → modo atualizado para SDR_IA
  → busca última msg inbound sem resposta
  → chama sdr-ia-interpret(messageId, reprocess=true)
  → Amélia lê contexto completo (histórico + framework)
  → Amélia responde ao lead
```

