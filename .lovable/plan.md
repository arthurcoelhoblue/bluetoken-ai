

# Diagnóstico: Mensagem inbound WhatsApp não chegou

## O que investiguei

1. **Edge function `meta-webhook`**: código OK, configurada com `verify_jwt = false`
2. **Conexão WhatsApp**: ativa para TOKENIZA, `phone_number_id: 1009376255595711`
3. **Secrets**: `META_WEBHOOK_VERIFY_TOKEN`, `META_APP_SECRET`, `META_ACCESS_TOKEN_TOKENIZA` — todos configurados
4. **Logs**: **zero requisições** recebidas pelo `meta-webhook` — nem boot, nem requests

## Causa raiz

A Meta não está enviando eventos para a URL do webhook. Possíveis razões:

1. **Webhook não configurado no Facebook Developer Console** — a URL de callback precisa ser `https://xdjvlcelauvibznnbrzb.supabase.co/functions/v1/meta-webhook` com o verify token correspondente ao secret `META_WEBHOOK_VERIFY_TOKEN`
2. **Webhook não verificado** — a Meta faz um GET de verificação antes de começar a enviar POSTs. Se o verify token não bater, a verificação falha
3. **Assinatura do campo `messages` não subscrita** — no console da Meta, além de configurar a URL, é preciso assinar o campo "messages" do WhatsApp Business Account

## Ações necessárias (manual, no Facebook Developer Console)

1. Acessar **Meta for Developers → App → WhatsApp → Configuração**
2. Em **Webhook**, configurar:
   - **Callback URL**: `https://xdjvlcelauvibznnbrzb.supabase.co/functions/v1/meta-webhook`
   - **Verify token**: o valor do secret `META_WEBHOOK_VERIFY_TOKEN`
3. Clicar **Verificar e salvar**
4. Assinar o campo **`messages`** (checkbox)
5. Enviar nova mensagem de teste

## Nenhuma alteração de código necessária

O `meta-webhook` está completo e funcional. O problema é exclusivamente de configuração na plataforma Meta.

