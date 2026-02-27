

# Plano: Desabilitar auth temporariamente no whatsapp-inbound para teste

## Objetivo

Remover temporariamente a exigencia de autenticacao no endpoint `whatsapp-inbound` para confirmar se as requisicoes da Mensageria estao chegando ao sistema.

## Mudanca

**Arquivo**: `supabase/functions/whatsapp-inbound/index.ts` (linhas 747-754)

Substituir o bloco de rejeicao por um log de aviso que permite a requisicao continuar:

```text
// ANTES:
if (!authOk && !hmacValidated) {
  log.error('Acesso não autorizado', ...);
  return new Response(...401...);
}

// DEPOIS:
if (!authOk && !hmacValidated) {
  log.warn('AUTH DESABILITADA TEMPORARIAMENTE - requisição aceita sem auth', {
    hasAuth: !!req.headers.get('Authorization'),
    hasHmac: !!webhookSignature
  });
}
```

## Impacto

- O endpoint aceita qualquer requisicao POST sem validar secret
- Apenas para teste -- deve ser revertido apos confirmar que a Mensageria consegue enviar
- Nenhum outro arquivo precisa ser alterado

