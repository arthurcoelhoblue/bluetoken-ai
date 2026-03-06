

# Diagnóstico: Lead `test@leofelipe.com.br` não criou deal + título com "[LP com IA]"

## Duas causas raiz

### 1. Phone dedup deployment
O log de 12:42:58 mostra que `lp-lead-ingest` ainda retornou `duplicate key value violates unique constraint "idx_contacts_telefone_e164_empresa_unique"`. O código-fonte já tem a correção de dedup por telefone (linhas 114-127), mas a edge function pode não ter sido re-deployada após a edição. O fix precisa ser deployado.

### 2. Título do deal usa `utm_campaign` em vez da página de origem
No `lp-lead-ingest` (linhas 177-180), o texto entre colchetes vem de `utm_campaign` com fallback `"LP com IA"`:
```
const campaignShort = lead.utm_campaign ? ... : "LP com IA";
```
O formulário `criptomoedas_tokens` não envia UTM no field_map, então o fallback é sempre ativado. O correto é usar `canal_origem` (que o `elementor-webhook` já preenche com o nome da página extraído da URL). Se `canal_origem` também estiver vazio, não colocar nada entre colchetes.

## Solução

**Arquivo: `supabase/functions/lp-lead-ingest/index.ts`** — Linhas 176-180

Trocar a lógica do título do deal de:
```typescript
const campaignShort = lead.utm_campaign
  ? lead.utm_campaign.replace(/[\[\]🟡🔴🟢]/g, "").trim().substring(0, 60)
  : "LP com IA";
const dealTitle = `${lead.nome || email.split("@")[0]} [${campaignShort}]`;
```

Para:
```typescript
// Prioridade: canal_origem (nome da página) > utm_campaign > nada
const origemTag = lead.canal_origem && lead.canal_origem !== "LP_COM_IA"
  ? lead.canal_origem.substring(0, 60)
  : lead.utm_campaign
    ? lead.utm_campaign.replace(/[\[\]🟡🔴🟢]/g, "").trim().substring(0, 60)
    : null;
const dealTitle = origemTag
  ? `${lead.nome || email.split("@")[0]} [${origemTag}]`
  : `${lead.nome || email.split("@")[0]}`;
```

Isso garante que:
- Se veio de `mpuppe.com/criptomoedas-tokens/`, o título será `"Nome [criptomoedas-tokens]"`
- Se veio com `utm_campaign`, usa o campaign
- Se nenhum dos dois, não coloca colchetes

Após a edição, **redeployar** ambas as edge functions para garantir que o fix de phone dedup (já no código) e o novo fix do título estejam ativos.

