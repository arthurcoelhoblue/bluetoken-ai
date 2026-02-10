

# Atualizar Secret BLUECHAT_API_KEY_BLUE

## O que será feito

Solicitar a entrada do novo valor do secret `BLUECHAT_API_KEY_BLUE` para corrigir a autenticação da instância Blue do Blue Chat.

## Passos

1. Usar a ferramenta de cadastro de secrets para solicitar o novo valor de `BLUECHAT_API_KEY_BLUE`
2. Após o cadastro, testar o webhook `bluechat-inbound` para confirmar que a autenticação passa

## Detalhes técnicos

- O secret `BLUECHAT_API_KEY_BLUE` já existe mas o valor atual não corresponde ao que o Blue Chat está enviando no header `X-API-Key`
- Após a atualização, a edge function `bluechat-inbound` usará automaticamente o novo valor para validar as requisições da instância Blue

