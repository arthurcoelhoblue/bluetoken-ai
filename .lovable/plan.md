
# Plano: Adaptar whatsapp-inbound ao formato real da Mensageria

## Contexto

A equipe da Mensageria confirmou exatamente o que enviam no webhook. Nosso codigo ja suporta a maioria, mas precisa de ajustes para usar `connection_name` como chave de resolucao de empresa e validar opcionalmente a assinatura HMAC.

## Mudancas Necessarias

### 1. Resolver empresa via `connection_name` (prioridade alta)

Atualmente, `resolveEmpresaFromWebhook()` busca TODAS as empresas com mensageria habilitada. Isso e impreciso quando ha multiplas empresas.

**Novo fluxo:**
- Extrair `connection_name` do payload OU do header `X-Connection-Name`
- Buscar na tabela `integration_company_config` onde `connection_name = <valor>` e `channel = 'mensageria'`
- Se encontrado, usar essa empresa como `targetEmpresa` (filtro unico e preciso)
- Se nao encontrado, fallback para o comportamento atual (todas as empresas habilitadas)

### 2. Validacao opcional de `X-Webhook-Signature` (HMAC-SHA256)

Adicionar validacao de integridade do body quando o header `X-Webhook-Signature` estiver presente:
- Calcular HMAC-SHA256 do body bruto usando `WHATSAPP_INBOUND_SECRET` como chave
- Comparar com o valor do header
- Se diferente, retornar 401 (assinatura invalida)
- Se header ausente, continuar normalmente (backward-compatible)

### 3. Garantir que `Authorization: Bearer` funciona com `verify_jwt = false`

O `config.toml` ja tem `verify_jwt = false` para `whatsapp-inbound`, o que significa que o gateway do Supabase NAO intercepta o Bearer token. Nosso codigo ja trata Bearer na linha 93-101. Nenhuma mudanca necessaria aqui.

### 4. Logging melhorado

Adicionar log do `connection_name` recebido para facilitar debug futuro.

---

## Detalhes Tecnicos

### Arquivo: `supabase/functions/whatsapp-inbound/index.ts`

**A. Nova funcao `resolveEmpresaByConnectionName()`**

```text
async function resolveEmpresaByConnectionName(
  supabase, connectionName: string
): Promise<string | null>
  -> SELECT empresa FROM integration_company_config
     WHERE connection_name = connectionName
     AND channel = 'mensageria'
  -> Retorna empresa ou null
```

**B. Extracao de `connection_name` no handler principal (apos parse do payload)**

```text
const connectionName = rawPayload.connection_name 
  || req.headers.get('X-Connection-Name') 
  || null;
```

**C. Substituir resolucao de empresa**

```text
// ANTES:
const targetEmpresas = await resolveEmpresaFromWebhook(supabase);

// DEPOIS:
let targetEmpresas: string[] = [];
let targetEmpresa: string | null = null;

if (connectionName) {
  const empresa = await resolveEmpresaByConnectionName(supabase, connectionName);
  if (empresa) {
    targetEmpresas = [empresa];
    targetEmpresa = empresa;
  }
}

// Fallback: comportamento antigo
if (targetEmpresas.length === 0) {
  targetEmpresas = await resolveEmpresaFromWebhook(supabase);
  targetEmpresa = targetEmpresas.length === 1 ? targetEmpresas[0] : null;
}
```

**D. Validacao HMAC-SHA256 (opcional)**

Usar `crypto.subtle.importKey` + `crypto.subtle.sign` do Deno para calcular HMAC e comparar com `X-Webhook-Signature`. Requer guardar o body bruto como string antes do `JSON.parse`.

```text
// Antes do req.json():
const rawBody = await req.text();
const rawPayload = JSON.parse(rawBody);

// Apos auth basica:
const signature = req.headers.get('X-Webhook-Signature');
if (signature) {
  const isValid = await verifyHmacSignature(rawBody, signature, secret);
  if (!isValid) return 401;
}
```

### Dados: `integration_company_config`

Estado atual: apenas BLUE_LABS tem `connection_name = 'arthur'`. As demais empresas precisarao ter seus `connection_name` preenchidos quando forem configuradas na Mensageria.

---

## Resumo de impacto

| Item | Mudanca | Risco |
|------|---------|-------|
| Resolucao de empresa | Precisa via connection_name | Baixo (fallback mantido) |
| HMAC validation | Novo, opcional | Nenhum (so valida se header presente) |
| Bearer auth | Ja funciona | Nenhum |
| Payload fields | Ja suportados | Nenhum |
| Backward compatibility | Mantida | Nenhum |
