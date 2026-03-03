

## Adicionar secrets do Google Calendar

Os dois secrets necessários para o OAuth do Google Calendar não foram encontrados na configuração. Preciso usar a ferramenta `add_secret` para solicitar os valores ao usuário:

1. `GOOGLE_CALENDAR_CLIENT_ID` — Client ID do OAuth 2.0 do Google Cloud Console
2. `GOOGLE_CALENDAR_CLIENT_SECRET` — Client Secret do OAuth 2.0

Após adicionados, a edge function `google-calendar-auth` parará de retornar erro 500.

