
# Eliminar Atendimentos no Limbo: Escalacao e Devolucao Inteligente

## Status: ✅ Implementado

## Mudanças Realizadas

### sdr-ia-interpret/index.ts
1. **ESCALAR_HUMANO sem runId**: Agora retorna `true` mesmo sem cadência (modo passivo)
2. **NAO_ENTENDI + BLUECHAT**: Força resposta contextual (sem contexto → pergunta; com contexto → escalação)
3. **ESCALAR_HUMANO sem resposta**: Força mensagem de transição padrão
4. **InterpretResult expandido**: Inclui `escalation` e `leadReady` no retorno

### bluechat-inbound/index.ts
1. **Nunca QUALIFY_ONLY**: Todo atendimento recebe ação (RESPOND ou ESCALATE)
2. **Falha total IA**: Tratada como ESCALATE automático com mensagem padrão
3. **Escalação sem texto**: Gera mensagem padrão de transição
4. **Sem resposta IA**: Decide por contexto (pouco → pergunta, muito → escalação)
5. **Callback sempre executa**: Se há texto de resposta, sempre envia ao Blue Chat
6. **OUTBOUND sempre persistido**: Mensagens de transição/escalação salvas no banco
