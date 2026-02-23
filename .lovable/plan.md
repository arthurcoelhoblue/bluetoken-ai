
# Conectar configuracoes SMTP do frontend ao backend

## Problema

A edge function `email-send` le as configuracoes SMTP de variaveis de ambiente (secrets): `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`. Ela **ignora completamente** a tabela `system_settings` onde o frontend salva `smtp_config`.

Resultado: o usuario altera host, porta, remetente, limites na tela, os valores sao salvos no banco, mas o envio de e-mail continua usando os valores fixos dos secrets.

A unica configuracao que funciona corretamente e o `modo_teste`, que ja e lido do banco pela edge function.

## Diagnostico detalhado

| Campo frontend | Salva em `system_settings`? | Lido pela edge function? |
|---|---|---|
| host | Sim | Nao (usa secret SMTP_HOST) |
| port | Sim | Nao (usa secret SMTP_PORT) |
| encryption | Sim | Nao |
| from_name | Sim | Nao |
| from_email | Sim | Nao (usa secret SMTP_FROM) |
| reply_to | Sim | Nao |
| max_per_day | Sim | Nao |
| interval_seconds | Sim | Nao |
| modo_teste.ativo | Sim | **Sim** |
| modo_teste.email_teste | Sim | **Sim** |

## Solucao

Alterar a edge function `email-send` para ler `smtp_config` do banco de dados, usando os secrets apenas como **fallback** para credenciais (usuario e senha, que nao devem ficar no banco).

### 1. Edge function: ler smtp_config do banco

Apos o trecho que ja busca `modo_teste`, adicionar uma query para buscar `smtp_config`:

```typescript
const { data: smtpDbConfig } = await supabase
  .from('system_settings')
  .select('value')
  .eq('category', 'email')
  .eq('key', 'smtp_config')
  .single();

const dbSmtp = smtpDbConfig?.value as {
  host?: string;
  port?: number;
  encryption?: string;
  from_name?: string;
  from_email?: string;
  reply_to?: string;
  max_per_day?: number;
  interval_seconds?: number;
} | null;
```

### 2. Prioridade de configuracao

Usar valores do banco com fallback para secrets:

```
host       -> dbSmtp.host       || SMTP_HOST (secret)
port       -> dbSmtp.port       || SMTP_PORT (secret)
from_email -> dbSmtp.from_email || SMTP_FROM (secret)
from_name  -> dbSmtp.from_name  || "Blue CRM"
reply_to   -> dbSmtp.reply_to   || (vazio)
user       -> SMTP_USER (sempre secret)
pass       -> SMTP_PASS (sempre secret)
```

Credenciais (user/pass) continuam exclusivamente nos secrets por seguranca.

### 3. Aplicar from_name e reply_to no envio

Atualmente a edge function monta o header `From:` usando apenas `SMTP_FROM`. Alterar para incluir `from_name`:

```
From: "Blue CRM" <noreply@empresa.com>
```

E adicionar header `Reply-To` quando configurado.

### 4. Validacao de limite diario (max_per_day)

Antes de enviar, contar quantos e-mails OUTBOUND foram enviados hoje na tabela `lead_messages` e comparar com `max_per_day`. Se excedido, retornar erro.

### 5. Validacao de intervalo (interval_seconds)

Verificar o timestamp do ultimo envio e comparar com `interval_seconds`. Se muito recente, retornar erro ou aguardar.

## Arquivos alterados

- `supabase/functions/email-send/index.ts` -- ler smtp_config do banco, aplicar from_name/reply_to, validar limites

## O que NAO muda

- `src/pages/EmailSmtpConfigPage.tsx` -- frontend ja salva corretamente no banco
- `src/hooks/useSystemSettings.ts` -- hook ja funciona com upsert
- Secrets SMTP_USER e SMTP_PASS -- continuam sendo a unica fonte de credenciais
- `modo_teste` -- ja funciona corretamente

## Resultado esperado

- Alterar host/porta na tela reflete imediatamente no proximo envio
- Alterar remetente (nome e email) aparece no header do e-mail
- Reply-To e configurado quando preenchido
- Limite diario bloqueia envios excessivos
- Intervalo minimo e respeitado entre envios consecutivos
