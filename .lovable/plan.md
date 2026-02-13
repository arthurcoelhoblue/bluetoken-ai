

## Ajustar Anti-Limbo: Perguntar em vez de escalar

### Problema
Quando a IA retorna sem texto de resposta (mas com resultado parcial) ou retorna `null`, o sistema escala automaticamente para humano. Isso faz a Amelia "ficar muda" e perder o lead desnecessariamente, mesmo em casos onde ela poderia simplesmente perguntar mais detalhes.

### Mudanca proposta

No bloco anti-limbo do `bluechat-inbound/index.ts` (linhas 1041-1078), alterar o comportamento em dois cenarios:

#### 1. IA retornou null (falha total) -- linhas 1042-1046
**Antes:** Escala imediatamente com mensagem tecnica.
**Depois:** Envia pergunta de continuidade, so escala se ja falhou antes na mesma sessao.

```
Se iaResult == null:
  Verificar quantas falhas consecutivas da IA esse lead teve (campo em framework_data)
  Se for a 1a ou 2a falha consecutiva:
    action = RESPOND
    responseText = "Desculpa, pode repetir ou dar mais detalhes? Quero entender direitinho pra te ajudar!"
    Incrementar contador de falhas em framework_data
  Se for a 3a falha consecutiva:
    action = ESCALATE (comportamento atual)
    Resetar contador
```

#### 2. IA respondeu mas sem texto -- linhas 1072-1078
**Antes:** Se tem mais de 2 mensagens e sem texto, escala para humano.
**Depois:** Envia pergunta contextual pedindo mais informacoes.

```
Se iaResult existe mas sem responseText e msgCount > 2:
  action = RESPOND
  responseText = "Me conta mais sobre o que voce precisa? Quero entender melhor pra te direcionar certo!"
  (So escalar se msgCount > 15 sem resposta, indicando loop real)
```

### Detalhes tecnicos

**Arquivo modificado:**
- `supabase/functions/bluechat-inbound/index.ts` (linhas 1041-1078)

**Logica do contador de falhas:**
- Armazenar `ia_null_count` dentro de `framework_data` do `lead_conversation_state`
- Incrementar a cada falha null da IA
- Resetar quando a IA responder com sucesso
- Escalar somente apos 3 falhas consecutivas

**Limiar de escalacao por volume:**
- Leads com mais de 15 mensagens e IA sem resposta: escalar (indica problema persistente)
- Leads com 2-15 mensagens: perguntar mais detalhes

**Teste apos implementacao:**
- Enviar mensagem para o lead Arthur Coelho para validar que a Amelia responde com pergunta de continuidade em vez de escalar

