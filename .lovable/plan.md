

# Fix: Zadarma webhook não responde ao echo de verificação

## Problema
O Zadarma envia `GET /?zd_echo=XXXX` para verificar o servidor. O código atual só lê parâmetros do body (`req.text()` → `URLSearchParams`), ignorando query params de requisições GET.

## Correção em `supabase/functions/zadarma-webhook/index.ts`

Adicionar tratamento de GET com query params **antes** de ler o body:

```typescript
// Linha ~28, logo após OPTIONS check:

// Handle GET verification (Zadarma sends zd_echo as GET query param)
const url = new URL(req.url);
if (url.searchParams.has('zd_echo')) {
  return new Response(url.searchParams.get('zd_echo')!, { 
    headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
  });
}

// Then continue with existing POST body parsing...
```

Isso responde ao echo antes de tentar ler o body, resolvendo a verificação.

Depois: redeploy da edge function.

