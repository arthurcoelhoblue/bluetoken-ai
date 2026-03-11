

## Plano: Registrar dados do formulário na Timeline do deal

### Objetivo
Quando um lead chega via webhook, registrar uma atividade `CRIACAO` na timeline do deal contendo: qual formulário foi preenchido, canal de origem e todos os campos preenchidos (incluindo extras). Assim o vendedor vê na timeline exatamente o que o lead respondeu.

### Mudanças

#### 1. Edge Function `lp-lead-ingest/index.ts`
Após criar o deal (linha ~237), inserir uma atividade `CRIACAO` em `deal_activities`:

```typescript
await supabase.from("deal_activities").insert({
  deal_id: newDeal.id,
  tipo: "CRIACAO",
  descricao: `Lead via ${lead.canal_origem || "formulário"}`,
  metadata: {
    origem: "FORMULARIO",
    canal_origem: lead.canal_origem,
    form_id: lead.campos_extras?.form_id,
    campos_preenchidos: lead.campos_extras, // todos os campos do form
    utm_source: lead.utm_source,
    utm_campaign: lead.utm_campaign,
  },
});
```

#### 2. Frontend `DealTimelineTab.tsx` — Renderizar dados do formulário
No bloco que já trata atividades `CRIACAO` (linhas ~91-107), adicionar tratamento para `origem === 'FORMULARIO'`:

- Mostrar badge com o nome do formulário/canal de origem
- Listar cada campo preenchido como badges ou lista compacta
- Excluir campos técnicos (utm_*, source, form_id internos) da listagem visível, ou agrupá-los separadamente

Exemplo visual na timeline:
```text
✨ Criação · 11/03/26 14:30
   Lead via criptomoedas-tokens
   📋 nome: João Silva
   📧 email: joao@email.com
   📞 telefone: 11999998888
   💰 investimento_desejado: 100000
   🏷️ tipo_ativo: token
   📎 UTM: google / cpc / campanha-cripto
```

#### 3. Tipo `DealActivityMetadata` — Estender
Adicionar campos ao tipo em `src/types/metadata.ts`:
```typescript
origem?: 'SDR_IA' | 'MANUAL' | 'FORMULARIO';
canal_origem?: string;
form_id?: string;
campos_preenchidos?: Record<string, unknown>;
```

### Arquivos impactados
- `supabase/functions/lp-lead-ingest/index.ts` — inserir activity CRIACAO após criar deal
- `src/components/deals/DealTimelineTab.tsx` — renderizar dados do formulário
- `src/types/metadata.ts` — estender tipagem

