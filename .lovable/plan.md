

## Atualizar Secret BLUECHAT_API_KEY_BLUE

### Objetivo
Atualizar o valor do secret `BLUECHAT_API_KEY_BLUE` que esta retornando erro 401 (Invalid API key), impedindo a Amelia de enviar mensagens via Blue Chat para leads da empresa BLUE.

### Acao
1. Solicitar ao usuario o novo valor da API key via ferramenta de atualizacao de secrets
2. Apos atualizacao, redeployar a edge function `bluechat-inbound` para garantir que o novo valor seja utilizado
3. Testar o envio de mensagem para o lead Arthur Coelho (351910506655)

### Resultado esperado
- O erro 401 sera eliminado
- A Amelia voltara a enviar mensagens normalmente via Blue Chat

