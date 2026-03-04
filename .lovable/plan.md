

## Problema Raiz

O `CopilotPanel.tsx` (linha 156) envia o **anon key** (`VITE_SUPABASE_PUBLISHABLE_KEY`) como Bearer token na requisição ao `copilot-chat`:

```typescript
'Authorization': `Bearer ${supabaseKey}`,  // ← ANON KEY, não tem "sub" claim
```

O anon key é um JWT de serviço que **não tem `sub` claim** (não representa um usuário). Quando o edge function tenta extrair `payload.sub`, recebe `undefined`, e retorna 401 "Token inválido ou expirado".

Enquanto isso, `EmailFromDealDialog.tsx` usa `supabase.functions.invoke()` que automaticamente injeta o **token de sessão do usuário** — esse funciona corretamente.

## Correção

No `CopilotPanel.tsx`, antes do `fetch`, obter o token de sessão do usuário via `supabase.auth.getSession()` e usá-lo no header Authorization:

```typescript
const { data: { session } } = await supabase.auth.getSession();
if (!session?.access_token) {
  toast({ title: 'Sessão expirada', description: 'Faça login novamente.', variant: 'destructive' });
  return;
}

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${session.access_token}`,  // token do USUÁRIO
};
```

Remover a variável `supabaseKey` (linha 145) que não será mais necessária. Manter `supabaseUrl` para construir a URL.

Mudança em 1 arquivo: `src/components/copilot/CopilotPanel.tsx`, linhas 144-157.

