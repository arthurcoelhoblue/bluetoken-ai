

# Diagnóstico: Lead `test@leofelipe.com.br` não criou deal + canal_origem ainda é LP_COM_IA

## Investigação realizada

1. **Testei o webhook `elementor-webhook` + `lp-lead-ingest` diretamente** — ambos estão funcionando. Criei um contato e deal de teste com sucesso via `criptomoedas_tokens`.

2. **O deal "leonardo" das 13:00 FOI criado** com sucesso pelo formulário `criptomoedas_tokens`. O título está correto (sem `[LP com IA]`). Porém o `canal_origem` ficou `LP_COM_IA` porque o Elementor não enviou `page_url` no body.

3. **O email `test@leofelipe.com.br` NUNCA chegou ao nosso webhook** — não há nenhum log, nenhum contato, nenhum registro. Isso é um problema do lado do WordPress/Elementor (o webhook não disparou ou apontou para URL errada).

## Problemas identificados

### 1. `test@leofelipe.com.br` não chegou
Isso não é um bug do nosso código. O formulário do Elementor no WordPress não disparou o webhook para essa submissão. Precisa verificar no WordPress se:
- O webhook está configurado no formulário correto
- A URL do webhook está correta: `https://xdjvlcelauvibznnbrzb.supabase.co/functions/v1/elementor-webhook?form_id=criptomoedas_tokens`

### 2. `canal_origem` vem como `LP_COM_IA` em vez do nome da página
O Elementor não está enviando o campo `page_url` no body. A solução é usar o `form_id` como fallback para `canal_origem` no `elementor-webhook`, já que o `form_id` já identifica a página (ex: `criptomoedas_tokens` → `criptomoedas-tokens`).

## Solução técnica

**Arquivo: `supabase/functions/elementor-webhook/index.ts`** — Linhas 175-183

Adicionar fallback usando `form_id` quando `page_url` não está disponível:

```typescript
let canalOrigem = "LP_COM_IA";
const pageUrl = camposExtras.page_url;
if (pageUrl) {
  try {
    const pathname = new URL(pageUrl).pathname.replace(/^\/|\/$/g, "");
    if (pathname) canalOrigem = pathname.split("/").pop() || pathname;
  } catch { /* keep default */ }
}
// Fallback: usar form_id como canal_origem se page_url não veio
if (canalOrigem === "LP_COM_IA" && formId) {
  canalOrigem = formId.replace(/_/g, "-");
}
```

Isso garante que mesmo sem `page_url`, o deal terá `canal_origem: "criptomoedas-tokens"` e o título ficará `"Nome [criptomoedas-tokens]"`.

Sobre o `test@leofelipe.com.br`: precisa verificar a configuração do webhook no WordPress/Elementor para essa página, pois a submissão nunca chegou ao nosso servidor.

