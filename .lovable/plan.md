

## Diagnóstico: "Envio bloqueado: lead em opt-out" + Datas não atualizam

### Problema 1: Opt-out falso positivo

O `whatsapp-send` verifica `contacts.opt_out` antes de enviar qualquer mensagem. O lead BioJoias Brasil está com `opt_out = true` no banco.

**Causa raiz**: No `index.ts`, a ação `DESQUALIFICAR_LEAD` está mapeada para `MARCAR_OPT_OUT` (linha 37). Se a IA classificou incorretamente uma mensagem como desqualificação, o lead foi bloqueado permanentemente. Além disso, o `action-executor.ts` marca `opt_out = true` em `lead_contacts`, e o trigger `fn_sync_lead_to_contact` propaga isso para `contacts`.

**Correção**:
1. **Remover o mapeamento `DESQUALIFICAR_LEAD → MARCAR_OPT_OUT`** — desqualificar um lead NÃO é o mesmo que opt-out. Opt-out só deve acontecer quando o lead explicitamente pede para não ser contatado.
2. **Criar ação `DESQUALIFICAR_LEAD` separada** no `action-executor.ts` que ajusta temperatura para FRIO e cancela cadências, mas **não marca opt-out**.

### Problema 2: `last_inbound_at` não atualizado pelo webhook Baileys

O webhook `meta-webhook` (Meta Cloud API) atualiza `lead_conversation_state.last_inbound_at` quando recebe mensagem inbound (linhas 710-740). Porém, o webhook `whatsapp-inbound` (Baileys) **nunca faz isso**. 

Para empresas que usam Baileys (como Tokeniza), o `last_inbound_at` fica estagnado na data da primeira mensagem, causando:
- Janela de 24h parecer expirada mesmo com o lead respondendo
- Datas desatualizadas na lista de conversas

**Correção**: Adicionar no `whatsapp-inbound/index.ts`, logo após salvar a mensagem (linha ~910), o mesmo upsert de `lead_conversation_state` que o `meta-webhook` faz:

```ts
// Update last_inbound_at for 24h window
const now = new Date().toISOString();
await supabase.from('lead_conversation_state').upsert(
  { lead_id: resolvedLeadId, empresa, canal: 'WHATSAPP',
    last_inbound_at: now, ultimo_contato_em: now, updated_at: now },
  { onConflict: 'lead_id,empresa' }
);
```

### Resumo de arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `sdr-ia-interpret/index.ts` | Remover mapeamento `DESQUALIFICAR_LEAD → MARCAR_OPT_OUT` |
| `sdr-ia-interpret/action-executor.ts` | Criar handler `DESQUALIFICAR_LEAD` que ajusta temperatura/cancela cadência sem marcar opt-out |
| `whatsapp-inbound/index.ts` | Adicionar upsert de `last_inbound_at` após salvar mensagem inbound |

### Correção manual necessária

O lead BioJoias Brasil já está com `opt_out = true` no banco. Será necessário reverter isso manualmente via query:
```sql
UPDATE lead_contacts SET opt_out = false, opt_out_em = null, opt_out_motivo = null
WHERE lead_id = '<ID_DO_LEAD>' AND empresa = 'TOKENIZA';
UPDATE contacts SET opt_out = false, opt_out_em = null, opt_out_motivo = null
WHERE legacy_lead_id = '<ID_DO_LEAD>' AND empresa = 'TOKENIZA';
```

