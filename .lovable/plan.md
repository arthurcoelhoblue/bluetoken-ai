

# Diagnóstico: Transcrição de Chamadas e Alimentação do Copilot

## Estado Atual

### 1. Tabela `calls` está vazia
A query `SELECT * FROM calls` retornou **0 registros**. Apesar do widget WebRTC estar funcionando (os console logs mostram chamadas sendo feitas e atendidas), o **webhook do Zadarma não está recebendo eventos** — não há logs para `zadarma-webhook`.

Isso significa que o Zadarma PBX não está configurado para enviar webhooks para a URL da Edge Function.

### 2. Fluxo de transcrição (correto, mas nunca dispara)
O pipeline está corretamente implementado:
- `zadarma-webhook` recebe `NOTIFY_RECORD` → salva `recording_url` → chama `call-transcribe`
- `call-transcribe` faz download do áudio → Whisper transcrição → análise de sentimento via IA → salva em `calls.transcription`, `calls.summary_ia`, `calls.sentiment`
- Cria `deal_activity` com resumo da chamada

**Mas como nenhum webhook chega, nada disso executa.**

### 3. Copilot NÃO consome transcrições
Mesmo que as transcrições existissem, o copilot **não as utiliza**:
- `copilot-chat` → `enrichDealContext()` busca `deal_activities` (que incluiriam resumos de chamadas via tipo `LIGACAO`), mas **não busca diretamente** da tabela `calls` (transcrição completa, sentimento, action_items)
- `copilot-proactive` → busca `deal_activities` genéricas, sem tratamento especial para dados de chamadas

## Problemas Identificados

### Problema A: Webhook Zadarma não configurado
O PBX Zadarma precisa ter a URL do webhook configurada no painel Zadarma apontando para:
`https://xdjvlcelauvibznnbrzb.supabase.co/functions/v1/zadarma-webhook`

**Ação necessária do usuário**: Configurar a URL do webhook no painel administrativo do Zadarma (Configurações → API → URL de notificação).

### Problema B: Copilot não consome transcrições diretamente
Mesmo quando as transcrições funcionarem, o copilot só verá o resumo curto nas `deal_activities`. Não terá acesso à transcrição completa, sentimento, ou action_items.

**Correção proposta**: Adicionar busca de `calls` com transcrição no `enrichDealContext()` do `copilot-chat`:

```typescript
// Dentro de enrichDealContext, após buscar deal_activities:
const callsResult = await supabase
  .from('calls')
  .select('direcao, duracao_segundos, transcription, summary_ia, sentiment, action_items, created_at')
  .eq('deal_id', dealId)
  .not('transcription', 'is', null)
  .order('created_at', { ascending: false })
  .limit(5);

if (callsResult.data?.length > 0) {
  const callsSummary = callsResult.data.map(c => 
    `- ${c.direcao} (${Math.round(c.duracao_segundos/60)}min) [${c.sentiment}]: ${c.summary_ia}\n  Transcrição: ${c.transcription?.substring(0, 500)}\n  Ações: ${(c.action_items || []).join(', ')}`
  ).join('\n');
  parts.push(`**Chamadas Transcritas**:\n${callsSummary}`);
}
```

Também adicionar chamadas recentes no `copilot-proactive` para que a IA possa sugerir follow-ups baseados em sentimento/action_items.

## Plano de Ação

1. **Configurar webhook Zadarma** — o usuário precisa acessar o painel Zadarma e configurar a URL de notificação
2. **Enriquecer copilot-chat** — adicionar busca de transcrições de chamadas no `enrichDealContext()`
3. **Enriquecer copilot-proactive** — adicionar chamadas recentes com sentimento negativo ou action_items pendentes ao snapshot do vendedor
4. **Redeploy** das edge functions `copilot-chat` e `copilot-proactive`

