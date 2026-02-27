

## Atualizar Secret WHATSAPP_INBOUND_SECRET

O secret `WHATSAPP_INBOUND_SECRET` já existe. Preciso atualizá-lo para o valor `vaidarcertoagora` que a Mensageria está enviando no header `Authorization: Bearer`.

### Passos

1. **Atualizar o secret** `WHATSAPP_INBOUND_SECRET` com o novo valor `vaidarcertoagora`
2. **Redeployar** a edge function `whatsapp-inbound` para que pegue o novo valor
3. **Testar** enviando o payload real para confirmar que a autenticação passa

