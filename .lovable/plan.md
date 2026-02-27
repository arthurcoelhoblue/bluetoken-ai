

## Diagnóstico

### Problema 1: Resposta do lead não chega
TOKENIZA usa canal `meta_cloud` (API Oficial da Meta). O webhook que recebe mensagens inbound da Meta é a edge function `meta-webhook`. Ela tem **zero logs**, o que significa que **Meta não está enviando webhooks** para essa URL.

Isso é uma configuração no **Meta Business Manager**: você precisa registrar a URL do webhook lá:
```
https://xdjvlcelauvibznnbrzb.supabase.co/functions/v1/meta-webhook
```

Com o **Verify Token** que já está configurado no secret `META_WEBHOOK_VERIFY_TOKEN`.

**Ação necessária (manual, fora do código):** No Meta Business Manager → WhatsApp → Configuration → Webhook URL, colocar a URL acima e o verify token. Assinar o campo "messages".

### Problema 2: Conversa não aparece na aba /conversas
O lead `aaaaaaaa-bbbb-cccc-dddd-000000000004` tem um deal ABERTO com `owner_id = 3eb15a6a-9856-4e21-a856-b87eeff933b1` (Arthur Coelho). O hook `useAtendimentos` filtra por ownership: para não-admins, só mostra se `userId` é o `owner_id` do deal ou `assumido_por` na conversation state. Se o usuário logado não é o Arthur ou admin, a conversa é filtrada.

Além disso, o `meta-webhook` **não auto-cria lead_contacts** para números desconhecidos (diferente do `whatsapp-inbound` que já tem essa lógica). Precisa alinhar.

### Plano de Implementação

**1. Atualizar `meta-webhook` para auto-criar leads para números desconhecidos**
- Adicionar lógica de auto-criação de `lead_contact` (igual ao `whatsapp-inbound`) quando `findLeadByPhone` retorna null
- Garantir que o trigger `fn_sync_lead_to_contact` crie o contato CRM

**2. Atualizar `meta-webhook` para resolver empresa via `whatsapp_connections`**
- Usar o `phone_number_id` do payload Meta para resolver qual empresa é dona do número
- Atualmente faz fallback hardcoded para "TOKENIZA"

**3. Garantir que conversa apareça na aba /conversas**
- O hook já funciona corretamente — a conversa aparecerá automaticamente assim que existirem mensagens com `run_id IS NULL` para leads com contatos válidos
- Se o usuário logado é admin ou dono do deal, a conversa será visível

**4. Instrução para configurar webhook no Meta**
- Será preciso configurar manualmente no Meta Business Manager a URL do webhook

### Arquivos afetados
- `supabase/functions/meta-webhook/index.ts` — adicionar auto-criação de lead + resolução de empresa via `whatsapp_connections`

