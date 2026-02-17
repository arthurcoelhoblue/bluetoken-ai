

# Atualizar secret BLUECHAT_API_KEY_BLUE

## Problema

A chamada ao Blue Chat retornou **401 Invalid API key**, indicando que o secret `BLUECHAT_API_KEY_BLUE` esta incorreto ou expirado.

## Acao

1. Solicitar ao usuario a nova API key do Blue Chat (instancia BLUE) via ferramenta `add_secret`
2. Apos o secret ser atualizado, re-testar a edge function `sdr-proactive-outreach` com o lead Arthur

## Teste

Chamar novamente:
```json
POST /functions/v1/sdr-proactive-outreach
{
  "lead_id": "lead_arthur_blue",
  "empresa": "BLUE",
  "motivo": "MQL cadastrado - primeiro contato"
}
```

Resultado esperado: conversa aberta no Blue Chat e mensagem enviada com sucesso.

