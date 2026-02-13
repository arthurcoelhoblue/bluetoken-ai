

## Plano: Rotear mensagens manuais pelo canal correto (Blue Chat ou Mensageria)

### Problema
A funcao `whatsapp-send` sempre envia mensagens pela API Mensageria (`dev-mensageria.grupoblue.com.br`), mas ambas as empresas (TOKENIZA e BLUE) estao com o canal `bluechat` ativo e `mensageria` desativado. Resultado: a API externa retorna erro 400 e o vendedor recebe 502.

### Causa raiz
Nao existe roteamento por canal. A funcao ignora qual canal esta ativo em `integration_company_config` e sempre chama a API Mensageria.

### Solucao
Atualizar a edge function `whatsapp-send` para verificar o canal ativo e rotear a mensagem:

- **Se canal ativo = `bluechat`**: enviar via API Blue Chat (mesmo mecanismo que `bluechat-inbound` usa no `sendResponseToBluechat`)
- **Se canal ativo = `mensageria`**: manter envio atual pela API Mensageria

### Mudancas tecnicas

**Arquivo: `supabase/functions/whatsapp-send/index.ts`**

1. Apos identificar o canal ativo (ja existente), adicionar logica de roteamento:

```text
if (activeChannel === 'bluechat') {
  -> Buscar URL da API Blue Chat em system_settings (bluechat_tokeniza ou bluechat_blue)
  -> Buscar API key correta (BLUECHAT_API_KEY ou BLUECHAT_API_KEY_BLUE)
  -> Enviar POST para {api_url}/messages com:
     - conversation_id (buscar a ultima conversa ativa do lead)
     - content: mensagem
     - source: 'MANUAL_SELLER'
} else {
  -> Manter fluxo atual pela API Mensageria
}
```

2. Para encontrar o `conversation_id` do Blue Chat, buscar na tabela `lead_messages` a ultima mensagem INBOUND do lead que tenha `whatsapp_message_id` (que contem o ID da conversa Blue Chat). Alternativa: enviar a mensagem diretamente pelo telefone usando a mesma API Mensageria (se o Blue Chat aceitar).

3. Atualizar o estado da mensagem em `lead_messages` da mesma forma para ambos os canais (PENDENTE -> ENVIADO ou ERRO).

### Alternativa mais simples (recomendada)
Como o Blue Chat provavelmente envia WhatsApp por baixo, a API Mensageria pode ser o caminho correto para **ambos** os canais quando se trata de envio direto por telefone. O problema pode ser simplesmente que a `connectionName: "Arthur"` nao suporta o numero internacional `+351...`.

Nesse caso, a correcao seria:
- Buscar a `connectionName` correta por empresa em `system_settings` em vez de usar "Arthur" fixo
- Ou adicionar uma config de `connectionName` por empresa em `system_settings`

### Proposta final: implementar roteamento completo

1. Se `activeChannel === 'bluechat'`:
   - Buscar config Blue Chat em `system_settings` (key: `bluechat_blue` ou `bluechat_tokeniza`)
   - Buscar API key correta por empresa
   - Enviar via endpoint `/messages` do Blue Chat
   - Se falhar, logar erro detalhado

2. Se `activeChannel === 'mensageria'`:
   - Manter fluxo atual (API Mensageria com connectionName)

3. Manter todo o restante (opt-out check, registro em lead_messages, typing delay, etc.)

### Risco
- Precisamos confirmar que a API Blue Chat aceita envio de mensagem via `/messages` sem um `conversation_id` ativo (cenario de primeira mensagem manual)
- Se nao aceitar, pode ser necessario criar uma conversa primeiro

