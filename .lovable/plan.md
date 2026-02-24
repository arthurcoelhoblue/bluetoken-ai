
## Correcao: Amelia continua respondendo apos escalacao (ESCALAR_HUMANO)

### Problema identificado

Analisando os dados do lead `a70b1b62` (telefone 556799960045):

| Hora | Evento | Problema |
|------|--------|----------|
| 19:49:32 | Lead: "Preciso falar com Roney Gustavo" | - |
| 19:49:38 | IA classificou como `OUTRO` com acao `ENVIAR_RESPOSTA_AUTOMATICA` | **BUG 1**: Deveria ser `ESCALAR_HUMANO` |
| 19:49:39 | Amelia: "Vou chamar o Roney..." | Resposta parece correta, mas acao nao escalou |
| 19:57:26 | Lead envia midia (sem texto) | - |
| 19:57:34 | Amelia: "Enquanto chamo o Roney..." | **BUG 2**: modo nunca foi setado para MANUAL |
| 19:57:53 | Usuario assumiu manualmente pelo botao | Solucao paliativa |

### Causa raiz

**BUG 1 - Classificador nao detecta pedido explicito de falar com humano**

Quando o lead diz "Preciso falar com Roney Gustavo" (nome de um vendedor), o classificador deveria detectar `SOLICITACAO_CONTATO` com acao `ESCALAR_HUMANO`. Porem, classificou como `OUTRO` com `ENVIAR_RESPOSTA_AUTOMATICA`.

O gerador de resposta gerou o texto correto ("Vou chamar o Roney"), mas a acao ficou como `ENVIAR_RESPOSTA_AUTOMATICA`, entao o `action-executor` nao setou `modo = MANUAL`.

**BUG 2 - Consequencia direta**: Como `modo` ficou `SDR_IA`, a mensagem inbound seguinte (8 min depois) passou pela verificacao de modo na linha 497 do `bluechat-inbound/index.ts` e a IA respondeu normalmente.

### Solucao

Dois ajustes complementares:

#### A) Regra explicita no classificador para pedido de falar com pessoa/humano

**Arquivo: `supabase/functions/sdr-ia-interpret/intent-classifier.ts`**

Adicionar regra rule-based (antes da chamada a IA) que detecta quando o lead pede explicitamente para falar com alguem:

```text
Padroes a detectar:
- "preciso falar com [nome]"
- "quero falar com [nome]"
- "me passa pro [nome]"
- "chama o [nome]"
- "transfere pro [nome]"
- "quero falar com um humano"
- "falar com atendente"
- "falar com vendedor"
```

Essa regra retorna:
- `intent: 'SOLICITACAO_CONTATO'`
- `acao: 'ESCALAR_HUMANO'`
- `deve_responder: true`
- `resposta_sugerida` com mensagem de transferencia

#### B) Guardrail no bluechat-inbound: detectar ESCALAR_HUMANO no texto mesmo quando acao e diferente

**Arquivo: `supabase/functions/bluechat-inbound/index.ts`**

Apos receber o resultado do sdr-ia-interpret, se o `responseText` contem padroes de transferencia ("vou chamar", "vou te conectar", "transferir") mas a acao NAO e ESCALAR_HUMANO, forcar a acao para ESCALATE e setar modo=MANUAL.

Isso serve como rede de seguranca para quando o classificador erra a acao mas acerta a resposta.

```text
Logica:
if (responseText matches /vou (chamar|transferir|conectar|passar)/i && action !== 'ESCALATE') {
  action = 'ESCALATE';
  // Setar modo MANUAL imediatamente
  await supabase.from('lead_conversation_state')
    .update({ modo: 'MANUAL' })
    .eq('lead_id', leadId)
    .eq('empresa', empresa);
}
```

### Arquivos afetados

1. **`supabase/functions/sdr-ia-interpret/intent-classifier.ts`** — Adicionar regra rule-based para pedido explicito de falar com pessoa
2. **`supabase/functions/bluechat-inbound/index.ts`** — Guardrail pos-IA para detectar incoerencia entre texto e acao

### Resultado esperado

- Lead diz "Preciso falar com Roney" → classificado como `ESCALAR_HUMANO` → `modo = MANUAL` → Amelia fica muda para proximas mensagens
- Mesmo que o classificador erre a acao, o guardrail no bluechat-inbound detecta o texto de transferencia e forca ESCALATE
