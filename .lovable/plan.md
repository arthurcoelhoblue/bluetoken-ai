

# Acao RESOLVE para Encerramento de Conversa no Blue Chat

## Resumo

Quando a Amelia detectar que a conversa esta sendo encerrada (despedida, agradecimento final, confirmacao de conclusao), o sistema enviara a acao `RESOLVE` ao Blue Chat com um resumo automatico do atendimento, em vez da acao `RESPOND` padrao.

## O que muda para o usuario

- Quando um lead se despede ou confirma que foi atendido, o Blue Chat recebera a acao `RESOLVE` automaticamente
- O ticket no Blue Chat sera resolvido sem intervencao manual
- Um resumo do atendimento sera incluido na resposta

## Secao Tecnica

### 1. Atualizar tipo `BlueChatResponse` (bluechat-inbound)

Adicionar `RESOLVE` como acao valida e incluir campo `resolution`:

```text
action: 'RESPOND' | 'ESCALATE' | 'QUALIFY_ONLY' | 'RESOLVE'

resolution?: {
  summary: string;   // Resumo do atendimento
  reason: string;    // Motivo do encerramento
}
```

### 2. Detectar intencao de encerramento (bluechat-inbound)

Na logica de montagem da resposta (linha ~831), apos receber o resultado da IA, verificar se o intent indica encerramento:

- Intents de encerramento: `AGRADECIMENTO`, `CUMPRIMENTO` (quando no contexto de despedida)
- Estado do funil: `POS_VENDA` ou `FECHAMENTO`
- Heuristica adicional: palavras-chave na mensagem do lead como "obrigado", "ate mais", "tchau", "era isso", "resolvido"

Quando detectar encerramento:
- Definir `action = 'RESOLVE'`
- Gerar `resolution.summary` a partir do historico (intent detectado + empresa + nome do lead)
- Gerar `resolution.reason` a partir do contexto

### 3. Chamar endpoint de resolucao no Blue Chat (sendResponseToBluechat)

Adicionar logica na funcao `sendResponseToBluechat` para quando `action === 'RESOLVE'`:

- Enviar a mensagem de despedida via `POST /messages` (como ja faz)
- Chamar `POST /tickets/{ticket_id}/resolve` com o resumo e motivo

### 4. Arquivos modificados

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/bluechat-inbound/index.ts` | Adicionar tipo RESOLVE, deteccao de encerramento, chamada ao endpoint /resolve |

### 5. Sem alteracao de schema

Nenhuma tabela ou coluna nova necessaria.

