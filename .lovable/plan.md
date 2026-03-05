

## Diagnóstico e Solução: Chamadas não registradas + Auto-vinculação por telefone

### O que aconteceu com a ligação pro Tiago

A ligação foi feita com sucesso (console logs confirmam `click_to_call success` + WebRTC ativo por ~10s). Porém:

1. **Nenhum webhook chegou** — a tabela `call_events` está vazia para hoje, o que significa que o Zadarma PBX não enviou `NOTIFY_OUT_START` / `NOTIFY_END`
2. **Sem registro na tabela `calls`** — o frontend **não cria** registros de chamadas; apenas o webhook faz isso
3. **O fallback do frontend falhou** — `closeActiveCallRecord()` tentou fechar um registro existente mas não encontrou nenhum ("No open call record to close")
4. **Sem transcrição** — sem registro = sem `recording_url` = sem transcrição

O contato "Tiago" (id: `2e6f0c23`) existe na TOKENIZA com telefone `+5521985477371` e tem um deal aberto "Tiago" no pipeline "Ofertas Públicas".

### Solução em duas partes

#### 1. Frontend cria registro de chamada ao iniciar (fallback resiliente)

Atualmente, apenas o webhook cria registros na tabela `calls`. Se o webhook falhar ou atrasar, a chamada é perdida.

**Mudança no `ZadarmaPhoneWidget.tsx`**: Ao receber `click_to_call success`, o frontend cria imediatamente um registro na tabela `calls` com os dados disponíveis (empresa, número, extensão, user_id). O webhook, quando chegar, faz upsert via `pbx_call_id` ao invés de criar duplicatas.

#### 2. Auto-vinculação por telefone (contact + deal)

Quando o frontend cria o registro de chamada, ele deve:
- Buscar na tabela `contacts` por telefone correspondente (últimos 9 dígitos) na mesma empresa
- Se encontrar contato, vincular `contact_id`
- Se o contato tiver um deal ABERTO, vincular `deal_id`
- Isso funciona **mesmo que a chamada não tenha sido iniciada de dentro de um deal**

#### Mudanças técnicas

**`src/components/zadarma/ZadarmaPhoneWidget.tsx`**:
- No `onSuccess` do `click_to_call`, criar registro na tabela `calls` via `supabase.from('calls').insert()`
- Incluir lógica de busca por telefone: `contacts` → `deals` (ABERTO, mais recente)
- Guardar o `call.id` criado em um ref para uso no `closeActiveCallRecord` e no `CallSummaryDialog`

**`src/hooks/useZadarmaWebRTC.ts`**:
- Ajustar `closeActiveCallRecord` para aceitar um `callId` direto (passado pelo widget) ao invés de buscar "qualquer chamada sem ended_at"

**`supabase/functions/zadarma-webhook/index.ts`**:
- No `NOTIFY_START` / `NOTIFY_OUT_START`, fazer upsert via `pbx_call_id` ao invés de insert puro, para não duplicar se o frontend já criou o registro

### Arquivos afetados
1. `src/components/zadarma/ZadarmaPhoneWidget.tsx` — criar registro + auto-link
2. `src/hooks/useZadarmaWebRTC.ts` — aceitar callId direto
3. `supabase/functions/zadarma-webhook/index.ts` — upsert ao invés de insert

