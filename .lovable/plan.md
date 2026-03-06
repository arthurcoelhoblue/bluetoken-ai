

# Plano: Push Nativo — Tabela, Trigger e Edge Function

## Visão Geral

Três entregas:
1. **Migration**: criar tabela `push_tokens` + trigger `pg_net` na `notifications`
2. **Edge Function `push-send`**: recebe payload da notification, busca tokens do usuário, envia via Firebase Cloud Messaging (FCM HTTP v1)
3. **Secrets**: adicionar credenciais Firebase

---

## 1. Migration SQL (uma única migration)

Usar o SQL que você forneceu para `push_tokens` (tabela, índices, RLS, trigger de `updated_at`), **com um ajuste**: a referência `profiles(id)` está correta pois já existe no projeto.

Adicionar na mesma migration o **trigger com `pg_net`** na tabela `notifications`:

```sql
-- Após criar push_tokens...

-- Trigger: disparar push-send via pg_net em cada INSERT na notifications
CREATE OR REPLACE FUNCTION public.fn_notify_push_send()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM extensions.http_post(
    url := current_setting('app.settings.supabase_url', true)
           || '/functions/v1/push-send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer '
        || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'notification_id', NEW.id,
      'user_id', NEW.user_id,
      'titulo', NEW.titulo,
      'mensagem', NEW.mensagem,
      'tipo', NEW.tipo,
      'link', NEW.link
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'push-send trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notifications_push_send
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_push_send();
```

Este padrão já é usado no projeto (veja `fn_cs_survey_recalc_health`, `fn_cs_incident_recalc_health`, `fn_cs_auto_csat_on_resolve` — todos usam `extensions.http_post` com `app.settings`).

---

## 2. Edge Function `push-send`

Criar `supabase/functions/push-send/index.ts`:

- Recebe o payload do trigger (user_id, titulo, mensagem, link)
- Busca todos os `push_tokens` do `user_id` via service client
- Gera um **Google OAuth2 access token** a partir do service account JSON (JWT → token endpoint)
- Envia para cada token via **FCM HTTP v1 API** (`https://fcm.googleapis.com/v1/projects/{project_id}/messages:send`)
- Remove tokens inválidos (erro `UNREGISTERED`) automaticamente
- Registrar em `supabase/config.toml` com `verify_jwt = false`

Estrutura do código:

```text
supabase/functions/push-send/index.ts
├── CORS handling (getCorsHeaders)
├── Auth: validação via service_role (trigger já envia o Bearer)
├── Query push_tokens WHERE user_id = payload.user_id
├── Para cada token:
│   ├── POST FCM v1 com access_token
│   ├── Se UNREGISTERED → DELETE token
│   └── Log resultado
└── Response 200 com resumo
```

---

## 3. Secrets Firebase

O projeto **não tem** nenhum secret Firebase configurado. Precisaremos adicionar:

| Secret | Descrição |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | JSON completo da service account do Firebase (contém project_id, client_email, private_key) |

Uma única secret com o JSON completo é mais simples que 3 separadas, e permite extrair `project_id` e `client_email` programaticamente.

**Fluxo**: Vou solicitar o secret via ferramenta `add_secret` — você cola o JSON da service account do Firebase Console (Project Settings → Service accounts → Generate new private key).

---

## Sequência de Implementação

1. Solicitar o secret `FIREBASE_SERVICE_ACCOUNT_JSON` (preciso que você adicione antes de prosseguir)
2. Executar a migration (push_tokens + trigger pg_net)
3. Criar a edge function `push-send` + registrar no `config.toml`

