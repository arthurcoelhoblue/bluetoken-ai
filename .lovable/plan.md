
# Diagnóstico: Conversas da Amélia não aparecem no Blue Chat após transferência

## Causa raiz identificada

O fluxo de mensagens está correto e NÃO passa pela mensageria interna. A Amélia:
1. Recebe a mensagem via `bluechat-inbound` (webhook do Blue Chat)
2. Processa via `sdr-ia-interpret` (classificação + resposta)
3. Persiste a resposta OUTBOUND no banco (funciona)
4. Tenta enviar a resposta de volta ao Blue Chat via `sendResponseToBluechat` (callback)
5. **O callback FALHA com HTTP 401** -- a API key está sendo rejeitada

Os logs confirmam isso:
```
INFO  "Enviando mensagem para Blue Chat" url: ".../api/external-ai/messages"
ERROR "Erro ao enviar mensagem" status: 401
```

Ou seja: a Amélia processa e gera a resposta, persiste no banco local (por isso aparece no CRM), mas a mensagem nunca chega ao Blue Chat porque a API key usada no callback é rejeitada pelo servidor do Blue Chat.

## O que NÃO é o problema

- A mensageria interna (`whatsapp-send`) NÃO é acionada para source BLUECHAT -- o código em `action-executor.ts` explicitamente pula esse envio (linha 264-265)
- O processamento da IA está funcionando normalmente
- A persistência local das mensagens está ok

## Solução

O problema é de configuração, não de código. O secret `BLUECHAT_API_KEY` (para Tokeniza) ou `BLUECHAT_API_KEY_BLUE` (para Blue) usado no callback está inválido ou expirado no lado do servidor Blue Chat.

### Ação 1 -- Atualizar as API keys (ação do usuário)

Você precisa verificar com a equipe do Blue Chat se as API keys configuradas ainda são válidas. Se foram rotacionadas, será necessário atualizar os secrets:
- `BLUECHAT_API_KEY` -- usado para empresa Tokeniza
- `BLUECHAT_API_KEY_BLUE` -- usado para empresa Blue

### Ação 2 -- Adicionar log mais detalhado no callback (melhoria de código)

Para facilitar o diagnóstico futuro, vou adicionar no `callback.ts`:
- Log do body da resposta de erro (não apenas o status code)
- Log de qual empresa/key está sendo usada (sem expor a key completa)

### Ação 3 -- Retry automático (melhoria opcional)

Adicionar uma tentativa de retry com backoff no `sendResponseToBluechat` caso o primeiro envio falhe com erro transiente (5xx), para aumentar a resiliência.

## Arquivos a modificar

| Arquivo | Ação |
|---|---|
| `supabase/functions/bluechat-inbound/callback.ts` | Melhorar logs de erro e adicionar retry |

## Resumo

A causa é uma **API key inválida/expirada** no callback para o Blue Chat. O código está correto em não usar a mensageria interna. A correção principal é atualizar os secrets das API keys, e complementar com logs melhores para diagnóstico futuro.
