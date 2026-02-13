

## Corrigir Amelia "muda" - 2 bugs identificados

### Problema 1 (CRITICO): Argumentos trocados no modo MANUAL

Na funcao `sdr-ia-interpret`, quando o lead esta em modo MANUAL (linha 4286), os argumentos `pessoaContext` e `conversationState` estao **invertidos** na chamada a `interpretWithAI`.

**Assinatura da funcao:**
```text
interpretWithAI(mensagem, empresa, historico, leadNome, cadenciaNome, classificacao, pessoaContext, conversationState, mode, triageSummary)
```

**Chamada no modo MANUAL (errada - linha 4286):**
```text
interpretWithAI(..., classificacao, conversationState, pessoaContext, source)
                                    ^^^^^^^^^^^^^^^^^^  ^^^^^^^^^^^^^
                                    deveria ser pessoaContext  deveria ser conversationState
```

**Chamada normal (correta - linha 4332):**
```text
interpretWithAI(..., classificacao, pessoaContext, conversationState, mode, triageSummary)
```

Resultado: a funcao tenta acessar `pessoaContext.pessoa.nome` mas recebe o `conversationState` (que nao tem `.pessoa`), causando o crash `TypeError: Cannot read properties of undefined (reading 'nome')`. Isso faz todas as 3 tentativas falharem com 500, e o `bluechat-inbound` entra no fallback "IA retornou null -> ESCALATE automatico" sem enviar resposta da Amelia.

### Problema 2: API key 401 no callback Blue Chat

Apos o fallback de escalacao, o `bluechat-inbound` tenta enviar a mensagem de volta ao Blue Chat mas recebe `401 Invalid API key`. O log mostra:

```text
[Callback] Erro ao enviar mensagem: 401 {"message":"Invalid API key","error":"Invalid API key","statusCode":401}
```

Isso significa que o secret `BLUECHAT_API_KEY_BLUE` pode estar incorreto ou expirado. Sera necessario verificar/atualizar o valor do secret.

### Correcoes

**Arquivo: `supabase/functions/sdr-ia-interpret/index.ts`**

Corrigir a ordem dos argumentos na chamada do modo MANUAL (linha 4286-4296), trocando `conversationState` e `pessoaContext` para a ordem correta e adicionando `mode` e `triageSummary`:

```text
// DE (errado):
interpretWithAI(message.conteudo, message.empresa, historico, leadNome, cadenciaNome, classificacao, conversationState, pessoaContext, source)

// PARA (correto):
interpretWithAI(message.conteudo, message.empresa, historico, leadNome, cadenciaNome, classificacao, pessoaContext, conversationState, mode, triageSummary)
```

**Secret: `BLUECHAT_API_KEY_BLUE`**

Solicitar ao usuario que verifique/atualize a API key da integracao Blue Chat para a empresa BLUE, pois esta retornando 401.

### Resultado esperado

- A Amelia voltara a interpretar mensagens corretamente (sem crash no `.nome`)
- Em modo SDR_IA, gerara e enviara respostas automaticas
- Em modo MANUAL, registrara intents sem responder (comportamento correto)
- Com a API key corrigida, as mensagens de callback serao entregues ao Blue Chat

