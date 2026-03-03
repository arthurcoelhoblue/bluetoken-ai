

## Adicionar os secrets do Google Calendar

O usuário confirmou que tem as credenciais OAuth prontas. Preciso usar a ferramenta `add_secret` para solicitar os dois valores:

1. **`GOOGLE_CALENDAR_CLIENT_ID`** — Client ID do OAuth 2.0
2. **`GOOGLE_CALENDAR_CLIENT_SECRET`** — Client Secret do OAuth 2.0

Após adicionados, a edge function `google-calendar-auth` funcionará e os vendedores poderão conectar seus calendários individuais.

Alteração: **0 arquivos** — apenas configuração de secrets.

