
# Reativar Integração Blue Chat com Secrets Separadas por Empresa

## Diagnóstico do problema

Ao inspecionar o banco de dados, confirmei o estado atual:

```
system_settings (category = 'integrations'):
- key: bluechat_tokeniza  → { api_url: "...", enabled: true }  ← SEM api_key!
- key: bluechat_blue      → { api_url: "...", enabled: true }  ← SEM api_key!
- key: bluechat           → { api_url: "...", enabled: true }  ← legado, SEM api_key!
```

```
secrets de ambiente:
- BLUECHAT_API_KEY  → uma única chave genérica (fallback)
```

O fluxo atual quando o Blue Chat envia uma mensagem é:
1. `validateAuth` (sync): tenta validar com `BLUECHAT_API_KEY` do env. Se não bater, rejeita com 401.
2. `validateAuthAsync` (por empresa): busca `api_key` de `system_settings` → não encontra → cai novamente em `BLUECHAT_API_KEY` → mesmo problema.

**Resultado**: o webhook rejeita chamadas da Tokeniza e da Blue com 401, pois cada uma tem sua própria secret que não é a genérica do env.

## Solução — 3 partes

### Parte 1: Salvar as API Keys separadas no banco (ação do admin)

O diálogo `BlueChatConfigDialog` já está construído e funciona. Ele salva `api_key` por empresa em `system_settings`. O admin precisa:
1. Abrir Configurações → Integrações → Blue Chat → botão "Configurar"
2. Aba TOKENIZA: colar a API Key específica da Tokeniza → Salvar
3. Aba BLUE: colar a API Key específica da Blue → Salvar

Isso resolve o problema principal. Porém, há uma falha de código que ainda pode bloquear.

### Parte 2: Corrigir a validação sync do webhook (código)

O problema está em `validateAuth` (sync) em `bluechat-inbound/auth.ts`:

```typescript
// COMPORTAMENTO ATUAL (problema):
export function validateAuth(req: Request): { valid: boolean } {
  const bluechatApiKey = getOptionalEnv('BLUECHAT_API_KEY');
  if (!bluechatApiKey) {
    return { valid: true }; // passa — OK
  }
  // Se BLUECHAT_API_KEY existe no env E a request vem com
  // a key da Tokeniza (diferente), vai rejeitar aqui com 401
  // antes mesmo de chegar na validação assíncrona por empresa!
  if (token && token.trim() === bluechatApiKey.trim()) {
    return { valid: true };
  }
  return { valid: false }; // BLOQUEIO PREMATURO
}
```

A correção: quando há um `BLUECHAT_API_KEY` no env mas o token não bate, **não rejeitar imediatamente** — deixar passar para a validação assíncrona por empresa que tem as keys corretas.

**`supabase/functions/bluechat-inbound/auth.ts`** — função `validateAuth`:

```typescript
// CORREÇÃO:
export function validateAuth(req: Request): { valid: boolean } {
  const authHeader = req.headers.get('Authorization');
  const apiKeyHeader = req.headers.get('X-API-Key');
  const token = authHeader ? authHeader.replace('Bearer ', '') : apiKeyHeader;

  if (!token) {
    log.warn('Nenhum token recebido');
    return { valid: false };
  }
  
  // Sempre passa para a validação assíncrona por empresa.
  // A validação definitiva ocorre em validateAuthAsync.
  return { valid: true };
}
```

A validação real já está correta em `validateAuthAsync` — ela busca a key por empresa no banco, e se não tiver, cai no env. Uma vez que as keys sejam salvas no banco por empresa, tudo funciona.

### Parte 3: Adicionar campos de instrução no diálogo (UX)

No `BlueChatConfigDialog`, o campo de Webhook URL é o mesmo para todas as empresas, mas a autenticação é separada. Adicionar uma nota explicando que **o campo `context.empresa`** no payload do Blue Chat identifica a empresa, e que cada empresa deve configurar o webhook com sua própria API Key como secret de autenticação.

Também adicionar o campo **"Empresa para identificação"** (read-only) mostrando o valor exato que deve constar no `context.empresa` do payload (`TOKENIZA`, `BLUE`, etc.) para que o mapeamento funcione corretamente.

## Arquivos alterados

### Código
- **`supabase/functions/bluechat-inbound/auth.ts`**: simplificar `validateAuth` para sempre passar o token (a validação real é feita assincronamente por empresa em `validateAuthAsync`)

### Interface
- **`src/components/settings/BlueChatConfigDialog.tsx`**: adicionar campo read-only com o valor de `context.empresa` para cada aba, para guiar a configuração no lado do Blue Chat

## Ação necessária do admin após o deploy

Depois da correção de código, o admin deve:

1. Ir em **Configurações → Integrações → Blue Chat → Configurar**
2. Aba **TOKENIZA**: colar a API Key da Tokeniza no campo "API Key (TOKENIZA)" → **Salvar**
3. Aba **BLUE**: colar a API Key da Blue no campo "API Key (BLUE)" → **Salvar**

As keys ficam salvas no banco (criptografadas) e são usadas automaticamente para autenticar e para fazer callbacks de resposta para cada empresa.

## Por que a solução em 3 partes?

- Parte 1 (banco) resolve o problema de secrets no lado do callback (envio de respostas)
- Parte 2 (código) resolve o problema de autenticação no webhook de entrada
- Parte 3 (UX) evita que o admin configure o lado do Blue Chat com o `context.empresa` errado

Sem a Parte 2, mesmo com as keys no banco, a validação sync ainda rejetaria chamadas cujo token não bate com `BLUECHAT_API_KEY` do env.
