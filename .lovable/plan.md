

## Problema identificado

O Blue Chat está enviando o **mesmo token** (X-API-Key) para atendimentos de BLUE e TOKENIZA. Nos logs:

```
Token inválido para Blue Chat: empresa=TOKENIZA, tokenPreview="JIKLSFho...4702"
```

O token que chega corresponde ao `webhook_secret` de `bluechat_blue` (`...54702a`), mas como o payload diz `empresa: "TOKENIZA"`, o sistema procura o `webhook_secret` de `bluechat_tokeniza` (`...54702abc`) -- que e diferente -- e rejeita.

Em resumo: **a autenticacao esta correta para BLUE mas falha para TOKENIZA porque os secrets sao diferentes no banco, mas o Blue Chat manda o mesmo token para ambos.**

## Solucao

Alterar a logica de autenticacao para, apos falhar com o secret da empresa especifica, tentar validar contra os secrets de **todas as empresas** cadastradas. Isso garante que, se o Blue Chat usar um token compartilhado, a mensagem nao sera rejeitada.

### Arquivo: `supabase/functions/bluechat-inbound/auth.ts`

Modificar `validateAuthAsync`:
- Apos falhar a comparacao direta com o secret da empresa do payload (`resolveBluechatWebhookSecret(supabase, empresa)`), buscar todos os registros `bluechat_*` em `system_settings` e comparar o token contra cada `webhook_secret`.
- Se qualquer um deles bater, aceitar como valido e logar qual empresa originou o match.
- Manter o fallback `BLUECHAT_API_KEY` como ultimo recurso.

### Arquivo: `supabase/functions/_shared/channel-resolver.ts`

Adicionar funcao auxiliar `resolveAllWebhookSecrets(supabase)` que retorna todos os secrets de todas as empresas cadastradas, para uso no cross-check.

### Redeploy

Redeploy da edge function `bluechat-inbound`.

## Detalhes tecnicos

```
// Pseudocodigo do cross-check
const expectedSecret = await resolveBluechatWebhookSecret(supabase, empresa);
if (expectedSecret && token === expectedSecret) return { valid: true };

// Cross-check: tentar secrets de outras empresas
const allSecrets = await resolveAllWebhookSecrets(supabase);
for (const [emp, secret] of allSecrets) {
  if (secret && token === secret) {
    log.info('Token validado via cross-empresa', { payloadEmpresa: empresa, tokenEmpresa: emp });
    return { valid: true };
  }
}
```

A mesma logica se aplica para HMAC: se a assinatura nao bater com o secret da empresa do payload, tentar com os demais.

## Impacto

- Zero risco de regressao para BLUE (o secret proprio continua sendo checado primeiro).
- TOKENIZA passa a ser aceita imediatamente.
- Nenhuma mudanca de schema ou migracao necessaria.

