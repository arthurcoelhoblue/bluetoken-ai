

## Correcao: Amélia continua falando apos atendente assumir no Blue Chat

### Problema
Quando um atendente assume uma conversa no Blue Chat (takeover para MANUAL), a Amelia continua respondendo. Caso comprovado com a lead Maria de Nazare Muniz dos Santos:
- Takeover ASSUMIR registrado as 18:49:56
- Amelia enviou mensagem as 18:50:32 (36 segundos depois)

### Causa raiz (2 pontos de falha)

**1. `bluechat-inbound/index.ts` (orquestrador)**
Nao existe NENHUMA verificacao do campo `modo` da `lead_conversation_state` antes de chamar o SDR IA e montar resposta. A funcao recebe o webhook, salva a mensagem e chama `callSdrIaInterpret` incondicionalmente.

**2. `sdr-ia-interpret/index.ts` (linha 128)**
A verificacao de modo MANUAL exclui explicitamente o Blue Chat:
```
if (isManualMode && source !== 'BLUECHAT') {
```
Isso significa que mesmo que o modo seja MANUAL, mensagens vindas do Blue Chat nao sao suprimidas.

### Solucao

**Arquivo 1: `supabase/functions/bluechat-inbound/index.ts`**
Adicionar verificacao do modo LOGO APOS salvar a mensagem (etapa 5) e ANTES de chamar o SDR IA (etapa 6):

```typescript
// 5.1. Verificar modo de atendimento — se MANUAL, NÃO acionar IA
const { data: modoCheck } = await supabase
  .from('lead_conversation_state')
  .select('modo')
  .eq('lead_id', leadContact.lead_id)
  .eq('empresa', empresa)
  .maybeSingle();

if (modoCheck?.modo === 'MANUAL') {
  log.info('Modo MANUAL ativo — suprimindo resposta automática', {
    leadId: leadContact.lead_id,
    empresa,
  });

  // Salvar conversation_id/ticket_id mesmo em modo manual
  // (para manter rastreabilidade)
  // ... (bloco existente de persistencia do conversation_id)

  return new Response(JSON.stringify({
    success: true,
    conversation_id: payload.conversation_id,
    message_id: savedMessage.messageId,
    lead_id: leadContact.lead_id,
    action: 'QUALIFY_ONLY',
    intent: { detected: 'MANUAL_MODE', confidence: 1, lead_ready: false },
    escalation: { needed: false },
    manual_mode: true,
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

**Arquivo 2: `supabase/functions/sdr-ia-interpret/index.ts`**
Remover a exclusao `&& source !== 'BLUECHAT'` nas linhas 128 e 152, para que o modo MANUAL seja respeitado independentemente da fonte. Isso serve como segunda camada de protecao:

```typescript
// Antes (bugado)
if (isManualMode && source !== 'BLUECHAT') {

// Depois (corrigido)
if (isManualMode) {
```

### Por que duas camadas?

1. **Camada 1 (bluechat-inbound)**: Impede a chamada ao SDR IA completamente, economizando latencia e tokens. E o ponto correto para a decisao.

2. **Camada 2 (sdr-ia-interpret)**: Fallback de seguranca caso algum outro fluxo futuro chame o interpret com source BLUECHAT. Defesa em profundidade.

### Sequencia de execucao

1. Editar `bluechat-inbound/index.ts` — inserir check de modo MANUAL apos etapa 5 (save message)
2. Editar `sdr-ia-interpret/index.ts` — remover exclusao `source !== 'BLUECHAT'` (linhas 128 e 152)
3. Deploy das duas edge functions
4. Validar com lead em modo MANUAL que Amelia nao responde

### Arquivos afetados
- `supabase/functions/bluechat-inbound/index.ts`
- `supabase/functions/sdr-ia-interpret/index.ts`
