

## Diagnóstico

O erro `401: Token inválido ou expirado` com `AuthApiError: invalid claim: missing sub claim` ocorre porque a correção anterior introduziu `getClaims(token)` — um método que não funciona corretamente com supabase-js@2.

Outras edge functions do projeto (como `sgt-buscar-lead`, `api-keys-manage`, `admin-create-user`) usam o padrão correto e funcionam sem problemas.

## Correção

Alterar `supabase/functions/copilot-chat/index.ts` (linhas 149-156) para usar o mesmo padrão que funciona nas demais funções:

**De (quebrado):**
```typescript
const token = authHeader.replace('Bearer ', '');
const userSupabase = createClient(envConfig.SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') || envConfig.SUPABASE_SERVICE_ROLE_KEY, {
  global: { headers: { Authorization: authHeader } },
});
const { data: claimsData, error: claimsError } = await userSupabase.auth.getClaims(token);
userId = claimsData?.claims?.sub as string | undefined;
```

**Para (padrão funcional):**
```typescript
const userSupabase = createClient(envConfig.SUPABASE_URL, envConfig.SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: authHeader } },
});
const { data: { user }, error: claimsError } = await userSupabase.auth.getUser();
userId = user?.id;
```

Mudanças:
1. Remover `const token = ...` (não é mais necessário)
2. Usar `envConfig.SUPABASE_ANON_KEY` diretamente (já validado no config.ts)
3. Trocar `getClaims(token)` por `getUser()` (sem parâmetro — o header Authorization já carrega o token)
4. Extrair `userId` de `user?.id` em vez de `claims?.sub`

