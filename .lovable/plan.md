

## Corrigir bug do redirect_uri na edge function google-calendar-auth

### Problema
O cliente envia `redirect_uri` no body do POST:
```json
{"action":"get_auth_url","redirect_uri":"https://...lovableproject.com/settings"}
```

Mas o código consome o body uma vez para extrair `action`, e depois tenta ler `redirect_uri` de `url.searchParams` (query string), onde ele não existe. Resultado: o Google OAuth recebe um redirect_uri errado e rejeita a requisição.

### Solução
Refatorar o início da edge function para parsear o body **uma única vez** e reutilizar o objeto em todas as ações:

1. **`supabase/functions/google-calendar-auth/index.ts`** — Parsear body uma vez no início, usar esse objeto para `action`, `redirect_uri`, `code`, etc. em todas as branches.

Mudança principal (linhas ~22-30):
```typescript
// Parse body once
let body: Record<string, unknown> = {};
if (req.method === "POST") {
  body = await req.json();
}
const action = url.searchParams.get("action") || (body.action as string);
```

E na branch `get_auth_url`:
```typescript
const redirectUri = url.searchParams.get("redirect_uri") 
  || (body.redirect_uri as string) 
  || `${url.origin}/google-calendar-auth?action=callback`;
```

Mesma correção na branch `callback` para `code` e `redirect_uri`.

### Nota importante
O `redirect_uri` usado no callback do Google precisa estar cadastrado nas **Authorized redirect URIs** do Google Cloud Console. O usuário precisará adicionar a URL do app publicado (ex: `https://sdrgrupobue.lovable.app/settings`) lá.

### Arquivos alterados
- `supabase/functions/google-calendar-auth/index.ts` (1 arquivo)

